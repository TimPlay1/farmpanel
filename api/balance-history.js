const { connectToDatabase } = require('./_lib/db');

/**
 * API для истории баланса
 * GET /api/balance-history?farmKey=XXX - получить историю
 * POST /api/balance-history - сохранить запись истории
 * DELETE /api/balance-history?farmKey=XXX&secret=XXX - очистить историю фермера
 */

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (!process.env.MYSQL_URI) {
            return res.status(500).json({ error: 'Database not configured' });
        }

        const { db } = await connectToDatabase();
        const balanceHistoryCollection = db.collection('balance_history');

        // GET - Получить историю баланса
        if (req.method === 'GET') {
            const { farmKey, period, limit } = req.query;
            
            if (!farmKey) {
                return res.status(400).json({ error: 'Missing farmKey' });
            }

            // Определяем период запроса (по умолчанию 30 дней)
            const periodMs = period ? parseInt(period) : 30 * 24 * 60 * 60 * 1000;
            const cutoffDate = new Date(Date.now() - periodMs);
            
            // v9.12.30: Ограничиваем количество записей (по умолчанию 1000)
            const maxRecords = limit ? Math.min(parseInt(limit), 5000) : 1000;

            // Сначала считаем общее количество
            const totalCount = await balanceHistoryCollection.countDocuments({
                farmKey,
                timestamp: { $gte: cutoffDate }
            });
            
            // Загружаем последние N записей (сортируем по убыванию, потом разворачиваем)
            let history;
            if (totalCount > maxRecords) {
                // Много записей - берём последние maxRecords
                history = await balanceHistoryCollection.find({
                    farmKey,
                    timestamp: { $gte: cutoffDate }
                }).sort({ timestamp: -1 }).limit(maxRecords).toArray();
                history.reverse(); // Разворачиваем для правильного порядка
            } else {
                // Мало записей - берём все
                history = await balanceHistoryCollection.find({
                    farmKey,
                    timestamp: { $gte: cutoffDate }
                }).sort({ timestamp: 1 }).toArray();
            }

            return res.status(200).json({
                farmKey,
                history: history.map(h => ({
                    timestamp: h.timestamp.getTime(),
                    value: h.value
                })),
                count: history.length,
                totalCount: totalCount // v9.12.30: Добавляем общее количество для информации
            });
        }

        // POST - Сохранить запись истории
        if (req.method === 'POST') {
            const { farmKey, value, timestamp } = req.body;
            
            if (!farmKey || value === undefined) {
                return res.status(400).json({ error: 'Missing farmKey or value' });
            }

            const now = new Date();
            const recordTime = timestamp ? new Date(timestamp) : now;

            // Проверяем последнюю запись - не записываем чаще чем раз в 10 секунд
            const lastRecord = await balanceHistoryCollection.findOne(
                { farmKey },
                { sort: { timestamp: -1 } }
            );

            if (lastRecord) {
                const timeDiff = recordTime.getTime() - lastRecord.timestamp.getTime();
                // Не записываем если прошло меньше 10 секунд
                if (timeDiff < 10000) {
                    return res.status(200).json({ 
                        skipped: true, 
                        reason: 'Too frequent',
                        lastTimestamp: lastRecord.timestamp.getTime()
                    });
                }
                // Не записываем если баланс не изменился (разница < $0.01)
                if (Math.abs(lastRecord.value - value) < 0.01) {
                    return res.status(200).json({ 
                        skipped: true, 
                        reason: 'Balance unchanged',
                        lastValue: lastRecord.value
                    });
                }
            }

            // Сохраняем запись
            await balanceHistoryCollection.insertOne({
                farmKey,
                value: parseFloat(value),
                timestamp: recordTime,
                createdAt: now
            });

            // Ограничиваем количество записей на фермера (макс 5000)
            const count = await balanceHistoryCollection.countDocuments({ farmKey });
            if (count > 5000) {
                // Удаляем самые старые записи
                const toDelete = await balanceHistoryCollection.find({ farmKey })
                    .sort({ timestamp: 1 })
                    .limit(count - 4000)
                    .toArray();
                
                if (toDelete.length > 0) {
                    await balanceHistoryCollection.deleteMany({
                        _id: { $in: toDelete.map(d => d._id) }
                    });
                }
            }

            return res.status(200).json({ 
                saved: true,
                farmKey,
                value,
                timestamp: recordTime.getTime()
            });
        }

        // DELETE - Очистить историю
        if (req.method === 'DELETE') {
            const { farmKey, secret, all } = req.query;
            
            // Проверка секрета
            const ADMIN_SECRET = 'cleanup-farmpanel-2024';
            if (secret !== ADMIN_SECRET) {
                return res.status(403).json({ error: 'Invalid secret' });
            }

            if (all === 'true') {
                // Очистить ВСЮ историю всех фермеров
                const result = await balanceHistoryCollection.deleteMany({});
                return res.status(200).json({
                    cleared: true,
                    deletedCount: result.deletedCount,
                    message: 'All balance history cleared'
                });
            }

            if (!farmKey) {
                return res.status(400).json({ error: 'Missing farmKey or all=true' });
            }

            // Очистить историю конкретного фермера
            const result = await balanceHistoryCollection.deleteMany({ farmKey });
            return res.status(200).json({
                cleared: true,
                farmKey,
                deletedCount: result.deletedCount
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Balance history API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
