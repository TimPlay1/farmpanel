const { connectToDatabase } = require('./_lib/db');

/**
 * API для истории баланса v2.0
 * 
 * Новая архитектура:
 * - Записи хранятся в MongoDB с оптимальной структурой для агрегации
 * - Автоматическая очистка записей старше 30 дней
 * - Агрегация данных для разных периодов (RT, 1H, 24H, 7D, 30D)
 * - Cron может записывать баланс даже когда пользователь оффлайн
 * 
 * Структура записи:
 * {
 *   farmKey: string,
 *   value: number (баланс в $),
 *   timestamp: Date,
 *   source: 'client' | 'cron' (откуда пришла запись)
 * }
 * 
 * GET /api/balance-history-v2?farmKey=XXX&period=7d
 * POST /api/balance-history-v2 - сохранить запись
 * DELETE /api/balance-history-v2?farmKey=XXX - очистить
 */

// Периоды в миллисекундах
const PERIODS = {
    realtime: 5 * 60 * 1000,      // 5 минут
    hour: 60 * 60 * 1000,          // 1 час
    day: 24 * 60 * 60 * 1000,      // 24 часа
    week: 7 * 24 * 60 * 60 * 1000, // 7 дней
    month: 30 * 24 * 60 * 60 * 1000 // 30 дней
};

// Максимальное количество записей для разных периодов
const MAX_RECORDS = {
    realtime: 100,  // Показываем все точки
    hour: 60,       // Примерно 1 точка в минуту
    day: 288,       // 1 точка в 5 минут
    week: 336,      // 1 точка в 30 минут
    month: 720      // 1 точка в 1 час
};

// Минимальные интервалы между записями (для предотвращения спама)
const MIN_INTERVALS = {
    client: 10 * 1000,  // 10 секунд для записей от клиента
    cron: 60 * 1000     // 1 минута для записей от cron
};

/**
 * Агрегировать данные для периода
 * Уменьшает количество точек путём семплирования
 */
function aggregateForPeriod(records, period, maxPoints) {
    if (records.length <= maxPoints) return records;
    
    // Вычисляем шаг для равномерного семплирования
    const step = Math.ceil(records.length / maxPoints);
    const result = [];
    
    for (let i = 0; i < records.length; i += step) {
        // Берём среднее значение в окне для сглаживания
        const windowEnd = Math.min(i + step, records.length);
        let sum = 0;
        for (let j = i; j < windowEnd; j++) {
            sum += records[j].value;
        }
        result.push({
            timestamp: records[i].timestamp,
            value: sum / (windowEnd - i)
        });
    }
    
    // Всегда включаем последнюю точку
    const lastRecord = records[records.length - 1];
    if (result.length > 0 && result[result.length - 1].timestamp !== lastRecord.timestamp) {
        result.push({
            timestamp: lastRecord.timestamp,
            value: lastRecord.value
        });
    }
    
    return result;
}

/**
 * Определить период из строки
 */
function parsePeriod(periodStr) {
    if (!periodStr) return 'week';
    
    const str = periodStr.toLowerCase();
    if (str === 'rt' || str === 'realtime') return 'realtime';
    if (str === '1h' || str === 'hour') return 'hour';
    if (str === '24h' || str === 'day') return 'day';
    if (str === '7d' || str === 'week') return 'week';
    if (str === '30d' || str === 'month') return 'month';
    
    // Попробовать распарсить как число миллисекунд
    const ms = parseInt(str);
    if (!isNaN(ms)) {
        if (ms <= PERIODS.realtime) return 'realtime';
        if (ms <= PERIODS.hour) return 'hour';
        if (ms <= PERIODS.day) return 'day';
        if (ms <= PERIODS.week) return 'week';
        return 'month';
    }
    
    return 'week';
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { db } = await connectToDatabase();
        const collection = db.collection('balance_history');
        
        // v2.3: Создаём индекс для быстрого поиска (один раз)
        try {
            await collection.createIndex({ farmKey: 1, timestamp: -1 }, { background: true });
        } catch (e) {
            // Индекс уже существует - игнорируем
        }

        // ==================== GET ====================
        if (req.method === 'GET') {
            const { farmKey, period } = req.query;
            
            if (!farmKey) {
                return res.status(400).json({ error: 'Missing farmKey' });
            }

            const periodKey = parsePeriod(period);
            const periodMs = PERIODS[periodKey];
            const maxRecords = MAX_RECORDS[periodKey];
            const cutoffDate = new Date(Date.now() - periodMs);
            
            // Загружаем записи за период
            const records = await collection.find({
                farmKey,
                timestamp: { $gte: cutoffDate }
            }).sort({ timestamp: 1 }).toArray();
            
            // Агрегируем для уменьшения количества точек
            const aggregated = aggregateForPeriod(records, periodKey, maxRecords);
            
            // Рассчитываем изменение за период
            let change = null;
            if (aggregated.length >= 2) {
                const first = aggregated[0];
                const last = aggregated[aggregated.length - 1];
                const diff = last.value - first.value;
                const percent = first.value > 0 ? (diff / first.value) * 100 : 0;
                change = {
                    value: diff,
                    percent: percent,
                    from: first.value,
                    to: last.value
                };
            }
            
            return res.status(200).json({
                success: true,
                farmKey,
                period: periodKey,
                periodMs,
                history: aggregated.map(r => ({
                    timestamp: r.timestamp instanceof Date ? r.timestamp.getTime() : r.timestamp,
                    value: r.value
                })),
                count: aggregated.length,
                totalRecords: records.length,
                change
            });
        }

        // ==================== POST ====================
        if (req.method === 'POST') {
            const { farmKey, value, timestamp, source } = req.body;
            
            if (!farmKey || value === undefined || value === null) {
                return res.status(400).json({ error: 'Missing farmKey or value' });
            }

            const recordSource = source || 'client';
            const minInterval = MIN_INTERVALS[recordSource] || MIN_INTERVALS.client;
            const now = new Date();
            const recordTime = timestamp ? new Date(timestamp) : now;

            // Проверяем последнюю запись
            const lastRecord = await collection.findOne(
                { farmKey },
                { sort: { timestamp: -1 } }
            );

            if (lastRecord) {
                const timeDiff = recordTime.getTime() - lastRecord.timestamp.getTime();
                
                // Не записываем если прошло меньше минимального интервала
                if (timeDiff < minInterval) {
                    return res.status(200).json({ 
                        skipped: true, 
                        reason: 'Too frequent',
                        minInterval,
                        timeSinceLastRecord: timeDiff
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
            await collection.insertOne({
                farmKey,
                value: parseFloat(value),
                timestamp: recordTime,
                source: recordSource,
                createdAt: now
            });

            // ==================== АВТООЧИСТКА ====================
            // Удаляем записи старше 30 дней
            const thirtyDaysAgo = new Date(Date.now() - PERIODS.month);
            const deleteResult = await collection.deleteMany({
                farmKey,
                timestamp: { $lt: thirtyDaysAgo }
            });
            
            if (deleteResult.deletedCount > 0) {
                console.log(`🗑️ Cleaned ${deleteResult.deletedCount} old balance records for ${farmKey}`);
            }

            return res.status(200).json({ 
                success: true,
                saved: true,
                farmKey,
                value: parseFloat(value),
                timestamp: recordTime.getTime(),
                source: recordSource,
                cleanedRecords: deleteResult.deletedCount
            });
        }

        // ==================== DELETE ====================
        if (req.method === 'DELETE') {
            const { farmKey, secret, all } = req.query;
            
            const ADMIN_SECRET = 'cleanup-farmpanel-2024';
            if (secret !== ADMIN_SECRET) {
                return res.status(403).json({ error: 'Invalid secret' });
            }

            if (all === 'true') {
                const result = await collection.deleteMany({});
                return res.status(200).json({
                    success: true,
                    cleared: true,
                    deletedCount: result.deletedCount
                });
            }

            if (!farmKey) {
                return res.status(400).json({ error: 'Missing farmKey' });
            }

            const result = await collection.deleteMany({ farmKey });
            return res.status(200).json({
                success: true,
                cleared: true,
                farmKey,
                deletedCount: result.deletedCount
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Balance history v2 API error:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};
