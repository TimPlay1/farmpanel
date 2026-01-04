/**
 * API для получения цен из глобального серверного кэша
 * 
 * Клиенты получают цены отсюда, а не делают свои запросы на Eldorado
 * Цены обновляются централизованно через cron-price-scanner
 * 
 * GET /api/prices-cache?keys=name1_income1,name2_income2
 * GET /api/prices-cache?all=true (все цены)
 */

const { connectToDatabase } = require('./_lib/db');

module.exports = async (req, res) => {
    // CORS
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
        const { db } = await connectToDatabase();
        const collection = db.collection('price_cache');
        
        const { keys, all, since } = req.query;
        
        // Получить все цены (для начальной загрузки)
        // Используем проекцию для получения только нужных полей (быстрее)
        if (all === 'true') {
            const projection = {
                _id: 1,
                suggestedPrice: 1,
                source: 1,
                priceSource: 1,
                competitorPrice: 1,
                competitorIncome: 1,
                targetMsRange: 1,
                aiParsedCount: 1,
                medianPrice: 1,
                medianData: 1,
                nextCompetitorPrice: 1,
                nextCompetitorData: 1,
                nextRangeChecked: 1,
                isInEldoradoList: 1,
                updatedAt: 1
            };
            
            const prices = await collection.find({}, { projection }).toArray();
            
            // Преобразуем в объект для быстрого доступа
            const pricesMap = {};
            for (const p of prices) {
                pricesMap[p._id] = {
                    suggestedPrice: p.suggestedPrice,
                    source: p.source,
                    priceSource: p.priceSource,
                    competitorPrice: p.competitorPrice,
                    competitorIncome: p.competitorIncome,
                    targetMsRange: p.targetMsRange,
                    aiParsedCount: p.aiParsedCount,
                    // v9.10.16: Added median and nextCompetitor fields
                    medianPrice: p.medianPrice,
                    medianData: p.medianData,
                    nextCompetitorPrice: p.nextCompetitorPrice,
                    nextCompetitorData: p.nextCompetitorData,
                    // v9.9.5: Next range check info
                    nextRangeChecked: p.nextRangeChecked,
                    isInEldoradoList: p.isInEldoradoList,
                    updatedAt: p.updatedAt
                };
            }
            
            // Кэшируем на 2 минуты (цены обновляются централизованно)
            res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
            
            return res.status(200).json({
                success: true,
                count: prices.length,
                prices: pricesMap
            });
        }
        
        // Получить цены обновлённые после определённого времени
        if (since) {
            const sinceDate = new Date(parseInt(since));
            const prices = await collection.find({
                updatedAt: { $gt: sinceDate }
            }).toArray();
            
            const pricesMap = {};
            for (const p of prices) {
                pricesMap[p._id] = {
                    suggestedPrice: p.suggestedPrice,
                    source: p.source,
                    priceSource: p.priceSource,
                    competitorPrice: p.competitorPrice,
                    competitorIncome: p.competitorIncome,
                    // v9.10.16: Added median and nextCompetitor fields
                    medianPrice: p.medianPrice,
                    medianData: p.medianData,
                    nextCompetitorPrice: p.nextCompetitorPrice,
                    nextCompetitorData: p.nextCompetitorData,
                    nextRangeChecked: p.nextRangeChecked,
                    isInEldoradoList: p.isInEldoradoList,
                    updatedAt: p.updatedAt
                };
            }
            
            return res.status(200).json({
                success: true,
                count: prices.length,
                prices: pricesMap,
                since: sinceDate.toISOString()
            });
        }
        
        // Получить конкретные цены по ключам
        if (keys) {
            const keyList = keys.split(',').map(k => k.trim().toLowerCase());
            
            const prices = await collection.find({
                _id: { $in: keyList }
            }).toArray();
            
            const pricesMap = {};
            for (const p of prices) {
                pricesMap[p._id] = {
                    suggestedPrice: p.suggestedPrice,
                    source: p.source,
                    priceSource: p.priceSource,
                    competitorPrice: p.competitorPrice,
                    competitorIncome: p.competitorIncome,
                    // v9.10.16: Added median and nextCompetitor fields
                    medianPrice: p.medianPrice,
                    medianData: p.medianData,
                    nextCompetitorPrice: p.nextCompetitorPrice,
                    nextCompetitorData: p.nextCompetitorData,
                    nextRangeChecked: p.nextRangeChecked,
                    isInEldoradoList: p.isInEldoradoList,
                    updatedAt: p.updatedAt
                };
            }
            
            return res.status(200).json({
                success: true,
                count: prices.length,
                requested: keyList.length,
                prices: pricesMap
            });
        }
        
        // Статистика кэша
        const stats = await collection.aggregate([
            {
                $group: {
                    _id: '$source',
                    count: { $sum: 1 },
                    avgPrice: { $avg: '$suggestedPrice' }
                }
            }
        ]).toArray();
        
        const totalCount = await collection.countDocuments();
        
        return res.status(200).json({
            success: true,
            totalPrices: totalCount,
            bySource: stats,
            usage: 'GET /api/prices-cache?all=true or ?keys=name1_income1,name2_income2 or ?since=timestamp'
        });
        
    } catch (error) {
        console.error('Prices cache error:', error);
        return res.status(500).json({ 
            error: error.message,
            success: false 
        });
    }
};
