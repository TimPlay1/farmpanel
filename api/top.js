const { connectToDatabase } = require('./_lib/db');

/**
 * API для получения глобальных топов панелей
 * GET /api/top?type=income|value|total
 */
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
        const { type = 'income' } = req.query;
        
        if (!['income', 'value', 'total'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type. Must be: income, value, or total' });
        }

        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');
        
        // Получаем всех фермеров с данными
        const farmers = await farmersCollection.find({
            accounts: { $exists: true, $ne: [] }
        }).toArray();
        
        let topData = [];
        
        if (type === 'income') {
            // Топ по лучшему income брейнроту каждой панели
            topData = calculateTopIncome(farmers);
        } else if (type === 'value') {
            // Топ по самому дорогому брейнроту каждой панели
            topData = calculateTopValue(farmers);
        } else if (type === 'total') {
            // Топ по общему доходу панели
            topData = calculateTopTotal(farmers);
        }
        
        // Возвращаем топ-10
        return res.status(200).json({
            success: true,
            type,
            data: topData.slice(0, 10),
            updatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Top API error:', error.message, error.stack);
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
                const income = parseFloat(br.daily_income || br.income || 0);
                if (income > bestIncome) {
                    bestIncome = income;
                    bestBrainrot = {
                        name: br.name || 'Unknown',
                        income: income
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
                value: bestIncome,
                accountsCount: farmer.accounts.length
            });
        }
    }
    
    // Сортируем по income
    results.sort((a, b) => b.value - a.value);
    return results;
}

/**
 * Топ по самому дорогому брейнроту каждой панели
 */
function calculateTopValue(farmers) {
    const results = [];
    
    for (const farmer of farmers) {
        if (!farmer.accounts || farmer.accounts.length === 0) continue;
        
        let bestBrainrot = null;
        let bestValue = 0;
        
        for (const account of farmer.accounts) {
            if (!account.brainrots || !Array.isArray(account.brainrots)) continue;
            
            for (const br of account.brainrots) {
                const value = parseFloat(br.value || br.price || 0);
                if (value > bestValue) {
                    bestValue = value;
                    bestBrainrot = {
                        name: br.name || 'Unknown',
                        income: parseFloat(br.daily_income || br.income || 0)
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
                value: bestValue,
                accountsCount: farmer.accounts.length
            });
        }
    }
    
    // Сортируем по value
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
                totalIncome += parseFloat(br.daily_income || br.income || 0);
                brainrotsCount++;
            }
        }
        
        if (totalIncome > 0) {
            results.push({
                farmKey: farmer.farmKey,
                username: farmer.username || 'Unknown',
                avatar: farmer.avatar || null,
                brainrot: null, // Для total не показываем конкретный брейнрот
                value: totalIncome,
                accountsCount: farmer.accounts.length,
                brainrotsCount: brainrotsCount
            });
        }
    }
    
    // Сортируем по total income
    results.sort((a, b) => b.value - a.value);
    return results;
}
