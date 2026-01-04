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
    // CORS headers - максимально разрешающие для Roblox эксплоитов
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent, Content-Length, X-Farm-Key, X-Sync-Data');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    // Disable caching for real-time data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Handle preflight OPTIONS request
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

        // ============ SYNC DATA EXTRACTION ============
        // Поддерживаем несколько способов получения данных для sync:
        // 1. POST с JSON body (стандартный)
        // 2. PUT с JSON body (альтернатива POST)
        // 3. GET с ?data=base64 параметром (обход блокировок POST)
        // 4. GET с ?farmKey=X&syncData=base64 (ещё один вариант)
        
        let syncData = null;
        let isSyncRequest = false;
        
        // POST или PUT с body
        if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
            if (req.body.farmKey && req.body.accounts) {
                syncData = req.body;
                isSyncRequest = true;
            }
        }
        
        // GET с base64 данными (обход блокировки POST)
        if (req.method === 'GET' && (req.query.data || req.query.syncData)) {
            try {
                let base64Data = req.query.data || req.query.syncData;
                // Конвертируем base64url в стандартный base64
                base64Data = base64Data.replace(/-/g, '+').replace(/_/g, '/');
                // Добавляем padding если нужно
                while (base64Data.length % 4) {
                    base64Data += '=';
                }
                const jsonString = Buffer.from(base64Data, 'base64').toString('utf8');
                const parsed = JSON.parse(jsonString);
                if (parsed.farmKey && parsed.accounts) {
                    syncData = parsed;
                    isSyncRequest = true;
                    console.log('[SYNC] Received GET-based sync request (base64url), accounts:', parsed.accounts?.length || 0);
                }
            } catch (e) {
                console.error('[SYNC] Failed to parse base64 data:', e.message);
            }
        }
        
        // GET с farmKey в header или query (для простого ping/update)
        if (req.method === 'GET' && req.query.farmKey && req.headers['x-sync-data']) {
            try {
                const base64Data = req.headers['x-sync-data'];
                const jsonString = Buffer.from(base64Data, 'base64').toString('utf8');
                const parsed = JSON.parse(jsonString);
                parsed.farmKey = req.query.farmKey;
                if (parsed.accounts) {
                    syncData = parsed;
                    isSyncRequest = true;
                    console.log('[SYNC] Received header-based sync request');
                }
            } catch (e) {
                console.error('[SYNC] Failed to parse header data:', e.message);
            }
        }

        // ============ PROCESS SYNC REQUEST ============
        if (isSyncRequest && syncData) {
            const { farmKey, accounts, timestamp } = syncData;
            
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
            const now = new Date();
            for (const account of accounts) {
                if (account.userId && account.playerName) {
                    playerUserIdMap[account.playerName] = String(account.userId);
                }
                
                // Конвертируем lastUpdate в ISO формат если нужно
                // panel_sync.lua отправляет формат "2025-12-21 17:02:06" (локальное время UTC+3)
                if (account.lastUpdate && typeof account.lastUpdate === 'string') {
                    // Проверяем формат
                    if (account.lastUpdate.includes(' ') && !account.lastUpdate.includes('T')) {
                        // Формат "2025-12-21 17:02:06" - парсим как локальное время (без Z)
                        // JavaScript Date() без Z парсит как локальное время сервера
                        // Но Vercel в UTC, поэтому вычитаем offset для Moscow (UTC+3)
                        const localTime = new Date(account.lastUpdate.replace(' ', 'T'));
                        // Вычитаем 3 часа т.к. время в файле Moscow (UTC+3), а сервер в UTC
                        const utcTime = new Date(localTime.getTime() - 3 * 60 * 60 * 1000);
                        account.lastUpdate = utcTime.toISOString();
                    }
                    // Иначе оставляем как есть (уже ISO)
                }
            }

            // MERGE accounts: сохраняем всех фермеров в БД, обновляем данные тех кто пришёл в sync
            // Это позволяет всем фермерам оставаться в панели даже когда они offline
            const existingAccounts = farmer.accounts || [];
            const existingByName = {};
            for (const acc of existingAccounts) {
                if (acc.playerName) {
                    existingByName[acc.playerName] = acc;
                }
            }
            
            // Обновляем/добавляем пришедшие аккаунты
            for (const acc of accounts) {
                if (acc.playerName) {
                    existingByName[acc.playerName] = acc;
                }
            }
            
            // Собираем обратно в массив
            const mergedAccounts = Object.values(existingByName);

            // Update farmer data
            farmer.accounts = mergedAccounts;
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
                avatar: farmer.avatar,
                method: req.method // Для отладки - показываем каким методом пришёл запрос
            });
        }

        // GET - Get farmer data by key (только если НЕ sync запрос)
        if (req.method === 'GET' && !isSyncRequest) {
            const { key } = req.query;
            
            if (!key) {
                return res.status(400).json({ error: 'Farm key required' });
            }

            const startTime = Date.now();
            const farmer = await farmersCollection.findOne({ farmKey: key });
            console.log(`[Sync GET] findOne farmer: ${Date.now() - startTime}ms`);
            
            if (!farmer) {
                return res.status(404).json({ error: 'Farm key not found' });
            }

            // v9.12.5: ОПТИМИЗАЦИЯ - минимизируем запросы к БД
            // Используем аватары из farmer.accountAvatars напрямую, БЕЗ дополнительных запросов
            let accountAvatars = farmer.accountAvatars || {};
            let playerUserIdMap = farmer.playerUserIdMap || {};
            
            // v9.12.5: НЕ загружаем ВСЕ аватары из коллекции - это очень медленно
            // Аватары уже должны быть в farmer.accountAvatars после sync от скрипта
            
            // v9.12.5: НЕ делаем запросы к Roblox API при GET - это тормозит
            // Аватары загружаются только при POST sync от скрипта фермы

            // Recalculate isOnline based on lastUpdate for each account
            // Account is online if lastUpdate is within last 3 minutes
            const now = Date.now();
            const ONLINE_THRESHOLD = 180 * 1000; // 3 minutes in ms
            const accountsWithFreshStatus = (farmer.accounts || []).map(acc => {
                let isOnline = false;
                if (acc.lastUpdate) {
                    try {
                        const lastUpdateTime = new Date(acc.lastUpdate).getTime();
                        isOnline = (now - lastUpdateTime) <= ONLINE_THRESHOLD;
                    } catch (e) {}
                }
                return {
                    ...acc,
                    isOnline: isOnline,
                    // status = действие фермера (idle, searching, walking и т.д.)
                    // НЕ "offline" - online/offline определяется по isOnline
                    status: acc.status || 'idle',
                    action: acc.action || ''
                };
            });

            console.log(`[Sync GET] Total time: ${Date.now() - startTime}ms, accounts: ${accountsWithFreshStatus.length}`);

            return res.status(200).json({
                success: true,
                farmKey: farmer.farmKey,
                username: farmer.username,
                avatar: farmer.avatar,
                accounts: accountsWithFreshStatus,
                accountAvatars: accountAvatars, // Возвращаем аватары из farmer напрямую
                playerUserIdMap: playerUserIdMap, // Маппинг playerName -> userId
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
