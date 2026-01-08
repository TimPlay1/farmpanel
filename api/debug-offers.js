/**
 * Debug API - показывает все офферы пользователя с деталями income
 * GET /api/debug-offers?farmKey=XXXX
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
        const { farmKey, brainrotName } = req.query;
        
        if (!farmKey) {
            return res.status(400).json({ error: 'farmKey is required' });
        }
        
        const { db } = await connectToDatabase();
        
        // Получаем все офферы пользователя
        const offers = await db.collection('offers')
            .find({ farmKey })
            .toArray();
        
        // Фильтруем по имени если указано
        let filtered = offers;
        if (brainrotName) {
            filtered = offers.filter(o => 
                o.brainrotName?.toLowerCase().includes(brainrotName.toLowerCase())
            );
        }
        
        // Детальная информация по каждому офферу
        const details = filtered.map(offer => {
            const incomeType = typeof offer.income;
            const incomeValue = offer.income;
            
            // Нормализуем income как это делает клиент
            let normalizedIncome = incomeValue;
            if (incomeValue > 10000) {
                normalizedIncome = Math.round(incomeValue / 1000000 * 10) / 10;
            }
            const roundedIncome = Math.floor(normalizedIncome / 10) * 10;
            
            return {
                offerId: offer.offerId,
                brainrotName: offer.brainrotName,
                income: {
                    raw: incomeValue,
                    type: incomeType,
                    normalized: normalizedIncome,
                    rounded: roundedIncome
                },
                incomeRaw: offer.incomeRaw,
                mutation: offer.mutation || null,
                status: offer.status,
                eldoradoOfferId: offer.eldoradoOfferId,
                eldoradoTitle: offer.eldoradoTitle,
                currentPrice: offer.currentPrice,
                createdAt: offer.createdAt,
                updatedAt: offer.updatedAt
            };
        });
        
        return res.status(200).json({
            success: true,
            farmKey: farmKey.substring(0, 8) + '...',
            totalOffers: offers.length,
            filteredOffers: filtered.length,
            offers: details
        });
        
    } catch (e) {
        console.error('debug-offers error:', e);
        return res.status(500).json({ error: e.message });
    }
};
