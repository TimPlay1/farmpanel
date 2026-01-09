const { connectToDatabase } = require('./_lib/db');

/**
 * API для получения глобальных топов панелей
 * GET /api/top?type=income|value|total
 * 
 * Данные кэшируются на сервере и обновляются раз в 10 минут
 */

// Кэш топов в памяти сервера
let topCache = {
    income: { data: null, updatedAt: null },
    value: { data: null, updatedAt: null },
    total: { data: null, updatedAt: null }
};

const CACHE_TTL = 10 * 60 * 1000; // 10 минут

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { type = 'income', force } = req.query;
        
        if (!['income', 'value', 'total'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type. Must be: income, value, or total' });
        }

        const { db } = await connectToDatabase();
        
        // Проверяем есть ли актуальный кэш
        const cached = topCache[type];
        const now = Date.now();
        const cacheAge = cached.updatedAt ? now - cached.updatedAt : Infinity;
        
        // Если кэш актуален и не форсируем обновление - возвращаем его
        if (cached.data && cacheAge < CACHE_TTL && force !== 'true') {
            return res.status(200).json({
                success: true,
                type,
                data: cached.data,
                updatedAt: new Date(cached.updatedAt).toISOString(),
                nextUpdate: new Date(cached.updatedAt + CACHE_TTL).toISOString(),
                cached: true
            });
        }
        
        // Кэш устарел - обновляем
        const farmersCollection = db.collection('farmers');
        const pricesCollection = db.collection('global_brainrot_prices');
        
        // Получаем всех фермеров с данными
        // Note: In MySQL, we get all farmers and filter in JS (accounts is JSON column)
        const allFarmers = await farmersCollection.find({}).toArray();
        const farmers = allFarmers.filter(f => f.accounts && Array.isArray(f.accounts) && f.accounts.length > 0);
        
        // Для топа по стоимости получаем все цены из базы
        let allPrices = {};
        if (type === 'value') {
            const pricesData = await pricesCollection.find({}).toArray();
            for (const price of pricesData) {
                if (price.cacheKey && price.suggestedPrice) {
                    allPrices[price.cacheKey] = price.suggestedPrice;
                }
            }
        }
        
        let topData = [];
        
        if (type === 'income') {
            topData = calculateTopIncome(farmers);
        } else if (type === 'value') {
            topData = calculateTopValue(farmers, allPrices);
        } else if (type === 'total') {
            topData = calculateTopTotal(farmers);
        }
        
        // Сохраняем в кэш
        topCache[type] = {
            data: topData.slice(0, 10),
            updatedAt: now
        };
        
        // Также сохраняем в базу для персистентности между рестартами serverless
        const topCacheCollection = db.collection('top_cache');
        await topCacheCollection.updateOne(
            { type },
            { 
                $set: { 
                    type,
                    data: topData.slice(0, 10),
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
        
        return res.status(200).json({
            success: true,
            type,
            data: topData.slice(0, 10),
            updatedAt: new Date(now).toISOString(),
            nextUpdate: new Date(now + CACHE_TTL).toISOString(),
            cached: false
        });

    } catch (error) {
        console.error('Top API error:', error.message, error.stack);
        
        // При ошибке пробуем вернуть кэш из базы
        try {
            const { db } = await connectToDatabase();
            const topCacheCollection = db.collection('top_cache');
            const { type = 'income' } = req.query;
            const cached = await topCacheCollection.findOne({ type });
            
            if (cached && cached.data) {
                return res.status(200).json({
                    success: true,
                    type,
                    data: cached.data,
                    updatedAt: cached.updatedAt?.toISOString(),
                    cached: true,
                    fallback: true
                });
            }
        } catch (e) {
            console.error('Failed to get fallback cache:', e);
        }
        
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

/**
 * Топ по лучшему income брейнроту каждой панели
 */
function calculateTopIncome(farmers) {
    const results = [];
    
    for (const farmer of farmers) {
        if (!farmer.accounts || farmer.accounts.length === 0) continue;
        
        let bestBrainrot = null;
        let bestIncome = 0;
        
        for (const account of farmer.accounts) {
            if (!account.brainrots || !Array.isArray(account.brainrots)) continue;
            
            for (const br of account.brainrots) {
                // income хранится в M/s формате (число)
                const income = parseFloat(br.income || br.daily_income || 0);
                if (income > bestIncome) {
                    bestIncome = income;
                    bestBrainrot = {
                        name: br.name || 'Unknown',
                        income: income,
                        image: br.image || null
                    };
                }
            }
        }
        
        if (bestBrainrot && bestIncome > 0) {
            results.push({
                farmKey: farmer.farmKey,
                username: farmer.username || 'Unknown',
                avatar: farmer.avatar || null,
                brainrot: bestBrainrot,
                value: bestIncome, // income в M/s
                accountsCount: farmer.accounts.length
            });
        }
    }
    
    results.sort((a, b) => b.value - a.value);
    return results;
}

/**
 * Топ по самому дорогому брейнроту каждой панели
 * Цены берутся из глобального кэша цен
 */
function calculateTopValue(farmers, allPrices) {
    const results = [];
    
    // Группируем цены по имени брейнрота для быстрого поиска ближайшего income
    const pricesByName = {};
    for (const [cacheKey, price] of Object.entries(allPrices)) {
        const parts = cacheKey.split('_');
        if (parts.length >= 2) {
            const income = parseInt(parts.pop());
            const name = parts.join('_');
            if (!pricesByName[name]) {
                pricesByName[name] = [];
            }
            // v10.3.23: Ensure price is a number
            pricesByName[name].push({ income, price: parseFloat(price) || 0 });
        }
    }
    
    // Сортируем по income для бинарного поиска ближайшего
    for (const name of Object.keys(pricesByName)) {
        pricesByName[name].sort((a, b) => a.income - b.income);
    }
    
    for (const farmer of farmers) {
        if (!farmer.accounts || farmer.accounts.length === 0) continue;
        
        let bestBrainrot = null;
        let bestValue = 0;
        let bestPriceFromCache = false; // v10.3.23: Track if price is from real cache
        
        for (const account of farmer.accounts) {
            if (!account.brainrots || !Array.isArray(account.brainrots)) continue;
            
            for (const br of account.brainrots) {
                // Income может быть в разных форматах:
                // - raw number: 390000000 (нужно /1e6 для получения 390)
                // - M/s format: 390
                let rawIncome = parseFloat(br.income || br.daily_income || 0);
                // Если income > 10000, это raw формат - конвертируем в M/s
                const incomeInMs = rawIncome > 10000 ? Math.round(rawIncome / 1e6) : Math.round(rawIncome);
                
                const name = br.name || '';
                const nameLower = name.toLowerCase();
                
                let price = 0;
                let priceFromCache = false;
                
                // Ищем ближайшую цену по income для данного брейнрота
                const pricesForName = pricesByName[nameLower];
                if (pricesForName && pricesForName.length > 0) {
                    // Находим ближайший income
                    let closestPrice = pricesForName[0];
                    let minDiff = Math.abs(pricesForName[0].income - incomeInMs);
                    
                    for (const p of pricesForName) {
                        const diff = Math.abs(p.income - incomeInMs);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestPrice = p;
                        }
                    }
                    
                    // Принимаем цену если разница в income не более 50%
                    if (minDiff <= incomeInMs * 0.5 || minDiff <= 50) {
                        price = closestPrice.price;
                        priceFromCache = true;
                    }
                }
                
                // v10.3.23: Для топа используем ТОЛЬКО реальные цены из кэша Eldorado
                // Не используем fallback br.value - это может быть устаревшая/неправильная цена
                // Приоритет: цены из кэша > цены из брейнрота только если они выглядят реалистично
                if (!price && pricesForName && pricesForName.length > 0) {
                    // Есть цены для этого брейнрота, но не для этого income
                    // Берём максимальную цену как ориентир (брейнрот с высоким income стоит дороже)
                    const maxPrice = Math.max(...pricesForName.map(p => p.price));
                    // Экстраполируем цену пропорционально income
                    const maxIncome = Math.max(...pricesForName.map(p => p.income));
                    if (maxIncome > 0 && maxPrice > 0 && incomeInMs > maxIncome) {
                        // Линейная экстраполяция (грубая оценка)
                        price = maxPrice * (incomeInMs / maxIncome);
                        priceFromCache = true;
                    }
                }
                
                // v10.3.23: Prefer cache prices over fallback
                // Only use brainrot data if we have nothing from cache AND it looks reasonable
                if (!priceFromCache) {
                    const fallbackPrice = parseFloat(br.value || br.price || 0);
                    // Проверяем что fallback цена выглядит реалистично (> $1 и < $10000)
                    if (fallbackPrice > 1 && fallbackPrice < 10000) {
                        price = fallbackPrice;
                    }
                }
                
                // v10.3.23: При равной цене предпочитаем тот что из кэша
                if (price > bestValue || (price === bestValue && priceFromCache && !bestPriceFromCache)) {
                    bestValue = price;
                    bestPriceFromCache = priceFromCache;
                    bestBrainrot = {
                        name: br.name || 'Unknown',
                        income: incomeInMs,
                        image: br.image || null,
                        priceFound: priceFromCache
                    };
                }
            }
        }
        
        if (bestBrainrot && bestValue > 0) {
            results.push({
                farmKey: farmer.farmKey,
                username: farmer.username || 'Unknown',
                avatar: farmer.avatar || null,
                brainrot: bestBrainrot,
                value: bestValue, // цена в $
                accountsCount: farmer.accounts.length
            });
        }
    }
    
    results.sort((a, b) => b.value - a.value);
    return results;
}

/**
 * Топ по общему доходу панели (сумма income всех брейнротов)
 */
function calculateTopTotal(farmers) {
    const results = [];
    
    for (const farmer of farmers) {
        if (!farmer.accounts || farmer.accounts.length === 0) continue;
        
        let totalIncome = 0;
        let brainrotsCount = 0;
        
        for (const account of farmer.accounts) {
            if (!account.brainrots || !Array.isArray(account.brainrots)) continue;
            
            for (const br of account.brainrots) {
                totalIncome += parseFloat(br.income || br.daily_income || 0);
                brainrotsCount++;
            }
        }
        
        if (totalIncome > 0) {
            results.push({
                farmKey: farmer.farmKey,
                username: farmer.username || 'Unknown',
                avatar: farmer.avatar || null,
                brainrot: null,
                value: totalIncome, // общий income в M/s
                accountsCount: farmer.accounts.length,
                brainrotsCount: brainrotsCount
            });
        }
    }
    
    results.sort((a, b) => b.value - a.value);
    return results;
}

