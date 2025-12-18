const { connectToDatabase, generateAvatar, generateUsername } = require('./_lib/db');

// Кэш аватаров в памяти (для serverless может не работать долго, но база - главный источник)
const avatarCache = new Map();
const AVATAR_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 дней

/**
 * Получить userId по username через Roblox API
 */
async function fetchUserIdByUsername(username) {
    try {
        const response = await fetch('https://users.roblox.com/v1/usernames/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usernames: [username],
                excludeBannedUsers: false
            })
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.data && data.data.length > 0 && data.data[0].id) {
            return String(data.data[0].id);
        }
    } catch (e) {
        console.warn('Failed to fetch userId for username', username, e.message);
    }
    return null;
}

/**
 * Загрузить аватар с Roblox API и конвертировать в base64
 */
async function fetchRobloxAvatarBase64(userId) {
    try {
        // Получаем URL аватара
        const apiResponse = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
        );
        const apiData = await apiResponse.json();
        
        if (!apiData.data?.[0]?.imageUrl) {
            return null;
        }
        
        const imageUrl = apiData.data[0].imageUrl;
        
        // Загружаем изображение и конвертируем в base64
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            return null;
        }
        
        const arrayBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        
        return `data:${contentType};base64,${base64}`;
    } catch (e) {
        console.warn('Failed to fetch avatar for userId', userId, e.message);
    }
    return null;
}

/**
 * Загрузить аватары для списка аккаунтов (с base64)
 */
async function fetchAvatarsForAccounts(accounts, existingAvatars = {}, avatarsCollection = null) {
    const avatars = { ...existingAvatars };
    const toFetch = [];
    
    for (const account of accounts) {
        if (!account.userId) continue;
        const key = String(account.userId);
        
        // Проверяем есть ли уже и не устарел ли (base64 аватары хранятся дольше)
        if (avatars[key] && avatars[key].timestamp && avatars[key].base64) {
            const age = Date.now() - avatars[key].timestamp;
            if (age < AVATAR_CACHE_TTL) {
                continue; // Аватар актуален
            }
        }
        
        // Проверяем в отдельной коллекции аватаров
        if (avatarsCollection) {
            const cached = await avatarsCollection.findOne({ userId: key });
            if (cached && cached.base64 && cached.fetchedAt) {
                const age = Date.now() - cached.fetchedAt;
                if (age < AVATAR_CACHE_TTL) {
                    avatars[key] = {
                        url: cached.base64,
                        base64: cached.base64,
                        timestamp: cached.fetchedAt
                    };
                    continue;
                }
            }
        }
        
        toFetch.push(account.userId);
    }
    
    // Загружаем недостающие аватары параллельно (макс 5 за раз чтобы не перегружать)
    const batchSize = 5;
    for (let i = 0; i < toFetch.length; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(userId => fetchRobloxAvatarBase64(userId)));
        
        for (let j = 0; j < batch.length; j++) {
            const userId = batch[j];
            const base64 = results[j];
            
            if (base64) {
                const key = String(userId);
                avatars[key] = {
                    url: base64,
                    base64: base64,
                    timestamp: Date.now()
                };
                
                // Сохраняем в отдельную коллекцию для постоянного хранения
                // Также сохраняем playerName для обратного маппинга
                if (avatarsCollection) {
                    // Находим playerName для этого userId
                    const accountWithName = accounts.find(a => String(a.userId) === key);
                    const updateData = {
                        userId: key,
                        base64: base64,
                        fetchedAt: Date.now(),
                        updatedAt: new Date()
                    };
                    // Добавляем playerName если есть
                    if (accountWithName && accountWithName.playerName) {
                        updateData.playerName = accountWithName.playerName;
                    }
                    await avatarsCollection.updateOne(
                        { userId: key },
                        { $set: updateData },
                        { upsert: true }
                    );
                }
            }
        }
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
                    accountAvatars: {}, // Хранилище аватаров аккаунтов (теперь с base64)
                    createdAt: new Date(),
                    lastUpdate: new Date()
                };
            }

            // Коллекция для постоянного хранения аватаров
            const avatarsCollection = db.collection('accountAvatars');
            
            // Загружаем аватары для аккаунтов
            const existingAccountAvatars = farmer.accountAvatars || {};
            
            // Проверяем для каких аккаунтов нужно загрузить аватары
            // Сначала проверяем отдельную коллекцию
            for (const account of accounts) {
                if (!account.userId) continue;
                const key = String(account.userId);
                
                // Если нет base64 - проверяем отдельную коллекцию
                if (!existingAccountAvatars[key] || !existingAccountAvatars[key].base64) {
                    const stored = await avatarsCollection.findOne({ userId: key });
                    if (stored && stored.base64) {
                        existingAccountAvatars[key] = {
                            url: stored.base64,
                            base64: stored.base64,
                            timestamp: stored.fetchedAt
                        };
                    }
                }
            }
            
            // Проверяем нужно ли загружать новые аватары с Roblox
            const needsAvatars = accounts.some(a => {
                if (!a.userId) return false;
                const cached = existingAccountAvatars[String(a.userId)];
                // Нужно загрузить если нет base64
                return !cached || !cached.base64;
            });
            
            let accountAvatars = existingAccountAvatars;
            if (needsAvatars) {
                // Загружаем аватары асинхронно, не блокируя ответ
                // Но для первого раза загрузим синхронно
                accountAvatars = await fetchAvatarsForAccounts(accounts, existingAccountAvatars, avatarsCollection);
            }

            // Создаём/обновляем маппинг playerName -> userId для фронтенда
            const playerUserIdMap = farmer.playerUserIdMap || {};
            for (const account of accounts) {
                if (account.userId && account.playerName) {
                    playerUserIdMap[account.playerName] = String(account.userId);
                }
                
                // ВАЖНО: Обновляем lastUpdate на СЕРВЕРНОЕ время для онлайн аккаунтов
                // Это гарантирует корректную проверку онлайн статуса независимо от часового пояса клиента
                if (account.isOnline) {
                    account.lastUpdate = new Date().toISOString();
                }
            }

            // Update farmer data
            farmer.accounts = accounts;
            farmer.accountAvatars = accountAvatars;
            farmer.playerUserIdMap = playerUserIdMap; // Сохраняем маппинг
            farmer.lastUpdate = new Date();
            farmer.lastTimestamp = timestamp;

            await farmersCollection.updateOne(
                { farmKey },
                { $set: farmer },
                { upsert: true }
            );
            
            // === АВТОМАТИЧЕСКОЕ СОХРАНЕНИЕ ИСТОРИИ БАЛАНСА ===
            // Подсчитываем общий баланс из аккаунтов
            let totalBalance = 0;
            for (const account of accounts) {
                if (account.balance !== undefined) {
                    const bal = parseFloat(account.balance) || 0;
                    totalBalance += bal;
                }
            }
            
            // Сохраняем в историю баланса если баланс > 0
            if (totalBalance > 0) {
                const balanceHistoryCollection = db.collection('balance_history');
                const now = new Date();
                
                // Проверяем последнюю запись
                const lastRecord = await balanceHistoryCollection.findOne(
                    { farmKey },
                    { sort: { timestamp: -1 } }
                );
                
                let shouldSave = true;
                if (lastRecord) {
                    const timeDiff = now.getTime() - lastRecord.timestamp.getTime();
                    // Не записываем чаще чем раз в 30 секунд
                    if (timeDiff < 30000) {
                        shouldSave = false;
                    }
                    // Не записываем если баланс не изменился существенно (< $0.1)
                    if (Math.abs(lastRecord.value - totalBalance) < 0.1) {
                        shouldSave = false;
                    }
                }
                
                if (shouldSave) {
                    await balanceHistoryCollection.insertOne({
                        farmKey,
                        value: totalBalance,
                        timestamp: now,
                        createdAt: now,
                        source: 'sync' // Помечаем что запись от sync
                    });
                    console.log(`Balance history saved: ${farmKey} = $${totalBalance.toFixed(2)}`);
                }
            }

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

            // Собираем аватары из farmer.accountAvatars и из отдельной коллекции accountAvatars
            const avatarsCollection = db.collection('accountAvatars');
            let accountAvatars = farmer.accountAvatars || {};
            
            // Создаём маппинг playerName -> userId из существующих данных аккаунтов
            let playerUserIdMap = farmer.playerUserIdMap || {};
            
            // Также строим маппинг из коллекции аватаров (там хранится playerName)
            const allAvatars = await avatarsCollection.find({}).toArray();
            for (const avatar of allAvatars) {
                if (avatar.playerName && avatar.userId) {
                    playerUserIdMap[avatar.playerName] = String(avatar.userId);
                }
            }
            
            // Для каждого аккаунта проверяем есть ли аватар в отдельной коллекции
            const accounts = farmer.accounts || [];
            for (const account of accounts) {
                // Обновляем маппинг для аккаунтов с userId
                if (account.userId && account.playerName) {
                    playerUserIdMap[account.playerName] = String(account.userId);
                }
                
                // Если у аккаунта нет userId и нет в маппинге - пробуем получить из Roblox API
                if (!account.userId && account.playerName && !playerUserIdMap[account.playerName]) {
                    const fetchedUserId = await fetchUserIdByUsername(account.playerName);
                    if (fetchedUserId) {
                        playerUserIdMap[account.playerName] = fetchedUserId;
                        // Также обновляем коллекцию аватаров для будущих запросов
                        await avatarsCollection.updateOne(
                            { userId: fetchedUserId },
                            { $set: { playerName: account.playerName } },
                            { upsert: false } // Только обновляем существующие записи
                        );
                    }
                }
                
                // Далее работаем только с аккаунтами у которых есть userId
                const userId = account.userId || playerUserIdMap[account.playerName];
                if (!userId) continue;
                const key = String(userId);
                
                // Если нет аватара или нет base64 - проверяем отдельную коллекцию
                if (!accountAvatars[key] || !accountAvatars[key].base64) {
                    const stored = await avatarsCollection.findOne({ userId: key });
                    if (stored && stored.base64) {
                        accountAvatars[key] = {
                            url: stored.base64,
                            base64: stored.base64,
                            timestamp: stored.fetchedAt
                        };
                    }
                }
            }

            return res.status(200).json({
                success: true,
                farmKey: farmer.farmKey,
                username: farmer.username,
                avatar: farmer.avatar,
                accounts: farmer.accounts || [],
                accountAvatars: accountAvatars, // Возвращаем аватары из обоих источников
                playerUserIdMap: playerUserIdMap, // Маппинг playerName -> userId (обновлённый)
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
