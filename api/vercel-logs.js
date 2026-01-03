/**
 * Vercel Log Drain API Endpoint
 * 
 * Принимает логи от Vercel Log Drain и сохраняет их в MongoDB.
 * 
 * GET /api/vercel-logs - получить последние логи
 * GET /api/vercel-logs?limit=100 - указать количество логов
 * GET /api/vercel-logs?level=error - фильтр по уровню (error, warn, info)
 * GET /api/vercel-logs?path=/api/ai-price - фильтр по пути
 * GET /api/vercel-logs?search=keyword - поиск по тексту
 * GET /api/vercel-logs?since=1704326400000 - логи после timestamp
 * POST /api/vercel-logs - webhook для приёма логов от Vercel
 * DELETE /api/vercel-logs - очистить старые логи (старше 24 часов)
 */

const { connectToDatabase } = require('./_lib/db');
const crypto = require('crypto');

// Signature verification secret (задайте в Vercel Log Drain настройках)
const VERCEL_SIGNATURE_SECRET = process.env.VERCEL_LOG_DRAIN_SECRET || 'cKVDJsQv4wJS1yGr8u1b2e9BKhkssNHf';

// Максимальное количество логов для хранения
const MAX_LOGS = 10000;
const MAX_AGE_HOURS = 48; // Хранить логи 48 часов

/**
 * Верифицирует подпись от Vercel
 */
function verifySignature(payload, signature) {
    if (!VERCEL_SIGNATURE_SECRET || !signature) return true; // Если секрет не настроен, пропускаем
    
    try {
        const expectedSignature = crypto
            .createHmac('sha1', VERCEL_SIGNATURE_SECRET)
            .update(payload, 'utf8')
            .digest('hex');
        
        return signature === `sha1=${expectedSignature}` || signature === expectedSignature;
    } catch (e) {
        console.error('Signature verification error:', e);
        return false;
    }
}

/**
 * Парсит уровень лога из сообщения
 */
function parseLogLevel(message, source) {
    if (!message) return 'info';
    const msg = message.toLowerCase();
    
    if (msg.includes('error') || msg.includes('❌') || msg.includes('failed') || msg.includes('exception')) {
        return 'error';
    }
    if (msg.includes('warn') || msg.includes('⚠️') || msg.includes('warning')) {
        return 'warn';
    }
    if (source === 'stderr') return 'error';
    return 'info';
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Vercel-Signature, x-vercel-signature');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const { db } = await connectToDatabase();
        const logsCollection = db.collection('vercel_logs');
        
        // Создаём индексы при первом запуске
        try {
            await logsCollection.createIndex({ timestamp: -1 });
            await logsCollection.createIndex({ level: 1 });
            await logsCollection.createIndex({ path: 1 });
            await logsCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: MAX_AGE_HOURS * 3600 }); // TTL индекс
        } catch (e) {
            // Индексы уже существуют
        }
        
        // GET - получить логи
        if (req.method === 'GET') {
            const { 
                limit = 100, 
                level, 
                path, 
                search, 
                since,
                status,
                method: httpMethod
            } = req.query;
            
            const query = {};
            
            if (level) query.level = level;
            if (path) query.path = { $regex: path, $options: 'i' };
            if (search) query.message = { $regex: search, $options: 'i' };
            if (since) query.timestamp = { $gte: parseInt(since) };
            if (status) query.statusCode = parseInt(status);
            if (httpMethod) query.method = httpMethod.toUpperCase();
            
            const logs = await logsCollection
                .find(query)
                .sort({ timestamp: -1 })
                .limit(Math.min(parseInt(limit), 1000))
                .toArray();
            
            // Статистика
            const stats = await logsCollection.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$level',
                        count: { $sum: 1 }
                    }
                }
            ]).toArray();
            
            const levelCounts = {};
            stats.forEach(s => levelCounts[s._id] = s.count);
            
            return res.json({
                success: true,
                logs,
                total: logs.length,
                stats: levelCounts,
                query: Object.keys(query).length > 0 ? query : null
            });
        }
        
        // POST - принять логи от Vercel (webhook)
        if (req.method === 'POST') {
            // Получаем raw body для верификации
            const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            const signature = req.headers['x-vercel-signature'];
            
            // Верифицируем подпись
            if (VERCEL_SIGNATURE_SECRET && !verifySignature(bodyStr, signature)) {
                console.warn('Invalid Vercel signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }
            
            let logs = req.body;
            
            // Vercel отправляет массив логов или один объект
            if (!Array.isArray(logs)) {
                logs = [logs];
            }
            
            // Парсим и сохраняем логи
            const docsToInsert = [];
            const now = Date.now();
            
            for (const log of logs) {
                // Vercel Log Drain NDJSON формат:
                // {
                //   "id": "...",
                //   "message": "...",
                //   "timestamp": 1234567890,
                //   "source": "lambda" | "edge" | "static" | "external",
                //   "proxy": { "statusCode": 200, "path": "/api/test", "method": "GET", ... }
                // }
                
                const doc = {
                    vercelId: log.id,
                    message: log.message || '',
                    timestamp: log.timestamp || now,
                    source: log.source || 'unknown',
                    level: parseLogLevel(log.message, log.source),
                    createdAt: new Date(), // Для TTL индекса
                    
                    // Proxy данные (HTTP запрос)
                    path: log.proxy?.path || log.path || null,
                    method: log.proxy?.method || log.method || null,
                    statusCode: log.proxy?.statusCode || log.statusCode || null,
                    host: log.proxy?.host || log.host || null,
                    userAgent: log.proxy?.userAgent || null,
                    
                    // Дополнительные поля
                    deploymentId: log.deploymentId || null,
                    projectName: log.projectName || 'farmpanel',
                    region: log.proxy?.region || null,
                    duration: log.proxy?.duration || null, // ms
                    
                    // Raw log для отладки
                    raw: log
                };
                
                docsToInsert.push(doc);
            }
            
            if (docsToInsert.length > 0) {
                await logsCollection.insertMany(docsToInsert, { ordered: false });
                
                // Ограничиваем количество логов
                const totalCount = await logsCollection.countDocuments();
                if (totalCount > MAX_LOGS) {
                    const deleteCount = totalCount - MAX_LOGS;
                    const oldestLogs = await logsCollection
                        .find({})
                        .sort({ timestamp: 1 })
                        .limit(deleteCount)
                        .project({ _id: 1 })
                        .toArray();
                    
                    const idsToDelete = oldestLogs.map(l => l._id);
                    await logsCollection.deleteMany({ _id: { $in: idsToDelete } });
                }
            }
            
            return res.json({
                success: true,
                received: logs.length,
                inserted: docsToInsert.length
            });
        }
        
        // DELETE - очистить логи
        if (req.method === 'DELETE') {
            const { older_than_hours = 24, level, all } = req.query;
            
            let query = {};
            
            if (all === 'true') {
                // Удалить все
                query = {};
            } else {
                // Удалить старые
                const cutoff = Date.now() - (parseInt(older_than_hours) * 3600 * 1000);
                query.timestamp = { $lt: cutoff };
                
                if (level) {
                    query.level = level;
                }
            }
            
            const result = await logsCollection.deleteMany(query);
            
            return res.json({
                success: true,
                deleted: result.deletedCount,
                query
            });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Vercel logs error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
};
