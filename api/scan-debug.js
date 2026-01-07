/**
 * API для детальной проверки состояния price cache
 * GET /api/scan-debug
 */

const { connectToDatabase } = require('./_lib/db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        
        // Фильтруем только цены с правильным форматом income (< 10000)
        // Старый формат имел income как полное число (477375000), новый - M/s (477)
        const allPrices = await db.collection('price_cache')
            .find({})
            .project({ _id: 1, updatedAt: 1, cycleId: 1, income: 1 })
            .toArray();
        
        // Группируем по возрасту
        const ageGroups = {
            under1min: 0,
            under5min: 0,
            under10min: 0,
            under20min: 0,
            over20min: 0
        };
        
        const oldItems = [];
        const validPrices = allPrices.filter(p => {
            // Фильтруем только правильный формат (income < 10000)
            return p.income && p.income < 10000;
        });
        
        for (const p of validPrices) {
            const ageMs = now - new Date(p.updatedAt);
            const ageMin = ageMs / 60000;
            
            if (ageMin < 1) ageGroups.under1min++;
            else if (ageMin < 5) ageGroups.under5min++;
            else if (ageMin < 10) ageGroups.under10min++;
            else if (ageMin < 20) ageGroups.under20min++;
            else {
                ageGroups.over20min++;
                if (oldItems.length < 20) {
                    oldItems.push({
                        key: p._id,
                        income: p.income,
                        updatedAt: p.updatedAt,
                        ageMin: Math.round(ageMin),
                        cycleId: p.cycleId
                    });
                }
            }
        }
        
        // Статистика по cycleId
        const cycleStats = {};
        for (const p of validPrices) {
            const cycle = p.cycleId || 0;
            cycleStats[cycle] = (cycleStats[cycle] || 0) + 1;
        }
        
        return res.status(200).json({
            success: true,
            serverTime: now.toISOString(),
            totalPrices: allPrices.length,
            validPrices: validPrices.length,
            oldFormatPrices: allPrices.length - validPrices.length,
            ageGroups,
            oldItems,
            cycleStats
        });
        
    } catch (e) {
        console.error('scan-debug error:', e);
        return res.status(500).json({ error: e.message });
    }
};
