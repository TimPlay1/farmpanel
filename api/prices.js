const { connectToDatabase } = require('./_lib/db');

// Глобальный кэш цен для всех пользователей (5 минут TTL)
const PRICE_CACHE_TTL = 5 * 60 * 1000;

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (!process.env.MONGODB_URI) {
            return res.status(500).json({ error: 'Database not configured' });
        }

        const { db } = await connectToDatabase();
        const globalPricesCollection = db.collection('global_brainrot_prices');
        const farmersCollection = db.collection('farmers');

        // POST - Save prices to global cache
        if (req.method === 'POST') {
            const { farmKey, prices, totalValue } = req.body;
            
            if (!prices || typeof prices !== 'object') {
                return res.status(400).json({ error: 'Missing prices' });
            }

            const now = new Date();
            const bulkOps = [];
            
            // Сначала получаем текущие цены для детекции spike
            const existingKeys = Object.keys(prices);
            const existing = await globalPricesCollection.find({ 
                cacheKey: { $in: existingKeys } 
            }).toArray();
            const existingMap = new Map(existing.map(e => [e.cacheKey, e]));
            
            // Сохраняем каждую цену отдельно в глобальный кэш
            for (const [cacheKey, priceData] of Object.entries(prices)) {
                if (priceData && priceData.suggestedPrice) {
                    const prev = existingMap.get(cacheKey);
                    const prevPrice = prev?.suggestedPrice || null;
                    
                    // Детектим spike - если изменение > 100%
                    let isSpike = false;
                    let spikeDetectedAt = prev?.spikeDetectedAt || null;
                    
                    if (prevPrice && prevPrice > 0) {
                        const changePercent = Math.abs((priceData.suggestedPrice - prevPrice) / prevPrice * 100);
                        if (changePercent > 100) {
                            isSpike = true;
                            // Если spike уже был детектирован ранее, проверяем прошло ли 5 минут
                            if (spikeDetectedAt) {
                                const spikeAge = now.getTime() - new Date(spikeDetectedAt).getTime();
                                if (spikeAge > 5 * 60 * 1000) {
                                    // Прошло 5 минут, spike подтверждён - обновляем цену
                                    isSpike = false;
                                    spikeDetectedAt = null;
                                }
                            } else {
                                // Новый spike - запоминаем время
                                spikeDetectedAt = now;
                            }
                        } else {
                            // Нет spike - сбрасываем
                            spikeDetectedAt = null;
                        }
                    }
                    
                    const updateData = { 
                        cacheKey,
                        suggestedPrice: isSpike ? (prevPrice || priceData.suggestedPrice) : priceData.suggestedPrice,
                        previousPrice: prevPrice,
                        pendingPrice: isSpike ? priceData.suggestedPrice : null,
                        isSpike: isSpike,
                        spikeDetectedAt: spikeDetectedAt,
                        competitorPrice: priceData.competitorPrice,
                        competitorIncome: priceData.competitorIncome,
                        priceSource: priceData.priceSource,
                        updatedAt: now
                    };
                    
                    bulkOps.push({
                        updateOne: {
                            filter: { cacheKey },
                            update: { $set: updateData },
                            upsert: true
                        }
                    });
                }
            }
            
            if (bulkOps.length > 0) {
                await globalPricesCollection.bulkWrite(bulkOps);
            }

            // Если передан farmKey и totalValue, обновляем в документе фермера
            if (farmKey && typeof totalValue === 'number' && totalValue >= 0) {
                await farmersCollection.updateOne(
                    { farmKey },
                    { 
                        $set: { 
                            totalValue: totalValue,
                            valueUpdatedAt: now
                        }
                    }
                );
            }

            return res.status(200).json({ success: true, saved: bulkOps.length });
        }

        // GET - Get cached prices (глобальный кэш)
        if (req.method === 'GET') {
            const { keys, farmKey } = req.query;
            
            // Если переданы конкретные ключи - возвращаем только их
            let query = {};
            if (keys) {
                const keyList = keys.split(',').map(k => k.trim()).filter(k => k);
                if (keyList.length > 0) {
                    query = { cacheKey: { $in: keyList } };
                }
            }
            
            // Проверяем TTL - возвращаем только свежие записи
            const minDate = new Date(Date.now() - PRICE_CACHE_TTL);
            query.updatedAt = { $gte: minDate };
            
            const cached = await globalPricesCollection.find(query).toArray();
            
            // Преобразуем в объект { cacheKey: priceData }
            const prices = {};
            let oldestTimestamp = null;
            
            for (const item of cached) {
                prices[item.cacheKey] = {
                    suggestedPrice: item.suggestedPrice,
                    previousPrice: item.previousPrice || null,
                    pendingPrice: item.pendingPrice || null,
                    isSpike: item.isSpike || false,
                    spikeDetectedAt: item.spikeDetectedAt || null,
                    competitorPrice: item.competitorPrice,
                    competitorIncome: item.competitorIncome,
                    priceSource: item.priceSource
                };
                const ts = new Date(item.updatedAt).getTime();
                if (!oldestTimestamp || ts < oldestTimestamp) {
                    oldestTimestamp = ts;
                }
            }

            return res.status(200).json({ 
                prices,
                count: cached.length,
                oldestTimestamp
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Prices API error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
