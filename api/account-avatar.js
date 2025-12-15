const { connectToDatabase } = require('./_lib/db');

/**
 * API для получения и кэширования аватаров Roblox аккаунтов
 * Аватары хранятся как base64 в MongoDB для надёжности
 */

const AVATAR_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 дней

/**
 * Загрузить аватар с Roblox и конвертировать в base64
 */
async function fetchAndConvertAvatar(userId) {
    try {
        // Получаем URL аватара с Roblox API
        const apiResponse = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
        );
        const apiData = await apiResponse.json();
        
        if (!apiData.data?.[0]?.imageUrl) {
            return null;
        }
        
        const imageUrl = apiData.data[0].imageUrl;
        
        // Загружаем само изображение
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            return null;
        }
        
        const arrayBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        
        return {
            base64: `data:${contentType};base64,${base64}`,
            originalUrl: imageUrl,
            fetchedAt: Date.now()
        };
    } catch (e) {
        console.error('Failed to fetch avatar for', userId, e.message);
        return null;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { db } = await connectToDatabase();
        const avatarsCollection = db.collection('accountAvatars');

        // GET - Получить аватар по userId
        if (req.method === 'GET') {
            const { userId } = req.query;
            
            if (!userId) {
                return res.status(400).json({ error: 'Missing userId' });
            }

            // Ищем в базе
            const cached = await avatarsCollection.findOne({ userId: String(userId) });
            
            if (cached && cached.base64) {
                // Проверяем не устарел ли
                const age = Date.now() - (cached.fetchedAt || 0);
                if (age < AVATAR_MAX_AGE) {
                    return res.status(200).json({ 
                        avatarUrl: cached.base64,
                        cached: true,
                        age: age
                    });
                }
            }

            // Загружаем с Roblox
            const avatarData = await fetchAndConvertAvatar(userId);
            
            if (avatarData) {
                // Сохраняем в базу
                await avatarsCollection.updateOne(
                    { userId: String(userId) },
                    { 
                        $set: {
                            userId: String(userId),
                            base64: avatarData.base64,
                            originalUrl: avatarData.originalUrl,
                            fetchedAt: avatarData.fetchedAt,
                            updatedAt: new Date()
                        }
                    },
                    { upsert: true }
                );
                
                return res.status(200).json({ 
                    avatarUrl: avatarData.base64,
                    cached: false
                });
            }

            // Возвращаем старый кэш если есть
            if (cached && cached.base64) {
                return res.status(200).json({ 
                    avatarUrl: cached.base64,
                    cached: true,
                    stale: true
                });
            }

            return res.status(200).json({ avatarUrl: null });
        }

        // POST - Массовое обновление аватаров (вызывается при синхронизации)
        if (req.method === 'POST') {
            const { userIds } = req.body;
            
            if (!userIds || !Array.isArray(userIds)) {
                return res.status(400).json({ error: 'Missing userIds array' });
            }

            const results = {};
            const toFetch = [];

            // Проверяем кэш для каждого userId
            for (const userId of userIds) {
                const cached = await avatarsCollection.findOne({ userId: String(userId) });
                
                if (cached && cached.base64) {
                    const age = Date.now() - (cached.fetchedAt || 0);
                    if (age < AVATAR_MAX_AGE) {
                        results[userId] = cached.base64;
                        continue;
                    }
                }
                toFetch.push(userId);
            }

            // Загружаем недостающие (параллельно, макс 5 за раз)
            const batchSize = 5;
            for (let i = 0; i < toFetch.length; i += batchSize) {
                const batch = toFetch.slice(i, i + batchSize);
                const fetchResults = await Promise.all(
                    batch.map(userId => fetchAndConvertAvatar(userId))
                );
                
                for (let j = 0; j < batch.length; j++) {
                    const userId = batch[j];
                    const data = fetchResults[j];
                    
                    if (data) {
                        results[userId] = data.base64;
                        
                        // Сохраняем в базу
                        await avatarsCollection.updateOne(
                            { userId: String(userId) },
                            { 
                                $set: {
                                    userId: String(userId),
                                    base64: data.base64,
                                    originalUrl: data.originalUrl,
                                    fetchedAt: data.fetchedAt,
                                    updatedAt: new Date()
                                }
                            },
                            { upsert: true }
                        );
                    }
                }
            }

            return res.status(200).json({ 
                success: true,
                avatars: results,
                fetched: toFetch.length,
                cached: userIds.length - toFetch.length
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Account avatar error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
