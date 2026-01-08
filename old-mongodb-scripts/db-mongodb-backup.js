const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;
let connectionPromise = null; // Prevent multiple simultaneous connection attempts
let lastPingTime = 0;
const PING_INTERVAL = 30000; // Ping only every 30 seconds

// Retry helper with exponential backoff
async function withRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            // Retry on network/SSL errors
            const isRetryable = error.name === 'MongoNetworkError' || 
                               error.code === 'ECONNRESET' ||
                               error.message?.includes('SSL') ||
                               error.message?.includes('ETIMEDOUT');
            
            if (!isRetryable || attempt === maxRetries) {
                throw error;
            }
            
            const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
            console.log(`MongoDB connection attempt ${attempt} failed, retrying in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            
            // Clear cached connection on retry
            cachedClient = null;
            cachedDb = null;
            connectionPromise = null;
        }
    }
    throw lastError;
}

async function connectToDatabase() {
    // Return cached connection if available
    if (cachedDb && cachedClient) {
        // Only ping periodically to verify connection (not every request)
        const now = Date.now();
        if (now - lastPingTime < PING_INTERVAL) {
            return { client: cachedClient, db: cachedDb };
        }
        
        // Periodic health check
        try {
            await cachedClient.db('admin').command({ ping: 1 });
            lastPingTime = now;
            return { client: cachedClient, db: cachedDb };
        } catch (e) {
            console.log('Cached connection stale, reconnecting...');
            cachedClient = null;
            cachedDb = null;
            connectionPromise = null;
        }
    }

    // Prevent multiple simultaneous connection attempts
    if (connectionPromise) {
        return connectionPromise;
    }

    connectionPromise = withRetry(async () => {
        let uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        // Ensure proper connection string parameters
        if (!uri.includes('retryWrites')) {
            uri += (uri.includes('?') ? '&' : '?') + 'retryWrites=true&w=majority';
        }

        const client = new MongoClient(uri, {
            maxPoolSize: 5,        // Reduced from 10
            minPoolSize: 1,
            serverSelectionTimeoutMS: 10000,  // Reduced from 15000
            socketTimeoutMS: 45000,           // Reduced from 60000
            connectTimeoutMS: 20000,          // Reduced from 30000
            tls: true,
            tlsAllowInvalidCertificates: false,
            retryReads: true,
            retryWrites: true,
            maxIdleTimeMS: 30000,  // Close idle connections after 30s
        });
        
        await client.connect();
        
        const db = client.db('farmerpanel');
        
        cachedClient = client;
        cachedDb = db;
        lastPingTime = Date.now();
        
        console.log('MongoDB connected successfully');
        return { client, db };
    }, 3, 1000);
    
    try {
        const result = await connectionPromise;
        return result;
    } finally {
        connectionPromise = null;
    }
}

// Avatar icons - unique geometric patterns
const AVATAR_ICONS = [
    'fa-gem', 'fa-bolt', 'fa-fire', 'fa-star', 'fa-moon', 
    'fa-sun', 'fa-heart', 'fa-crown', 'fa-shield', 'fa-rocket',
    'fa-ghost', 'fa-dragon', 'fa-skull', 'fa-spider', 'fa-fish',
    'fa-cat', 'fa-dog', 'fa-dove', 'fa-crow', 'fa-frog',
    'fa-leaf', 'fa-tree', 'fa-snowflake', 'fa-cloud', 'fa-rainbow',
    'fa-diamond', 'fa-cube', 'fa-chess', 'fa-puzzle-piece', 'fa-dice'
];

// Unique colors for avatars
const AVATAR_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8B500', '#FF8C00', '#00CED1', '#FF69B4', '#32CD32',
    '#FFD700', '#FF4500', '#1E90FF', '#FF1493', '#00FF7F',
    '#DC143C', '#00BFFF', '#FF6347', '#7B68EE', '#3CB371',
    '#FF7F50', '#6495ED', '#FFB6C1', '#20B2AA', '#778899'
];

// Generate unique avatar for a farm key
function generateAvatar(existingAvatars = []) {
    const usedIcons = new Set(existingAvatars.map(a => a.icon));
    const usedColors = new Set(existingAvatars.map(a => a.color));
    
    // Find unused icon
    let icon = AVATAR_ICONS.find(i => !usedIcons.has(i));
    if (!icon) {
        icon = AVATAR_ICONS[Math.floor(Math.random() * AVATAR_ICONS.length)];
    }
    
    // Find unused color
    let color = AVATAR_COLORS.find(c => !usedColors.has(c));
    if (!color) {
        color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    }
    
    return { icon, color };
}

// Generate random username
function generateUsername() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `Aboba_${randomNum}`;
}

/**
 * Глобальный Rate Limiter для Gemini API
 * Хранит счётчики в MongoDB для координации между serverless инстансами
 * 
 * Лимиты gemma-3-27b-it:
 * - 15,000 tokens/min
 * - 30 requests/min
 * 
 * v2.5.1: Увеличены лимиты после исправления двойного учёта:
 * - 14,000 tokens/min (93%) - безопасный запас
 * - 28 requests/min (93%)
 */
const GLOBAL_RATE_LIMIT = {
    MAX_TOKENS_PER_MINUTE: 14000,
    MAX_REQUESTS_PER_MINUTE: 28,
    WINDOW_MS: 60000  // 1 минута
};

/**
 * Проверяет можно ли сделать AI запрос
 * @param {number} estimatedTokens - предполагаемое количество токенов
 * @returns {Promise<{allowed: boolean, waitMs?: number, currentTokens?: number, currentRequests?: number}>}
 */
async function checkGlobalRateLimit(estimatedTokens = 1500) {
    try {
        const { db } = await connectToDatabase();
        const collection = db.collection('rate_limits');
        
        const now = Date.now();
        const windowStart = now - GLOBAL_RATE_LIMIT.WINDOW_MS;
        
        // Получаем текущие счётчики за последнюю минуту
        const stats = await collection.aggregate([
            { $match: { timestamp: { $gte: windowStart } } },
            { $group: { 
                _id: null, 
                totalTokens: { $sum: '$tokens' },
                totalRequests: { $sum: 1 }
            }}
        ]).toArray();
        
        const currentTokens = stats[0]?.totalTokens || 0;
        const currentRequests = stats[0]?.totalRequests || 0;
        
        // Проверяем лимиты
        if (currentTokens + estimatedTokens > GLOBAL_RATE_LIMIT.MAX_TOKENS_PER_MINUTE) {
            // Находим самую старую запись чтобы понять когда освободится место
            const oldest = await collection.findOne(
                { timestamp: { $gte: windowStart } },
                { sort: { timestamp: 1 } }
            );
            const waitMs = oldest ? (oldest.timestamp + GLOBAL_RATE_LIMIT.WINDOW_MS - now + 1000) : 10000;
            
            return {
                allowed: false,
                reason: 'tokens',
                waitMs: Math.max(1000, waitMs),
                currentTokens,
                currentRequests,
                limit: GLOBAL_RATE_LIMIT.MAX_TOKENS_PER_MINUTE
            };
        }
        
        if (currentRequests >= GLOBAL_RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
            const oldest = await collection.findOne(
                { timestamp: { $gte: windowStart } },
                { sort: { timestamp: 1 } }
            );
            const waitMs = oldest ? (oldest.timestamp + GLOBAL_RATE_LIMIT.WINDOW_MS - now + 1000) : 10000;
            
            return {
                allowed: false,
                reason: 'requests',
                waitMs: Math.max(1000, waitMs),
                currentTokens,
                currentRequests,
                limit: GLOBAL_RATE_LIMIT.MAX_REQUESTS_PER_MINUTE
            };
        }
        
        return {
            allowed: true,
            currentTokens,
            currentRequests,
            remainingTokens: GLOBAL_RATE_LIMIT.MAX_TOKENS_PER_MINUTE - currentTokens,
            remainingRequests: GLOBAL_RATE_LIMIT.MAX_REQUESTS_PER_MINUTE - currentRequests
        };
        
    } catch (e) {
        console.error('Rate limit check error:', e.message);
        // При ошибке - разрешаем (лучше работать чем падать)
        return { allowed: true, error: e.message };
    }
}

/**
 * Записывает использование AI запроса
 * @param {number} tokens - количество использованных токенов
 * @param {string} source - источник запроса (ai-price, cron, etc)
 */
async function recordAIUsage(tokens, source = 'unknown') {
    try {
        const { db } = await connectToDatabase();
        const collection = db.collection('rate_limits');
        
        await collection.insertOne({
            timestamp: Date.now(),
            tokens,
            source,
            createdAt: new Date()
        });
        
        // Очищаем старые записи (старше 2 минут)
        const twoMinutesAgo = Date.now() - 120000;
        await collection.deleteMany({ timestamp: { $lt: twoMinutesAgo } });
        
    } catch (e) {
        console.error('Record AI usage error:', e.message);
    }
}

/**
 * Получает статистику использования AI
 */
async function getAIUsageStats() {
    try {
        const { db } = await connectToDatabase();
        const collection = db.collection('rate_limits');
        
        const now = Date.now();
        const windowStart = now - GLOBAL_RATE_LIMIT.WINDOW_MS;
        
        const stats = await collection.aggregate([
            { $match: { timestamp: { $gte: windowStart } } },
            { $group: { 
                _id: '$source',
                tokens: { $sum: '$tokens' },
                requests: { $sum: 1 }
            }}
        ]).toArray();
        
        const total = await collection.aggregate([
            { $match: { timestamp: { $gte: windowStart } } },
            { $group: { 
                _id: null,
                totalTokens: { $sum: '$tokens' },
                totalRequests: { $sum: 1 }
            }}
        ]).toArray();
        
        return {
            bySource: stats,
            total: {
                tokens: total[0]?.totalTokens || 0,
                requests: total[0]?.totalRequests || 0
            },
            limits: GLOBAL_RATE_LIMIT,
            usage: {
                tokensPercent: Math.round((total[0]?.totalTokens || 0) / GLOBAL_RATE_LIMIT.MAX_TOKENS_PER_MINUTE * 100),
                requestsPercent: Math.round((total[0]?.totalRequests || 0) / GLOBAL_RATE_LIMIT.MAX_REQUESTS_PER_MINUTE * 100)
            }
        };
    } catch (e) {
        console.error('Get AI usage stats error:', e.message);
        return null;
    }
}

/**
 * AI Price Cache в MongoDB
 * Позволяет хранить AI результаты между serverless инстансами
 */
const AI_CACHE_TTL_MS = 10 * 60 * 1000; // 10 минут

/**
 * Получает AI результат из MongoDB кэша
 * @param {string} cacheKey - ключ кэша (brainrot_income)
 */
async function getAICache(cacheKey) {
    try {
        const { db } = await connectToDatabase();
        const collection = db.collection('ai_price_cache');
        
        const cached = await collection.findOne({ 
            _id: cacheKey,
            timestamp: { $gt: Date.now() - AI_CACHE_TTL_MS }
        });
        
        return cached?.data || null;
    } catch (e) {
        console.error('Get AI cache error:', e.message);
        return null;
    }
}

/**
 * Сохраняет AI результат в MongoDB кэш
 * @param {string} cacheKey - ключ кэша
 * @param {object} data - данные для сохранения
 */
async function setAICache(cacheKey, data) {
    try {
        const { db } = await connectToDatabase();
        const collection = db.collection('ai_price_cache');
        
        await collection.updateOne(
            { _id: cacheKey },
            { 
                $set: { 
                    data, 
                    timestamp: Date.now(),
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
        
        return true;
    } catch (e) {
        console.error('Set AI cache error:', e.message);
        return false;
    }
}

/**
 * Очищает просроченные записи кэша (вызывать периодически)
 */
async function cleanupAICache() {
    try {
        const { db } = await connectToDatabase();
        const collection = db.collection('ai_price_cache');
        
        const result = await collection.deleteMany({
            timestamp: { $lt: Date.now() - AI_CACHE_TTL_MS * 2 }
        });
        
        if (result.deletedCount > 0) {
            console.log(`🗑️ Cleaned up ${result.deletedCount} expired AI cache entries`);
        }
        
        return result.deletedCount;
    } catch (e) {
        console.error('Cleanup AI cache error:', e.message);
        return 0;
    }
}

module.exports = {
    connectToDatabase,
    generateAvatar,
    generateUsername,
    AVATAR_ICONS,
    AVATAR_COLORS,
    // Global rate limiter
    checkGlobalRateLimit,
    recordAIUsage,
    getAIUsageStats,
    GLOBAL_RATE_LIMIT,
    // AI Price Cache
    getAICache,
    setAICache,
    cleanupAICache,
    AI_CACHE_TTL_MS
};
