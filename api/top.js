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
        const farmers = await farmersCollection.find({
            accounts: { $exists: true, $ne: [] }
        }).toArray();
        
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
    
    for (const farmer of farmers) {
        if (!farmer.accounts || farmer.accounts.length === 0) continue;
        
        let bestBrainrot = null;
        let bestValue = 0;
        
        for (const account of farmer.accounts) {
            if (!account.brainrots || !Array.isArray(account.brainrots)) continue;
            
            for (const br of account.brainrots) {
                // Формируем ключ кэша как в prices.js
                const income = parseFloat(br.income || br.daily_income || 0);
                const name = br.name || '';
                
                // Пробуем разные форматы ключа
                const cacheKeys = [
                    `${name.toLowerCase()}_${income}`,
                    `${name.toLowerCase()}_${Math.round(income)}`,
                    `${name}_${income}`,
                    name.toLowerCase()
                ];
                
                let price = 0;
                for (const key of cacheKeys) {
                    if (allPrices[key]) {
                        price = allPrices[key];
                        break;
                    }
                }
                
                // Если нет в кэше цен, используем value из данных если есть
                if (!price) {
                    price = parseFloat(br.value || br.price || 0);
                }
                
                if (price > bestValue) {
                    bestValue = price;
                    bestBrainrot = {
                        name: br.name || 'Unknown',
                        income: income,
                        image: br.image || null
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

