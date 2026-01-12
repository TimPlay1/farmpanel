const { connectToDatabase } = require('./_lib/db');

// TTL для spike detection в POST (5 минут) - если цена старше, не сравниваем для spike
const SPIKE_DETECTION_TTL = 5 * 60 * 1000;

// TTL для GET запросов (1 час) - показываем последние известные цены даже если cron не работал
// Это предотвращает пустые цены когда панель неактивна
const GET_CACHE_TTL = 60 * 60 * 1000;

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (!process.env.MYSQL_URI) {
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
            
            // v9.12.92: Removed strict price limits - eldorado-price.js has dynamic limits
            // High-income brainrots can legitimately cost $2000+
            // Only keep a very high sanity check to catch obvious bugs
            const ABSOLUTE_MAX_PRICE = 10000; // $10k absolute max
            
            // Сохраняем каждую цену отдельно в глобальный кэш
            for (const [cacheKey, priceData] of Object.entries(prices)) {
                if (priceData && priceData.suggestedPrice) {
                    const prev = existingMap.get(cacheKey);
                    const prevPrice = prev?.suggestedPrice || null;
                    
                    // v9.12.92: Use dynamic limit if provided, otherwise use absolute max
                    const maxLimit = priceData.dynamicMaxPrice || ABSOLUTE_MAX_PRICE;
                    
                    // SANITY CHECK: если цена превышает лимит - отклоняем
                    if (priceData.suggestedPrice > maxLimit) {
                        console.error(`🚨 PRICES API: Rejecting price $${priceData.suggestedPrice} for ${cacheKey} - exceeds limit $${maxLimit}`);
                        continue; // Пропускаем эту цену
                    }
                    
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
                    } else if (!prevPrice && priceData.suggestedPrice > 10) {
                        // НОВАЯ ЗАЩИТА: если нет предыдущей цены, но новая > $10 - подозрительно
                        // Для большинства Secret брейнротов цена < $10
                        console.warn(`⚠️ PRICES API: First price $${priceData.suggestedPrice} for ${cacheKey} is suspiciously high`);
                        // Не блокируем, но помечаем
                        isSpike = true;
                        spikeDetectedAt = now;
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
            
            // v10.3.48: Используем GET_CACHE_TTL (1 час) чтобы всегда показывать последние известные цены
            // Это предотвращает пустые цены когда cron не работал или был rate limited
            const minDate = new Date(Date.now() - GET_CACHE_TTL);
            query.updatedAt = { $gte: minDate };
            
            const cached = await globalPricesCollection.find(query).toArray();
            
            // Преобразуем в объект { cacheKey: priceData }
            const prices = {};
            let oldestTimestamp = null;
            const now = Date.now();
            const staleThreshold = 5 * 60 * 1000; // 5 минут - после этого помечаем как stale
            
            for (const item of cached) {
                const itemTimestamp = new Date(item.updatedAt).getTime();
                const isStale = (now - itemTimestamp) > staleThreshold;
                
                prices[item.cacheKey] = {
                    suggestedPrice: item.suggestedPrice,
                    previousPrice: item.previousPrice || null,
                    pendingPrice: item.pendingPrice || null,
                    isSpike: item.isSpike || false,
                    spikeDetectedAt: item.spikeDetectedAt || null,
                    competitorPrice: item.competitorPrice,
                    competitorIncome: item.competitorIncome,
                    priceSource: item.priceSource,
                    isStale: isStale, // v10.3.48: Помечаем устаревшие цены
                    updatedAt: itemTimestamp // v10.3.48: Время последнего обновления
                };
                
                if (!oldestTimestamp || itemTimestamp < oldestTimestamp) {
                    oldestTimestamp = itemTimestamp;
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
