const { connectToDatabase } = require('./_lib/db');
const https = require('https');

/**
 * API для отслеживания офферов на Eldorado
 * Офферы идентифицируются по уникальному коду #GS-XXX в описании
 * 
 * При GET запросе:
 * 1. Запускает быстрый фоновый сканер Glitched Store (не блокирует ответ)
 * 2. Возвращает офферы с recommendedPrice из global_brainrot_prices
 */

// Кэш последнего сканирования
let lastBackgroundScanTime = 0;
const BACKGROUND_SCAN_INTERVAL = 60000; // 60 секунд между фоновыми сканами

/**
 * Запуск фонового сканирования (не блокирует)
 */
function triggerBackgroundScan() {
    const now = Date.now();
    if (now - lastBackgroundScanTime < BACKGROUND_SCAN_INTERVAL) {
        return; // Ещё не время
    }
    lastBackgroundScanTime = now;
    
    // Запускаем сканер асинхронно (не ждём результата)
    const options = {
        hostname: 'farmpanel.vercel.app',
        path: '/api/scan-glitched',
        method: 'GET',
        timeout: 25000
    };
    
    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                console.log('Background scan completed:', result.updated, 'updated');
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
        const globalPricesCollection = db.collection('global_brainrot_prices');

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
            
            // Собираем все ключи цен для batch запроса
            const priceKeys = [];
            for (const offer of offers) {
                const key = getPriceCacheKey(offer.brainrotName, offer.income);
                if (key) priceKeys.push(key);
            }
            
            // Получаем все цены одним запросом
            const pricesMap = new Map();
            if (priceKeys.length > 0) {
                const prices = await globalPricesCollection.find({
                    cacheKey: { $in: priceKeys }
                }).toArray();
                
                for (const p of prices) {
                    pricesMap.set(p.cacheKey, p);
                }
            }
            
            // Добавляем recommendedPrice к каждому офферу
            for (const offer of offers) {
                const key = getPriceCacheKey(offer.brainrotName, offer.income);
                const priceData = key ? pricesMap.get(key) : null;
                
                if (priceData && priceData.suggestedPrice) {
                    offer.recommendedPrice = priceData.suggestedPrice;
                    offer.isSpike = priceData.isSpike || false;
                    offer.pendingPrice = priceData.pendingPrice || null;
                    offer.priceSource = priceData.priceSource || null;
                    offer.competitorPrice = priceData.competitorPrice || null;
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
