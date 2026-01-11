const { connectToDatabase } = require('./_lib/db');
const https = require('https');

/**
 * Парсит income из различных форматов:
 * - Число: 310 → 310
 * - Строка без $: "310.0 M/s" → 310
 * - Строка с $: "$310.0M/s" → 310
 * - Строка с B: "1.5B/s" → 1500
 */
function parseIncomeValue(income) {
    if (typeof income === 'number') return income;
    if (!income) return 0;
    
    const str = String(income).replace(/[$,]/g, '').trim();
    const match = str.match(/([\d.]+)\s*([KMBT])?\/?s?/i);
    if (!match) return parseFloat(str) || 0;
    
    let value = parseFloat(match[1]);
    const suffix = (match[2] || '').toUpperCase();
    
    // Конвертируем в M/s
    if (suffix === 'K') value *= 0.001;
    else if (suffix === 'B') value *= 1000;
    else if (suffix === 'T') value *= 1000000;
    // M или пусто = уже в M/s
    
    return value || 0;
}

/**
 * API для отслеживания офферов на Eldorado
 * 
 * УНИВЕРСАЛЬНАЯ СИСТЕМА v2.1:
 * - Офферы идентифицируются по уникальным кодам в тайтлах (#XXXXXXXX)
 * - Коды регистрируются в offer_codes и автоматически привязываются к farmKey
 * - Сканирование теперь через cron-offer-scanner (не фоновый universal-scan)
 * 
 * При GET запросе:
 * - Возвращает офферы пользователя с recommendedPrice из price_cache
 * - НЕ запускает фоновое сканирование (избегаем Cloudflare rate limit 1015)
 */

// v2.1: Фоновое сканирование ОТКЛЮЧЕНО - вызывает Cloudflare rate limit
// Сканирование офферов будет через отдельный cron job
// let lastBackgroundScanTime = 0;
// const BACKGROUND_SCAN_INTERVAL = 60000;

/**
 * v2.1: Фоновое сканирование ОТКЛЮЧЕНО
 * Раньше вызывало universal-scan каждые 60 сек, что приводило к rate limit 1015
 */
function triggerBackgroundScan() {
    // DISABLED: Cloudflare rate limit 1015
    // Офферы теперь сканируются через отдельный cron или вручную
    return;
    
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
 * Конвертирует income в M/s для унифицированного ключа
 * В разных местах income может быть:
 * - Полное число: 1100000000 (= 1.1B = 1100 M/s)
 * - Уже в M/s: 1100
 */
function incomeToMs(income) {
    if (typeof income !== 'number' || income <= 0) return null;
    // Если > 10000, это полное число - конвертируем в M/s
    if (income > 10000) return income / 1000000;
    return income;
}

/**
 * Генерирует ключ кэша цены (как в клиенте)
 * v3.0.4: Унифицируем income в M/s перед округлением
 */
function getPriceCacheKey(name, income) {
    if (!name || income === undefined) return null;
    const incomeMs = incomeToMs(income);
    if (incomeMs === null) return null;
    const roundedIncome = Math.floor(incomeMs / 10) * 10;
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
            
            // v3.0.3: Получаем мутации из collection фермера
            // Сопоставляем по (name + income) - это единственный надёжный способ
            // т.к. Eldorado API не даёт нормальные данные о мутациях
            const farmersCollection = db.collection('farmers');
            const farmer = await farmersCollection.findOne({ farmKey });
            
            // Создаём map: (name_income) -> mutation
            // Используем ту же функцию getPriceCacheKey для единообразия
            const mutationsMap = new Map();
            
            if (farmer && farmer.accounts) {
                for (const account of farmer.accounts) {
                    if (account.brainrots) {
                        for (const b of account.brainrots) {
                            if (b.name && b.income) {
                                const key = getPriceCacheKey(b.name, b.income);
                                if (key) {
                                    // Сохраняем мутацию (или null если нет)
                                    mutationsMap.set(key, b.mutation || null);
                                }
                            }
                        }
                    }
                }
            }
            
            // v3.0.5: Debug - показываем мутации для La Secret Combinasion
            for (const [key, mut] of mutationsMap.entries()) {
                if (key.includes('secret')) {
                    console.log(`📋 MutationsMap: "${key}" → ${mut || 'null'}`);
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
            
            // Добавляем recommendedPrice и мутацию к каждому офферу
            // v3.0.6: Приоритет мутации:
            // 1. offer.mutation из БД (от cron-price-scanner / Eldorado API) - самый точный
            // 2. Fallback: из collection фермера по (name + income)
            for (const offer of offers) {
                const key = getPriceCacheKey(offer.brainrotName, offer.income);
                const priceData = key ? pricesMap.get(key) : null;
                
                // Debug: логируем для offers с B/s income
                if (offer.income > 500) {
                    console.log(`🔍 Offer "${offer.brainrotName}" income=${offer.income} → key="${key}", db.mutation=${offer.mutation || 'null'}, collection.mutation=${mutationsMap.get(key) || 'NOT_FOUND'}`);
                }
                
                if (priceData && priceData.suggestedPrice) {
                    offer.recommendedPrice = priceData.suggestedPrice;
                    // No spike logic in centralized cache - prices are verified by cron
                    offer.priceSource = priceData.priceSource || priceData.source || null;
                    offer.competitorPrice = priceData.competitorPrice || null;
                }
                
                // v3.0.7: Мутация - приоритет offer.mutation из БД (Eldorado API)
                // mutation = null означает "без мутации" от Eldorado - НЕ перезаписываем!
                // mutation = undefined означает "неизвестно" - используем collection
                if (offer.mutation === undefined && key && mutationsMap.has(key)) {
                    offer.mutation = mutationsMap.get(key);
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
                income: parseIncomeValue(income),
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

        // PUT - обновить цену оффера или batch status update
        if (req.method === 'PUT') {
            const { farmKey, offerId, currentPrice, recommendedPrice, status, batchStatusUpdate } = req.body;

            // v9.12.1: Batch status update from Tampermonkey auto-sync
            if (farmKey && batchStatusUpdate && Array.isArray(batchStatusUpdate)) {
                const now = new Date();
                let updatedCount = 0;
                
                for (const update of batchStatusUpdate) {
                    if (!update.offerId || !update.status) continue;
                    
                    const updateData = { 
                        status: update.status,
                        updatedAt: now 
                    };
                    
                    // Track paused/active/closed times
                    if (update.status === 'paused') {
                        updateData.pausedAt = now;
                    } else if (update.status === 'active') {
                        updateData.pausedAt = null;
                    } else if (update.status === 'closed') {
                        // v9.12.8: Mark as closed (offer removed from Eldorado)
                        updateData.closedAt = now;
                        updateData.pausedAt = now; // Also set pausedAt for auto-delete
                    }
                    
                    await offersCollection.updateOne(
                        { farmKey, offerId: update.offerId },
                        { $set: updateData }
                    );
                    updatedCount++;
                }
                
                console.log(`[offers] Batch status update: ${updatedCount} offers updated`);
                return res.json({ success: true, updated: updatedCount });
            }

            if (!farmKey || !offerId) {
                return res.status(400).json({ error: 'farmKey and offerId are required' });
            }

            const update = { updatedAt: new Date() };
            if (currentPrice !== undefined) update.currentPrice = parseFloat(currentPrice);
            if (recommendedPrice !== undefined) update.recommendedPrice = parseFloat(recommendedPrice);
            if (status !== undefined) {
                update.status = status;
                // Track when offer was paused/closed for auto-deletion after 3 days
                if (status === 'paused') {
                    update.pausedAt = new Date();
                } else if (status === 'active') {
                    update.pausedAt = null; // Clear pausedAt when reactivated
                    update.closedAt = null; // Clear closedAt when reactivated
                } else if (status === 'closed') {
                    // v9.12.8: Mark as closed (offer removed from Eldorado)
                    update.closedAt = new Date();
                    update.pausedAt = new Date(); // Also set pausedAt for auto-delete
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
