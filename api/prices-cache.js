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
        
        const { keys, all, since, _ } = req.query;
        
        // v9.12.96: Если есть cache-buster параметр, не кэшируем
        const noCache = !!_;
        
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
            
            // v9.12.101: Убрали фильтр по времени для all=true
            // При начальной загрузке возвращаем ВСЕ цены
            // Клиент сам показывает "stale" статус для старых цен
            const filter = {};
            
            console.log(`[prices-cache] all=true - returning ALL prices (no time filter)`);
            
            const prices = await collection.find(filter, { projection }).toArray();
            
            console.log(`[prices-cache] Returned ${prices.length} prices`);
            
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
            // v9.12.96: Не кэшируем если есть cache-buster параметр
            // v10.3.6: More aggressive no-cache headers
            if (noCache) {
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            } else {
                res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
            }
            
            return res.status(200).json({
                success: true,
                count: prices.length,
                prices: pricesMap
            });
        }
        
        // Получить цены обновлённые после определённого времени
        if (since) {
            const sinceDate = new Date(parseInt(since));
            const serverNow = new Date();
            
            // Debug: log time comparison
            console.log(`[prices-cache] since=${sinceDate.toISOString()}, serverNow=${serverNow.toISOString()}, diff=${Math.round((serverNow - sinceDate)/1000)}s`);
            
            const prices = await collection.find({
                updatedAt: { $gt: sinceDate }
            }).toArray();
            
            // Debug: log a few sample updatedAt times
            if (prices.length > 0) {
                const sample = prices.slice(0, 3).map(p => `${p._id}: ${p.updatedAt?.toISOString()}`);
                console.log(`[prices-cache] Found ${prices.length} updated prices. Sample: ${sample.join(', ')}`);
            } else {
                // Check what's the latest updatedAt in the collection
                const latest = await collection.find({}).sort({ updatedAt: -1 }).limit(1).toArray();
                if (latest.length > 0) {
                    console.log(`[prices-cache] No prices found after ${sinceDate.toISOString()}. Latest updatedAt: ${latest[0].updatedAt?.toISOString()}`);
                }
            }
            
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
            
            // No caching for incremental updates
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            
            return res.status(200).json({
                success: true,
                count: prices.length,
                prices: pricesMap,
                since: sinceDate.toISOString(),
                serverTime: serverNow.toISOString()
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
