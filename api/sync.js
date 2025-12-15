const { connectToDatabase, generateAvatar, generateUsername } = require('./_lib/db');

// Кэш аватаров в памяти (для serverless может не работать долго, но база - главный источник)
const avatarCache = new Map();
const AVATAR_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

/**
 * Загрузить аватар с Roblox API
 */
async function fetchRobloxAvatar(userId) {
    try {
        const response = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
        );
        const data = await response.json();
        if (data.data && data.data[0] && data.data[0].imageUrl) {
            return data.data[0].imageUrl;
        }
    } catch (e) {
        console.warn('Failed to fetch avatar for userId', userId, e.message);
    }
    return null;
}

/**
 * Загрузить аватары для списка аккаунтов
 */
async function fetchAvatarsForAccounts(accounts, existingAvatars = {}) {
    const avatars = { ...existingAvatars };
    const toFetch = [];
    
    for (const account of accounts) {
        if (!account.userId) continue;
        const key = String(account.userId);
        
        // Проверяем есть ли уже в базе и не устарел ли
        if (avatars[key] && avatars[key].timestamp) {
            const age = Date.now() - avatars[key].timestamp;
            if (age < AVATAR_CACHE_TTL) {
                continue; // Аватар актуален
            }
        }
        
        toFetch.push(account.userId);
    }
    
    // Загружаем недостающие аватары параллельно (макс 10 за раз)
    const batchSize = 10;
    for (let i = 0; i < toFetch.length; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(userId => fetchRobloxAvatar(userId)));
        
        results.forEach((url, idx) => {
            if (url) {
                avatars[String(batch[idx])] = {
                    url: url,
                    timestamp: Date.now()
                };
            }
        });
    }
    
    return avatars;
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Check if MONGODB_URI is set
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI not configured');
            return res.status(500).json({ error: 'Database not configured' });
        }

        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');

        // POST - Sync data from Lua script
        if (req.method === 'POST') {
            const { farmKey, accounts, timestamp } = req.body;
            
            if (!farmKey || !accounts) {
                return res.status(400).json({ error: 'Missing farmKey or accounts' });
            }

            // Get existing farmer or create new
            let farmer = await farmersCollection.findOne({ farmKey });
            
            if (!farmer) {
                // Get all existing avatars to ensure uniqueness
                const allFarmers = await farmersCollection.find({}).toArray();
                const existingAvatars = allFarmers.map(f => f.avatar);
                
                farmer = {
                    farmKey,
                    username: generateUsername(),
                    avatar: generateAvatar(existingAvatars),
                    accounts: [],
                    accountAvatars: {}, // Хранилище аватаров аккаунтов
                    createdAt: new Date(),
                    lastUpdate: new Date()
                };
            }

            // Загружаем аватары для аккаунтов (в фоне, не блокируя ответ)
            const existingAccountAvatars = farmer.accountAvatars || {};
            
            // Синхронно загружаем только если аватаров мало или их нет
            const needsAvatars = accounts.some(a => {
                if (!a.userId) return false;
                const cached = existingAccountAvatars[String(a.userId)];
                return !cached || !cached.url;
            });
            
            let accountAvatars = existingAccountAvatars;
            if (needsAvatars) {
                accountAvatars = await fetchAvatarsForAccounts(accounts, existingAccountAvatars);
            }

            // Update farmer data
            farmer.accounts = accounts;
            farmer.accountAvatars = accountAvatars;
            farmer.lastUpdate = new Date();
            farmer.lastTimestamp = timestamp;

            await farmersCollection.updateOne(
                { farmKey },
                { $set: farmer },
                { upsert: true }
            );

            return res.status(200).json({ 
                success: true, 
                username: farmer.username,
                avatar: farmer.avatar
            });
        }

        // GET - Get farmer data by key
        if (req.method === 'GET') {
            const { key } = req.query;
            
            if (!key) {
                return res.status(400).json({ error: 'Missing farm key' });
            }

            const farmer = await farmersCollection.findOne({ farmKey: key });
            
            if (!farmer) {
                return res.status(404).json({ error: 'Farm key not found' });
            }

            return res.status(200).json({
                success: true,
                farmKey: farmer.farmKey,
                username: farmer.username,
                avatar: farmer.avatar,
                accounts: farmer.accounts || [],
                accountAvatars: farmer.accountAvatars || {}, // Возвращаем аватары аккаунтов
                lastUpdate: farmer.lastUpdate,
                totalValue: farmer.totalValue || 0,
                valueUpdatedAt: farmer.valueUpdatedAt || null
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Sync error:', error.message, error.stack);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};
