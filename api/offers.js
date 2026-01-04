const { connectToDatabase } = require('./_lib/db');
const https = require('https');

/**
 * API для отслеживания офферов на Eldorado
 * 
 * УНИВЕРСАЛЬНАЯ СИСТЕМА v2.0:
 * - Офферы идентифицируются по уникальным кодам в тайтлах (#XXXXXXXX)
 * - Коды регистрируются в offer_codes и автоматически привязываются к farmKey
 * - Универсальный сканер находит все офферы и распределяет по пользователям
 * 
 * При GET запросе:
 * 1. Запускает универсальный фоновый сканер (не блокирует ответ)
 * 2. Возвращает офферы пользователя с recommendedPrice из price_cache
 */

// Кэш последнего сканирования
let lastBackgroundScanTime = 0;
const BACKGROUND_SCAN_INTERVAL = 60000; // 60 секунд между фоновыми сканами

/**
 * Запуск универсального фонового сканирования (не блокирует)
 */
function triggerBackgroundScan() {
    const now = Date.now();
    if (now - lastBackgroundScanTime < BACKGROUND_SCAN_INTERVAL) {
        return; // Ещё не время
    }
    lastBackgroundScanTime = now;
    
    // Запускаем универсальный сканер асинхронно
    const options = {
        hostname: 'farmpanel.vercel.app',
        path: '/api/universal-scan',
        method: 'GET',
        timeout: 60000 // Больший таймаут для полного скана
    };
    
    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                console.log(`Universal scan completed: ${result.matched || 0} matched, ${result.totalScanned || 0} scanned`);
            } catch (e) {}
        });
    });
    req.on('error', () => {}); // Ignore errors
    req.end();
}

/**
 * Генерирует ключ кэша цены (как в клиенте)
 */
function getPriceCacheKey(name, income) {
    if (!name || income === undefined) return null;
    const roundedIncome = Math.floor(income / 10) * 10;
    return `${name.toLowerCase()}_${roundedIncome}`;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    // No-cache for fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { db } = await connectToDatabase();
        const offersCollection = db.collection('offers');
        // Use price_cache from centralized cron scanner (no spike logic needed)
        const priceCacheCollection = db.collection('price_cache');

        // GET - получить офферы для farmKey с recommendedPrice из глобального кэша
        if (req.method === 'GET') {
            const { farmKey, offerId } = req.query;
            
            if (!farmKey) {
                return res.status(400).json({ error: 'farmKey is required' });
            }
            
            // Запускаем фоновое сканирование Glitched Store (не блокирует)
            triggerBackgroundScan();

            // Auto-delete paused offers older than 3 days
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            const deleteResult = await offersCollection.deleteMany({
                farmKey,
                status: 'paused',
                pausedAt: { $lt: threeDaysAgo }
            });
            if (deleteResult.deletedCount > 0) {
                console.log(`Auto-deleted ${deleteResult.deletedCount} paused offers older than 3 days for farmKey: ${farmKey}`);
            }

            if (offerId) {
                // Получить конкретный оффер
                const offer = await offersCollection.findOne({ farmKey, offerId });
                return res.json({ offer });
            }

            // Получить все офферы
            const offers = await offersCollection.find({ farmKey }).sort({ createdAt: -1 }).toArray();
            
            // Получаем данные фермера для обогащения мутациями
            const farmersCollection = db.collection('farmers');
            const farmer = await farmersCollection.findOne({ farmKey });
            
            // Создаём ДВЕ map для поиска мутаций:
            // 1. (name+income) -> mutation (точный match)
            // 2. name -> mutation (fallback если точный не найден)
            // ВАЖНО: один brainrot (Los 67) может иметь РАЗНЫЕ мутации при разных income
            const mutationsMapExact = new Map();  // name_income -> mutation
            const mutationsMapFallback = new Map(); // name -> mutation (последняя найденная)
            if (farmer && farmer.accounts) {
                for (const account of farmer.accounts) {
                    if (account.brainrots) {
                        for (const b of account.brainrots) {
                            if (b.mutation && b.name) {
                                const nameLower = b.name.toLowerCase();
                                // Fallback - просто по имени (перезапишется если много)
                                mutationsMapFallback.set(nameLower, b.mutation);
                                
                                // Точный ключ с income (если есть)
                                if (b.income !== undefined && b.income !== null) {
                                    const roundedIncome = Math.floor((b.income || 0) / 10) * 10;
                                    const exactKey = `${nameLower}_${roundedIncome}`;
                                    mutationsMapExact.set(exactKey, b.mutation);
                                }
                            }
                        }
                    }
                }
            }
            
            // Собираем все ключи цен для batch запроса
            const priceKeys = [];
            for (const offer of offers) {
                const key = getPriceCacheKey(offer.brainrotName, offer.income);
                if (key) priceKeys.push(key);
            }
            
            // Получаем все цены одним запросом из centralized price_cache
            const pricesMap = new Map();
            if (priceKeys.length > 0) {
                const prices = await priceCacheCollection.find({
                    _id: { $in: priceKeys }
                }).toArray();
                
                for (const p of prices) {
                    pricesMap.set(p._id, p);
                }
            }
            
            // Добавляем recommendedPrice и mutation к каждому офферу
            for (const offer of offers) {
                const key = getPriceCacheKey(offer.brainrotName, offer.income);
                const priceData = key ? pricesMap.get(key) : null;
                
                if (priceData && priceData.suggestedPrice) {
                    offer.recommendedPrice = priceData.suggestedPrice;
                    // No spike logic in centralized cache - prices are verified by cron
                    offer.priceSource = priceData.priceSource || priceData.source || null;
                    offer.competitorPrice = priceData.competitorPrice || null;
                }
                
                // Добавляем мутацию из данных фермера
                // 1. Сначала пробуем точный match по name+income
                // 2. Если не найден - fallback по имени
                if (!offer.mutation && offer.brainrotName) {
                    const nameLower = offer.brainrotName.toLowerCase();
                    let mutation = null;
                    
                    // Точный поиск по name+income
                    if (offer.income !== undefined && offer.income !== null) {
                        const roundedIncome = Math.floor((offer.income || 0) / 10) * 10;
                        const exactKey = `${nameLower}_${roundedIncome}`;
                        mutation = mutationsMapExact.get(exactKey);
                    }
                    
                    // Fallback по имени если точный не найден
                    if (!mutation) {
                        mutation = mutationsMapFallback.get(nameLower);
                    }
                    
                    if (mutation) {
                        offer.mutation = mutation;
                    }
                }
            }
            
            return res.json({ 
                offers,
                timestamp: Date.now() // For client to know data freshness
            });
        }

        // POST - создать/обновить оффер
        if (req.method === 'POST') {
            const { 
                farmKey, 
                offerId, 
                brainrotName, 
                income,
                incomeRaw, // оригинальная строка income для отображения
                currentPrice, 
                recommendedPrice,
                imageUrl,
                eldoradoOfferId,
                accountId,
                status = 'pending' // pending пока не найден на Eldorado
            } = req.body;

            if (!farmKey || !offerId) {
                return res.status(400).json({ error: 'farmKey and offerId are required' });
            }

            const offer = {
                farmKey,
                offerId,
                brainrotName,
                income: typeof income === 'number' ? income : parseFloat(income) || 0,
                incomeRaw: incomeRaw || income, // сохраняем оригинальную строку
                currentPrice: parseFloat(currentPrice) || 0,
                recommendedPrice: parseFloat(recommendedPrice) || 0,
                imageUrl,
                eldoradoOfferId,
                accountId,
                status,
                updatedAt: new Date()
            };

            // Upsert - обновить если существует, создать если нет
            await offersCollection.updateOne(
                { farmKey, offerId },
                { 
                    $set: offer,
                    $setOnInsert: { createdAt: new Date() }
                },
                { upsert: true }
            );

            return res.json({ success: true, offer });
        }

        // PUT - обновить цену оффера
        if (req.method === 'PUT') {
            const { farmKey, offerId, currentPrice, recommendedPrice, status } = req.body;

            if (!farmKey || !offerId) {
                return res.status(400).json({ error: 'farmKey and offerId are required' });
            }

            const update = { updatedAt: new Date() };
            if (currentPrice !== undefined) update.currentPrice = parseFloat(currentPrice);
            if (recommendedPrice !== undefined) update.recommendedPrice = parseFloat(recommendedPrice);
            if (status !== undefined) {
                update.status = status;
                // Track when offer was paused for auto-deletion after 3 days
                if (status === 'paused') {
                    update.pausedAt = new Date();
                } else if (status === 'active') {
                    update.pausedAt = null; // Clear pausedAt when reactivated
                }
            }

            await offersCollection.updateOne(
                { farmKey, offerId },
                { $set: update }
            );

            return res.json({ success: true });
        }

        // DELETE - удалить оффер
        if (req.method === 'DELETE') {
            const { farmKey, offerId } = req.query;

            if (!farmKey || !offerId) {
                return res.status(400).json({ error: 'farmKey and offerId are required' });
            }

            await offersCollection.deleteOne({ farmKey, offerId });
            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Offers API error:', error);
        res.status(500).json({ error: error.message });
    }
};
