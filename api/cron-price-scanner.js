/**
 * Vercel Cron Job - Централизованный сканер цен + офферов
 * Version: 3.0.0 - Added offer scanning (replaces universal-scan)
 * 
 * Запускается каждую минуту через Vercel Cron
 * Сканирует ВСЕ брейнроты со ВСЕХ панелей пользователей
 * 
 * ⚠️ AI ОТКЛЮЧЁН! Cron использует только regex парсинг.
 * AI квота (15K tokens/min) зарезервирована для пользователей.
 * 
 * ЛОГИКА:
 * 1. Собираем все уникальные брейнроты из БД (все farmKeys)
 * 2. Загружаем позицию курсора из MongoDB (откуда продолжить)
 * 3. Сканируем следующие N брейнротов начиная с курсора
 * 4. Сохраняем новую позицию курсора
 * 5. При достижении конца - начинаем сначала (циклично)
 * 6. v3.0.0: ПОСЛЕ цен - сканируем офферы на Eldorado (последовательно)
 * 
 * v3.0.0: Добавлено сканирование офферов (из universal-scan)
 *         Последовательные запросы чтобы избежать Cloudflare 1015
 */

const VERSION = '3.0.40';  // v3.0.40: Compare with last cron record only (ignore frequent client records)
const https = require('https');
const http = require('http');
const { connectToDatabase } = require('./_lib/db');

// v3.0.22: SOCKS5 proxy support
let SocksProxyAgent = null;
try {
    SocksProxyAgent = require('socks-proxy-agent').SocksProxyAgent;
    console.log('✅ SOCKS proxy agent loaded');
} catch (e) {
    console.warn('⚠️ socks-proxy-agent not available:', e.message);
}

// ⚠️ AI ПОЛНОСТЬЮ ОТКЛЮЧЁН В CRON!
// Вся квота Gemini (15K tokens/min) зарезервирована для пользователей
const CRON_USE_AI = false;           // НЕ МЕНЯТЬ! AI отключён!

// v3.0.21: User-Agent Rotation Pool
// При ошибке 1015 переключаемся на следующий User-Agent
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
];

// v3.0.22: SOCKS5 Proxy configuration
// Set SOCKS5_PROXY_URL environment variable:
// socks5://username:password@host:port
// v10.3.30: DataImpulse proxy - activates ONLY on Cloudflare 1015
const SOCKS5_PROXY_URL = process.env.SOCKS5_PROXY_URL || 'socks5://d36230e549169e3261cc:d5be06662f2a8981@gw.dataimpulse.com:824';

// v10.3.47: Create fresh proxy agent for each request (avoids socket reuse issues on Vercel)
function createProxyAgent() {
    if (!SOCKS5_PROXY_URL || !SocksProxyAgent) return null;
    try {
        return new SocksProxyAgent(SOCKS5_PROXY_URL, {
            timeout: 15000  // 15 second timeout for proxy connection
        });
    } catch (e) {
        console.error('❌ Failed to create proxy agent:', e.message);
        return null;
    }
}

// v3.0.22: Check if SOCKS5 proxy is configured
function isProxyConfigured() {
    return !!SOCKS5_PROXY_URL && !!SocksProxyAgent;
}

// v3.0.20: Adaptive Rate Limiting System
// Автоматически адаптируется к rate limit ошибкам Cloudflare
const adaptiveRateLimit = {
    consecutiveErrors: 0,           // Последовательные ошибки 1015
    backoffMultiplier: 1,           // Множитель задержки (1x, 2x, 4x, 8x...)
    lastErrorTime: null,            // Время последней ошибки
    backupModeUntil: null,          // Если установлено - backup mode до этого времени
    maxBackoffMultiplier: 16,       // Максимальный множитель (16x = 16 секунд)
    errorThreshold: 8,              // v3.0.24: После 8 ошибок - включаем backup mode (was 5)
    backupModeDuration: 10 * 60 * 1000, // v3.0.24: Backup mode на 10 минут (was 30)
    cooldownPeriod: 5 * 60 * 1000,  // 5 минут без ошибок - сбрасываем множитель
    currentUserAgentIndex: 0,       // v3.0.21: Текущий индекс User-Agent
    useProxy: false,                // v3.0.21: Использовать прокси (активируется при ошибках)
    successStreak: 0,               // v3.0.26: Успешные запросы подряд
};

// v3.0.21: Get current User-Agent (rotates on errors)
function getCurrentUserAgent() {
    return USER_AGENTS[adaptiveRateLimit.currentUserAgentIndex % USER_AGENTS.length];
}

// v3.0.21: Rotate to next User-Agent
function rotateUserAgent() {
    adaptiveRateLimit.currentUserAgentIndex = (adaptiveRateLimit.currentUserAgentIndex + 1) % USER_AGENTS.length;
    console.log(`🔄 Rotated to User-Agent #${adaptiveRateLimit.currentUserAgentIndex + 1}/${USER_AGENTS.length}`);
}

// Проверяем backup mode
function isInBackupMode() {
    if (!adaptiveRateLimit.backupModeUntil) return false;
    if (Date.now() < adaptiveRateLimit.backupModeUntil) return true;
    // Backup mode истёк
    adaptiveRateLimit.backupModeUntil = null;
    adaptiveRateLimit.consecutiveErrors = 0;
    adaptiveRateLimit.backoffMultiplier = 1;
    console.log('🟢 Backup mode ended, resuming normal scanning');
    return false;
}

// Обработка rate limit ошибки
function handleRateLimitError() {
    adaptiveRateLimit.consecutiveErrors++;
    adaptiveRateLimit.lastErrorTime = Date.now();
    adaptiveRateLimit.successStreak = 0; // v3.0.26: Reset success streak
    adaptiveRateLimit.backoffMultiplier = Math.min(
        adaptiveRateLimit.backoffMultiplier * 2,
        adaptiveRateLimit.maxBackoffMultiplier
    );
    
    // v3.0.21: Rotate User-Agent on each error
    rotateUserAgent();
    
    console.log(`⚠️ Rate limit error #${adaptiveRateLimit.consecutiveErrors}, backoff: ${adaptiveRateLimit.backoffMultiplier}x`);
    
    // v3.0.26: Включаем прокси СРАЗУ при первой ошибке если настроен
    if (isProxyConfigured() && !adaptiveRateLimit.useProxy) {
        adaptiveRateLimit.useProxy = true;
        console.log(`🔀 Proxy mode ENABLED (SOCKS5)`);
    }
    
    // v10.3.47: Sync proxy state to eldorado-price module
    if (eldoradoPrice && eldoradoPrice.enableProxyMode) {
        eldoradoPrice.enableProxyMode();
        console.log(`🔀 Synced proxy state to eldorado-price module`);
    }
    
    // После threshold ошибок - включаем backup mode
    if (adaptiveRateLimit.consecutiveErrors >= adaptiveRateLimit.errorThreshold) {
        adaptiveRateLimit.backupModeUntil = Date.now() + adaptiveRateLimit.backupModeDuration;
        console.log(`🔴 BACKUP MODE ENABLED for ${adaptiveRateLimit.backupModeDuration / 60000} minutes`);
        console.log(`   Will resume at: ${new Date(adaptiveRateLimit.backupModeUntil).toISOString()}`);
    }
}

// Успешный запрос - уменьшаем backoff
function handleSuccessfulRequest() {
    // v3.0.26: Считаем успешные запросы подряд
    adaptiveRateLimit.successStreak = (adaptiveRateLimit.successStreak || 0) + 1;
    
    // v3.0.26: Только после 20 успешных запросов подряд начинаем уменьшать счётчики
    if (adaptiveRateLimit.successStreak >= 20) {
        if (adaptiveRateLimit.consecutiveErrors > 0) {
            adaptiveRateLimit.consecutiveErrors = Math.max(0, adaptiveRateLimit.consecutiveErrors - 1);
        }
        // Постепенно уменьшаем backoff
        if (adaptiveRateLimit.backoffMultiplier > 1) {
            adaptiveRateLimit.backoffMultiplier = Math.max(1, adaptiveRateLimit.backoffMultiplier / 2);
        }
        // v3.0.26: Выключаем прокси только после 50 успешных запросов подряд
        if (adaptiveRateLimit.successStreak >= 50 && adaptiveRateLimit.useProxy) {
            // НЕ выключаем прокси - он работает, пусть работает
            // adaptiveRateLimit.useProxy = false;
            // console.log('🔀 Proxy mode DISABLED (50 successful requests)');
        }
    }
}

// Получить текущий delay с учётом backoff
function getCurrentDelay(baseDelay) {
    return baseDelay * adaptiveRateLimit.backoffMultiplier;
}

// v2.9.0: Увеличенные параметры сканирования
// v3.0.19: Adjusted for VPS (single IP) - increased delays to avoid Cloudflare rate limit
// v3.0.20: Base delays, will be multiplied by backoffMultiplier if rate limited
// v3.0.24: Increased base delay from 500ms to 1000ms to reduce Cloudflare triggers
// v3.0.41: Increased total time to 180s (120s prices + 60s offers)
const SCAN_BATCH_SIZE = 100;         // Brainrots per cycle
const BASE_SCAN_DELAY_MS = 1000;     // v3.0.24: 1 req/sec instead of 2 req/sec
const MAX_SCAN_TIME_MS = 180 * 1000;  // v3.0.41: 180 seconds total (120s prices + 60s offers)
const MAX_PRICE_SCAN_TIME_MS = 120 * 1000;  // v3.0.41: 120s for price scanning

// v3.0.0: Параметры сканирования офферов
const OFFER_SCAN_PAGES = 10;         // Pages per scan
const OFFER_SCAN_PAGE_SIZE = 50;     // Eldorado limit
const BASE_OFFER_SCAN_DELAY_MS = 1000; // v3.0.24: 1 req/sec for offers too

// v3.0.8: Увеличен лимит direct search для pending офферов
const MAX_DIRECT_SEARCHES = 100;     // Увеличено с 20 - проверяем больше pending офферов
const ELDORADO_GAME_ID = '259';
const ELDORADO_IMAGE_BASE = 'https://fileserviceusprod.blob.core.windows.net/offerimages/';

// Паттерны для извлечения кодов из тайтлов офферов
const CODE_PATTERNS = [
    /#([A-Z0-9]{4,12})\b/gi,
    /\[([A-Z0-9]{4,12})\]/gi,
    /\(([A-Z0-9]{4,12})\)/gi,
];

// Маппинг ID мутации -> название
const MUTATION_ID_TO_NAME = {
    '1-0': null, '1-1': 'Gold', '1-2': 'Diamond', '1-3': 'Bloodrot',
    '1-4': 'Candy', '1-5': 'Lava', '1-6': 'Galaxy', '1-7': 'Yin-Yang',
    '1-8': 'Radioactive', '1-9': 'Rainbow', '1-10': 'Cursed'
};

// Rate limiting (не используется когда AI отключён)
const MAX_REQUESTS_PER_MINUTE = 3;
const MAX_TOKENS_PER_MINUTE = 5000;
const TOKENS_PER_BATCH = 1500;
const MAX_BATCHES_PER_WAVE = 2;

// НЕ загружаем AI модуль когда CRON_USE_AI = false
let aiScanner = null;
let eldoradoPrice = null;

if (CRON_USE_AI) {
    try {
        aiScanner = require('./ai-scanner.js');
    } catch (e) {
        console.warn('AI Scanner not available:', e.message);
    }
}

try {
    eldoradoPrice = require('./eldorado-price.js');
} catch (e) {
    console.warn('Eldorado Price not available:', e.message);
}

/**
 * Собирает все уникальные брейнроты со всех панелей из БД
 * v9.12.10: Теперь также собирает мутации как отдельные записи
 * v10.4.0: Добавлена информация о lastSeenAt фермера для приоритизации неактивных
 */
async function collectAllBrainrotsFromDB() {
    const { db } = await connectToDatabase();
    const collection = db.collection('farmers');
    
    // Получаем все записи фермеров
    const farmers = await collection.find({}).toArray();
    
    const uniqueBrainrots = new Map();
    let totalAccounts = 0;
    let totalBrainrots = 0;
    let totalMutations = 0;
    let activeUsers = 0;
    let inactiveUsers = 0;
    
    const now = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000;
    
    for (const farmer of farmers) {
        if (!farmer.accounts) continue;
        
        // v10.4.0: Определяем активность пользователя
        const lastSeenAt = farmer.lastSeenAt ? new Date(farmer.lastSeenAt).getTime() : 0;
        const isActiveUser = (now - lastSeenAt) < ONE_HOUR_MS;
        if (isActiveUser) activeUsers++;
        else inactiveUsers++;
        
        for (const account of farmer.accounts) {
            if (!account.brainrots) continue;
            totalAccounts++;
            
            for (const b of account.brainrots) {
                totalBrainrots++;
                const name = b.name;
                const income = normalizeIncome(b.income, b.incomeText);
                
                // 1. Default price (всегда)
                const defaultKey = `${name.toLowerCase()}_${income}`;
                if (!uniqueBrainrots.has(defaultKey)) {
                    uniqueBrainrots.set(defaultKey, {
                        name,
                        income,
                        mutation: null,
                        count: 1,
                        hasActiveOwner: isActiveUser // v10.4.0: Track if any owner is active
                    });
                } else {
                    const existing = uniqueBrainrots.get(defaultKey);
                    existing.count++;
                    // Если хотя бы один владелец активен - брейнрот считается активным
                    if (isActiveUser) existing.hasActiveOwner = true;
                }
                
                // 2. Mutation price (если есть мутация)
                // v9.12.10: Используем cleanMutation для нормализации
                const cleanMut = cleanMutationForKey(b.mutation);
                if (cleanMut) {
                    totalMutations++;
                    const mutationKey = `${name.toLowerCase()}_${income}_${cleanMut}`;
                    if (!uniqueBrainrots.has(mutationKey)) {
                        uniqueBrainrots.set(mutationKey, {
                            name,
                            income,
                            mutation: b.mutation, // Сохраняем оригинал для передачи в API
                            count: 1,
                            hasActiveOwner: isActiveUser // v10.4.0: Track if any owner is active
                        });
                    } else {
                        const existing = uniqueBrainrots.get(mutationKey);
                        existing.count++;
                        if (isActiveUser) existing.hasActiveOwner = true;
                    }
                }
            }
        }
    }
    
    console.log(`📊 Collected from DB: ${farmers.length} farmers (${activeUsers} active, ${inactiveUsers} inactive), ${totalAccounts} accounts, ${totalBrainrots} brainrots (${totalMutations} mutations), ${uniqueBrainrots.size} unique`);
    
    return Array.from(uniqueBrainrots.values());
}

// Вспомогательная функция для ключа (cleanMutation определена ниже)
function cleanMutationForKey(mutation) {
    if (!mutation || mutation === 'None' || mutation === 'Default') return null;
    let clean = mutation.replace(/<[^>]+>/g, '').trim();
    if (clean.toLowerCase().includes('yin') && clean.toLowerCase().includes('yang')) {
        return 'yinyang';
    }
    return clean.toLowerCase() || null;
}

/**
 * Нормализует income к числу M/s
 */
function normalizeIncome(income, incomeText) {
    // v3.0.8: Сначала парсим incomeText если есть - это самый точный источник
    if (incomeText) {
        const match = incomeText.match(/\$?(\d+(?:\.\d+)?)\s*([KMBT])?\/s/i);
        if (match) {
            let value = parseFloat(match[1]);
            const suffix = (match[2] || 'M').toUpperCase(); // Default M если не указано
            
            if (suffix === 'K') value *= 0.001;
            else if (suffix === 'B') value *= 1000;
            else if (suffix === 'T') value *= 1000000;
            // M = value as is
            
            return Math.floor(value / 10) * 10;
        }
    }
    
    if (typeof income === 'number' && income > 0) {
        // v3.0.8: Если income > 10000, это полное число - конвертируем в M/s
        // Например: 163125000 → 163.125 M/s
        let valueMs = income;
        if (income > 10000) {
            valueMs = income / 1000000;
        }
        // Округляем до ближайших 10
        return Math.floor(valueMs / 10) * 10;
    }
    
    return 0;
}

/**
 * v9.12.10: Очищает текст мутации (аналог cleanMutationText на клиенте)
 */
function cleanMutation(mutation) {
    if (!mutation) return null;
    let clean = mutation.replace(/<[^>]+>/g, '').trim();
    if (clean.toLowerCase().includes('yin') && clean.toLowerCase().includes('yang')) {
        return 'yinyang';
    }
    return clean.toLowerCase() || null;
}

/**
 * v3.0.16: Парсит income из title оффера
 * v3.0.23: Added range offer filtering (30M-1B/S, 100M-2B/s patterns)
 * Поддерживает форматы: "$310.0M/s", "310M/s", "$1.5B/s", "1500M/s"
 */
function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    // v3.0.23: Skip range offers like "30M-1B/S", "100M-2B/s", "150Ms-1B/S"
    if (/\d+\s*[mM][sS]?\s*[-~]\s*\d+(?:\.\d+)?\s*[bB]\/[sS]/i.test(title)) {
        return null;
    }
    // Skip M/s to M/s ranges like "100M/s to 500M/s"
    if (/\d+\s*[mM]\/[sS]\s*(?:[-~]|to)\s*\d+\s*[mM]\/[sS]/i.test(title)) {
        return null;
    }
    // Skip HIGH VALUE range offers
    if (/HIGH\s+VALUE.*SECRET/i.test(title) && /\d+\s*[mM]\s*[-~]\s*\d+/i.test(title)) {
        return null;
    }
    
    // Паттерн: число (с опциональной точкой), опциональный пробел, M или B, /s
    const match = title.match(/\$?(\d+(?:\.\d+)?)\s*([KMBT])\/s/i);
    if (!match) return null;
    
    let income = parseFloat(match[1]);
    const suffix = match[2].toUpperCase();
    
    // Конвертируем в M/s
    if (suffix === 'K') income *= 0.001;
    else if (suffix === 'B') income *= 1000;
    else if (suffix === 'T') income *= 1000000;
    // M = уже в M/s
    
    return income > 0 ? income : null;
}

/**
 * v2.8.0: Получить состояние сканера из MongoDB
 */
async function getScanState(db) {
    const collection = db.collection('scan_state');
    const state = await collection.findOne({ _id: 'price_scanner' });
    return {
        cycleId: state?.cycleId || 0,
        lastScanAt: state?.lastScanAt || null,
        totalScanned: state?.totalScanned || 0
    };
}

/**
 * v2.8.0: Сохранить состояние сканера
 */
async function saveScanState(db, cycleId, scannedThisRun, isNewCycle) {
    const collection = db.collection('scan_state');
    
    await collection.updateOne(
        { _id: 'price_scanner' },
        {
            $set: {
                cycleId: isNewCycle ? cycleId + 1 : cycleId,
                lastScanAt: new Date()
            },
            $inc: {
                totalScanned: scannedThisRun
            }
        },
        { upsert: true }
    );
}

/**
 * v3.0.34: Получить курсор для сканирования офферов
 * Возвращает индекс последнего просканированного фермера
 */
async function getOfferScanCursor(db) {
    const collection = db.collection('scan_state');
    const state = await collection.findOne({ _id: 'offer_scanner' });
    return {
        farmerIndex: state?.farmerIndex || 0,
        cycleId: state?.cycleId || 0,
        lastScanAt: state?.lastScanAt || null
    };
}

/**
 * v3.0.34: Сохранить курсор для сканирования офферов
 */
async function saveOfferScanCursor(db, farmerIndex, cycleId, isNewCycle = false) {
    const collection = db.collection('scan_state');
    
    await collection.updateOne(
        { _id: 'offer_scanner' },
        {
            $set: {
                farmerIndex: farmerIndex,
                cycleId: isNewCycle ? cycleId + 1 : cycleId,
                lastScanAt: new Date()
            }
        },
        { upsert: true }
    );
}

/**
 * v2.8.0: Получить все кэшированные цены для определения приоритетов
 * Возвращает Map: cacheKey → { updatedAt, cycleId }
 */
async function getAllCachedPricesInfo(db) {
    const collection = db.collection('price_cache');
    const prices = await collection.find({}, { 
        projection: { _id: 1, updatedAt: 1, cycleId: 1 } 
    }).toArray();
    
    const map = new Map();
    for (const p of prices) {
        map.set(p._id, {
            updatedAt: p.updatedAt,
            cycleId: p.cycleId || 0
        });
    }
    return map;
}

/**
 * Получает текущую цену из глобального кэша
 * v9.12.10: Поддержка мутаций
 */
async function getCachedPrice(db, name, income, mutation = null) {
    let cacheKey = `${name.toLowerCase()}_${income}`;
    const cleanMut = cleanMutation(mutation);
    if (cleanMut) {
        cacheKey += `_${cleanMut}`;
    }
    const collection = db.collection('price_cache');
    
    const cached = await collection.findOne({ _id: cacheKey });
    return cached;
}

/**
 * Сохраняет цену в глобальный кэш
 * v2.8.0: Добавлен cycleId для отслеживания когда сканировали
 */
async function savePriceToCache(db, name, income, priceData, mutation = null, cycleId = 0) {
    let cacheKey = `${name.toLowerCase()}_${income}`;
    const cleanMut = cleanMutation(mutation);
    if (cleanMut) {
        cacheKey += `_${cleanMut}`;
    }
    const collection = db.collection('price_cache');
    
    await collection.updateOne(
        { _id: cacheKey },
        { 
            $set: {
                ...priceData,
                name,
                income,
                mutation: cleanMut || null,
                updatedAt: new Date(),
                cycleId: cycleId  // v2.8.0: Track which cycle scanned this
            }
        },
        { upsert: true }
    );
}

/**
 * Добавляет в AI очередь
 * v9.12.10: Поддержка мутаций
 */
async function addToAIQueue(db, brainrot, regexResult) {
    const collection = db.collection('ai_queue');
    let cacheKey = `${brainrot.name.toLowerCase()}_${brainrot.income}`;
    const cleanMut = cleanMutation(brainrot.mutation);
    if (cleanMut) {
        cacheKey += `_${cleanMut}`;
    }
    
    // Проверяем нет ли уже в очереди
    const existing = await collection.findOne({ _id: cacheKey });
    if (existing && Date.now() - new Date(existing.addedAt).getTime() < 10 * 60 * 1000) {
        return false; // Уже в очереди и не старше 10 минут
    }
    
    await collection.updateOne(
        { _id: cacheKey },
        {
            $set: {
                name: brainrot.name,
                income: brainrot.income,
                mutation: brainrot.mutation || null,
                regexPrice: regexResult?.suggestedPrice,
                addedAt: new Date(),
                status: 'pending',
                retries: 0
            }
        },
        { upsert: true }
    );
    
    return true;
}

/**
 * Получает элементы из AI очереди
 */
async function getAIQueueItems(db, limit = 50) {
    const collection = db.collection('ai_queue');
    
    const items = await collection.find({
        status: 'pending',
        retries: { $lt: 3 }
    })
    .sort({ addedAt: 1 })
    .limit(limit)
    .toArray();
    
    return items;
}

/**
 * Обновляет статус элемента в очереди
 */
async function updateQueueItemStatus(db, cacheKey, status, result = null) {
    const collection = db.collection('ai_queue');
    
    const update = {
        status,
        processedAt: new Date()
    };
    
    if (result) {
        update.aiResult = result;
    }
    
    if (status === 'failed') {
        await collection.updateOne(
            { _id: cacheKey },
            { $set: update, $inc: { retries: 1 } }
        );
    } else {
        await collection.updateOne(
            { _id: cacheKey },
            { $set: update }
        );
    }
}

/**
 * Удаляет обработанные элементы из очереди
 */
async function cleanupQueue(db) {
    const collection = db.collection('ai_queue');
    
    // Удаляем успешно обработанные старше 1 часа
    await collection.deleteMany({
        status: 'completed',
        processedAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) }
    });
    
    // Удаляем failed с 3+ retries
    await collection.deleteMany({
        status: 'failed',
        retries: { $gte: 3 }
    });
}

// ==================== v3.0.0: OFFER SCANNING ====================

/**
 * Получает офферы с Eldorado API
 * v3.0.7: searchQuery вместо offerTitle для поиска по коду
 * v3.0.17: Eldorado убрал offerSortingCriterion, ограничил pageSize до 50
 * v3.0.21: User-Agent rotation + proxy support
 */
function fetchEldoradoOffers(pageIndex = 1, pageSize = 50, searchText = null) {
    return new Promise((resolve) => {
        // v3.0.17: Убран offerSortingCriterion - Eldorado возвращает 400
        let queryPath = `/api/flexibleOffers?gameId=${ELDORADO_GAME_ID}&category=CustomItem&te_v0=Brainrot&pageSize=${pageSize}&pageIndex=${pageIndex}`;
        
        // v3.0.7: Используем searchQuery (как в scan-glitched) - ищет в title И description
        if (searchText) {
            queryPath += `&searchQuery=${encodeURIComponent(searchText)}`;
        }

        // v3.0.21: Use rotating User-Agent
        const userAgent = getCurrentUserAgent();
        
        const options = {
            hostname: 'www.eldorado.gg',
            path: queryPath,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'User-Agent': userAgent
            }
        };

        // v3.0.22: Add SOCKS5 proxy support if enabled
        // v10.3.47: Create fresh proxy agent for each request (avoids socket reuse issues)
        if (adaptiveRateLimit.useProxy && isProxyConfigured()) {
            const agent = createProxyAgent();
            if (agent) {
                options.agent = agent;
                console.log('🔀 Using SOCKS5 proxy for this request');
            }
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // v3.0.20: Detect Cloudflare rate limit (error 1015)
                if (res.statusCode === 403 || res.statusCode === 429) {
                    if (data.includes('1015') || data.includes('rate limit') || data.includes('Rate limit')) {
                        console.log('🚫 Cloudflare 1015 detected!');
                        handleRateLimitError();
                        resolve({ error: 'cloudflare_1015', rateLimited: true, results: [] });
                        return;
                    }
                }
                
                try {
                    const parsed = JSON.parse(data);
                    // v3.0.20: Success - reduce backoff
                    handleSuccessfulRequest();
                    resolve({
                        results: parsed.results || [],
                        totalCount: parsed.recordCount || 0
                    });
                } catch (e) {
                    // v3.0.20: Parse error might be Cloudflare HTML page
                    if (data.includes('1015') || data.includes('Cloudflare')) {
                        console.log('🚫 Cloudflare block detected (HTML response)!');
                        handleRateLimitError();
                        resolve({ error: 'cloudflare_block', rateLimited: true, results: [] });
                        return;
                    }
                    resolve({ error: e.message, results: [] });
                }
            });
        });

        req.on('error', (e) => resolve({ error: e.message, results: [] }));
        req.setTimeout(15000, () => {
            req.destroy();
            resolve({ error: 'timeout', results: [] });
        });
        req.end();
    });
}

/**
 * Извлекает коды из текста (#XXXXXXXX)
 */
function extractAllCodes(text) {
    if (!text) return [];
    const codes = new Set();
    for (const pattern of CODE_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const code = match[1].toUpperCase();
            if (code.length >= 4 && !/^\d+$/.test(code)) {
                codes.add(code);
            }
        }
    }
    return Array.from(codes);
}

/**
 * Извлекает мутацию из атрибутов Eldorado
 */
function extractMutationFromAttributes(attributes) {
    if (!attributes || !Array.isArray(attributes)) return null;
    const mutAttr = attributes.find(a => a.name === 'Mutations' || a.name === 'Mutation');
    if (mutAttr?.value && mutAttr.value !== 'None') {
        return mutAttr.value;
    }
    const mutById = attributes.find(a => a.id?.startsWith('1-') && a.id !== '1-0');
    if (mutById) return MUTATION_ID_TO_NAME[mutById.id] || null;
    return null;
}

/**
 * Строит URL изображения
 */
function buildImageUrl(imageName) {
    if (!imageName) return null;
    if (imageName.startsWith('http')) return imageName;
    return ELDORADO_IMAGE_BASE + imageName;
}

/**
 * v3.0.39: Записывает баланс всех фермеров в balance_history
 * Берёт total_value прямо из таблицы farmers (как клиент)
 * Это позволяет накапливать историю даже когда пользователь оффлайн
 */
async function recordAllFarmersBalance(db) {
    console.log(`\n📊 Recording balance history for all farmers...`);
    
    try {
        const farmersCollection = db.collection('farmers');
        const balanceHistoryCollection = db.collection('balance_history');
        
        // Получаем всех фермеров с их total_value
        const farmers = await farmersCollection.find({}).toArray();
        if (farmers.length === 0) {
            console.log(`   ℹ️ No farmers found`);
            return { recorded: 0 };
        }
        
        const now = new Date();
        let recorded = 0;
        let skipped = 0;
        
        for (const farmer of farmers) {
            const farmKey = farmer.farmKey || farmer.farm_key;
            if (!farmKey || farmKey === 'TEST') continue;
            
            // v3.0.39: Берём total_value прямо из записи фермера
            const totalValue = parseFloat(farmer.totalValue || farmer.total_value) || 0;
            
            if (totalValue <= 0) {
                skipped++;
                continue;
            }
            
            // v3.0.40: Проверяем последнюю CRON запись (не клиентскую)
            // Клиент пишет часто, но cron должен писать независимо
            const lastCronRecord = await balanceHistoryCollection.findOne(
                { farmKey, source: 'cron' },
                { sort: { timestamp: -1 } }
            );
            
            if (lastCronRecord) {
                const timeDiff = now.getTime() - new Date(lastCronRecord.timestamp).getTime();
                const minInterval = 55 * 1000; // ~55 сек для cron (чуть меньше цикла)
                
                if (timeDiff < minInterval) {
                    skipped++;
                    continue;
                }
                
                // Не записываем если баланс не изменился с последней cron записи
                if (Math.abs(parseFloat(lastCronRecord.value) - totalValue) < 0.01) {
                    skipped++;
                    continue;
                }
            }
            
            // Записываем баланс
            await balanceHistoryCollection.insertOne({
                farmKey,
                value: totalValue,
                timestamp: now,
                source: 'cron',
                createdAt: now
            });
            recorded++;
            console.log(`   📝 ${farmKey.substring(0, 15)}... = $${totalValue.toFixed(2)}`);
        }
        
        console.log(`   ✅ Recorded ${recorded} balances, skipped ${skipped} (unchanged/frequent)`);
        return { recorded, skipped };
        
    } catch (e) {
        console.warn(`   ⚠️ Balance history error: ${e.message}`);
        return { error: e.message };
    }
}

/**
 * v3.0.0: Сканирует офферы на Eldorado и обновляет БД
 * v3.0.18: ПОЛНОСТЬЮ ПЕРЕРАБОТАНО - сканируем по shopName каждого фермера
 *          Это намного эффективнее чем сканировать все 56000+ офферов
 * v3.0.34: Добавлен курсор - продолжаем с места где остановились
 * v3.0.35: Приоритизация как у цен - новые и stale первыми
 * Запускается ПОСЛЕ сканирования цен
 */
async function scanOffers(db, globalStartTime = null) {
    console.log(`\n📦 Starting offer scan v3.0.35 (prioritized queue)...`);
    
    // v3.0.20: Check backup mode
    if (isInBackupMode()) {
        const remainingMs = adaptiveRateLimit.backupModeUntil - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        console.log(`🔴 BACKUP MODE - Skipping offer scan, resume in ${remainingMin} min`);
        return { skipped: true, backupMode: true };
    }
    
    const startTime = Date.now();
    const nowTs = Date.now();
    
    const codesCollection = db.collection('offer_codes');
    const offersCollection = db.collection('offers');
    const farmersCollection = db.collection('farmers');
    const now = new Date();
    
    // v3.0.35: Порог свежести - 10 минут для офферов (дольше чем для цен)
    const OFFER_FRESH_THRESHOLD_MS = 10 * 60 * 1000;
    
    // v3.0.18: Загружаем всех фермеров с shopName
    const allFarmersRaw = await farmersCollection.find(
        { shopName: { $exists: true, $ne: null, $ne: '' } },
        { projection: { farmKey: 1, shopName: 1 } }
    ).toArray();
    
    // v3.0.35: Получаем lastScannedAt для каждого фермера из его офферов
    // Берём самую свежую дату сканирования среди офферов фермера
    const farmerScanTimes = new Map();
    const allOffers = await offersCollection.find(
        { lastScannedAt: { $exists: true } },
        { projection: { farmKey: 1, lastScannedAt: 1 } }
    ).toArray();
    
    for (const offer of allOffers) {
        const scanTime = offer.lastScannedAt ? new Date(offer.lastScannedAt).getTime() : 0;
        const existing = farmerScanTimes.get(offer.farmKey) || 0;
        if (scanTime > existing) {
            farmerScanTimes.set(offer.farmKey, scanTime);
        }
    }
    
    // v3.0.35: Классифицируем фермеров по приоритету
    const newFarmers = [];      // Никогда не сканировались
    const staleFarmers = [];    // Давно не сканировались (>10 мин)
    const freshFarmers = [];    // Недавно сканировались (<10 мин)
    
    for (const farmer of allFarmersRaw) {
        const lastScan = farmerScanTimes.get(farmer.farmKey) || 0;
        const age = nowTs - lastScan;
        
        if (lastScan === 0) {
            // Новый - никогда не сканировался
            newFarmers.push({ ...farmer, _lastScanAt: 0 });
        } else if (age >= OFFER_FRESH_THRESHOLD_MS) {
            // Устаревший - нужно пересканировать
            staleFarmers.push({ ...farmer, _lastScanAt: lastScan });
        } else {
            // Свежий - пропускаем
            freshFarmers.push(farmer);
        }
    }
    
    // v3.0.35: Сортируем stale фермеров - самые старые первыми
    staleFarmers.sort((a, b) => a._lastScanAt - b._lastScanAt);
    
    // v3.0.35: Формируем очередь: новые → устаревшие (sorted by oldest)
    const allFarmers = [...newFarmers, ...staleFarmers];
    
    console.log(`📋 Priority: ${newFarmers.length} new, ${staleFarmers.length} stale (>10min), ${freshFarmers.length} fresh (<10min, skipped)`);
    
    if (allFarmers.length === 0) {
        console.log(`✅ All farmers are fresh, nothing to scan`);
        return { skipped: true, reason: 'all_fresh' };
    }
    
    console.log(`👥 Scanning ${allFarmers.length} farmers (${allFarmersRaw.length} total)`);
    
    // Загружаем все существующие офферы для быстрого поиска
    const existingOffers = await offersCollection.find({}).toArray();
    const offersByCode = new Map();
    for (const offer of existingOffers) {
        if (offer.offerId) {
            offersByCode.set(offer.offerId.toUpperCase(), offer);
        }
    }
    console.log(`📋 Loaded ${offersByCode.size} existing offers from DB`);
    
    let totalScanned = 0;
    let matchedCount = 0;
    let updatedCount = 0;
    let createdCount = 0;
    const foundCodes = new Set();
    const scannedFarmKeys = new Set();
    const successfullyScannedFarmKeys = new Set(); // v3.0.37: Only farmers with at least 1 successful page
    let offerTimeoutBreak = false;  // v10.3.7: Track if we hit time limit
    let farmersScannedCount = 0;    // v3.0.35: Track how many farmers scanned
    
    // v3.0.35: Сканируем фермеров по приоритету (без курсора - приоритет важнее)
    for (const farmer of allFarmers) {
        farmersScannedCount++;
        
        // v10.3.7: Check global time limit
        if (globalStartTime) {
            const globalElapsed = Date.now() - globalStartTime;
            if (globalElapsed >= MAX_SCAN_TIME_MS) {
                console.log(`⏰ Offer scan stopped at farmer ${farmersScannedCount}/${allFarmers.length} - time limit (${(globalElapsed/1000).toFixed(1)}s)`);
                offerTimeoutBreak = true;
                break;
            }
        }
        
        const shopName = farmer.shopName;
        // Очищаем shopName от эмодзи для поиска
        const cleanShopName = shopName.replace(/[^\w\s]/g, '').trim();
        if (!cleanShopName || cleanShopName.length < 3) {
            console.log(`⏭️ Skipping "${shopName}" - too short after cleaning`);
            continue;
        }
        
        console.log(`\n🔍 Scanning offers for "${shopName}" (farmKey: ${farmer.farmKey})...`);
        scannedFarmKeys.add(farmer.farmKey);
        
        // Сканируем до 5 страниц для каждого магазина (250 офферов макс)
        for (let page = 1; page <= 5; page++) {
            // v3.0.20: Use adaptive delay
            await new Promise(r => setTimeout(r, getCurrentDelay(BASE_OFFER_SCAN_DELAY_MS)));
            
            const response = await fetchEldoradoOffers(page, OFFER_SCAN_PAGE_SIZE, cleanShopName);
            
            // v3.0.20: Check for rate limit
            if (response.rateLimited) {
                console.warn(`   🚫 Rate limited! Breaking scan loop.`);
                break;
            }
            
            if (response.error) {
                console.warn(`   ⚠️ Page ${page} error: ${response.error}`);
                break;
            }
            if (!response.results?.length) {
                if (page === 1) console.log(`   ℹ️ No offers found for "${cleanShopName}"`);
                // v3.0.37: Empty results on page 1 is still "successful" scan (shop has no offers)
                if (page === 1) successfullyScannedFarmKeys.add(farmer.farmKey);
                break;
            }
            
            // v3.0.37: Mark as successfully scanned (at least one page loaded)
            successfullyScannedFarmKeys.add(farmer.farmKey);
            totalScanned += response.results.length;
            
            // Обрабатываем офферы
            for (const item of response.results) {
                const offer = item.offer || item;
                const title = offer.offerTitle || '';
                const codes = extractAllCodes(title);
                
                if (codes.length === 0) continue;
                
                for (const code of codes) {
                    const existingOffer = offersByCode.get(code);
                    
                    // Если оффер существует и принадлежит этому фермеру
                    if (existingOffer && existingOffer.farmKey === farmer.farmKey) {
                        foundCodes.add(code);
                        matchedCount++;
                        
                        const price = offer.pricePerUnitInUSD?.amount || 0;
                        const mutation = extractMutationFromAttributes(offer.offerAttributeIdValues);
                        const imageName = offer.mainOfferImage?.originalSizeImage || offer.mainOfferImage?.largeImage;
                        let income = parseIncomeFromTitle(title);
                        
                        // Fallback: из атрибутов Eldorado (M/s range)
                        if (!income && offer.offerAttributeIdValues) {
                            const msAttr = offer.offerAttributeIdValues.find(a => a.name === 'M/s');
                            if (msAttr?.value) {
                                const rangeMatch = msAttr.value.match(/(\d+)-(\d+)/);
                                if (rangeMatch) {
                                    const min = parseInt(rangeMatch[1]);
                                    const max = parseInt(rangeMatch[2]);
                                    income = Math.floor((min + max) / 2 / 10) * 10;
                                }
                            }
                        }
                        
                        const finalIncome = (income && income > 0) ? income : (existingOffer.income || 0);
                        const oldStatus = existingOffer.status;
                        
                        await offersCollection.updateOne(
                            { _id: existingOffer._id },
                            { $set: {
                                status: 'active',
                                eldoradoOfferId: offer.id,
                                currentPrice: price,
                                mutation: mutation,
                                income: finalIncome,
                                imageUrl: buildImageUrl(imageName) || existingOffer.imageUrl,
                                eldoradoTitle: title,
                                sellerName: item.user?.username || null,
                                lastScannedAt: now,
                                updatedAt: now
                            }}
                        );
                        
                        if (oldStatus !== 'active') {
                            console.log(`   ✅ ${code}: ${oldStatus} → active (${existingOffer.brainrotName})`);
                        }
                        updatedCount++;
                        
                        // Обновляем offer_codes если есть
                        await codesCollection.updateOne(
                            { code: code },
                            { $set: { status: 'active', lastSeenAt: now, updatedAt: now } }
                        );
                    }
                }
            }
            
            // Если офферов меньше 50 - это последняя страница
            if (response.results.length < OFFER_SCAN_PAGE_SIZE) break;
        }
    }
    
    // v3.0.37: УПРОЩЁННАЯ ВЕРИФИКАЦИЯ
    // Помечаем офферы как paused сразу, БЕЗ дополнительного direct search
    // Условие: фермер был УСПЕШНО просканирован (хотя бы 1 страница загружена без ошибок)
    // Это быстрее и надёжнее - не зависит от time limit
    let pausedCount = 0;
    
    if (successfullyScannedFarmKeys.size === 0) {
        console.log(`   ⚠️ No farmers were successfully scanned, skipping paused marking`);
    } else {
        console.log(`   📋 Marking missing offers as paused for ${successfullyScannedFarmKeys.size} successfully scanned farmers...`);
        
        for (const farmer of allFarmers) {
            // v3.0.37: ТОЛЬКО для фермеров которые были УСПЕШНО просканированы
            // Если timeout на page 1 - не помечаем их офферы как paused
            if (!successfullyScannedFarmKeys.has(farmer.farmKey)) {
                continue;
            }
            
            const farmerOffers = await offersCollection.find({ 
                farmKey: farmer.farmKey, 
                offerId: { $exists: true, $ne: null },
                status: 'active'
            }).toArray();
            
            for (const offer of farmerOffers) {
                if (offer.offerId && !foundCodes.has(offer.offerId.toUpperCase())) {
                    // Сразу помечаем как paused - без дополнительной проверки через API
                    const result = await offersCollection.updateOne(
                        { _id: offer._id },
                        { $set: { status: 'paused', pausedAt: now, updatedAt: now } }
                    );
                    if (result.modifiedCount > 0) {
                        pausedCount++;
                        console.log(`   ⏸️ Paused: ${offer.offerId} (${offer.brainrotName}) - not found in shop scan`);
                    }
                }
            }
        }
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    // v3.0.35: Курсор больше не нужен - используем приоритизацию по lastScannedAt
    // Каждый цикл автоматически выбирает самых "старых" фермеров первыми
    
    console.log(`📦 Offer scan complete: ${farmersScannedCount} farmers, ${totalScanned} offers scanned, ${matchedCount} matched, ${updatedCount} updated, ${createdCount} created, ${pausedCount} paused (${duration}s)${offerTimeoutBreak ? ' [TIME LIMIT]' : ''}`);
    
    return { 
        totalScanned, 
        matchedCount, 
        updatedCount, 
        createdCount,
        pausedCount,
        foundCodes: foundCodes.size,
        duration,
        timeoutBreak: offerTimeoutBreak,
        farmersScanned: farmersScannedCount,  // v3.0.35
        farmersTotal: allFarmers.length,      // v3.0.35
        successfullyScanned: successfullyScannedFarmKeys.size  // v3.0.37
    };
}

// ==================== END OFFER SCANNING ====================

/**
 * Главная функция сканирования
 * v2.8.0: Приоритизация - новые брейнроты первые, дубликаты пропускаются
 * v3.0.0: Добавлено сканирование офферов после цен
 * v10.3.47: Sync proxy state with eldorado-price module
 * 
 * Приоритеты:
 * 1. Новые (нет в кэше) - сканируем ПЕРВЫМИ
 * 2. Не сканировались в текущем цикле - сканируем
 * 3. Уже сканировались в этом цикле - ПРОПУСКАЕМ (берём из кэша)
 */
async function runPriceScan() {
    console.log(`🚀 Starting centralized price scan v${VERSION}`);
    console.log(`⚠️ AI DISABLED: CRON_USE_AI=${CRON_USE_AI} - using regex only`);
    
    // v10.3.47: Sync proxy state to eldorado-price at scan start
    if (adaptiveRateLimit.useProxy && eldoradoPrice && eldoradoPrice.enableProxyMode) {
        eldoradoPrice.enableProxyMode();
        console.log(`🔀 Synced proxy state to eldorado-price module at scan start`);
    }
    
    // v3.0.20: Check backup mode FIRST
    if (isInBackupMode()) {
        const remainingMs = adaptiveRateLimit.backupModeUntil - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        console.log(`🔴 BACKUP MODE ACTIVE - Cloudflare rate limit detected`);
        console.log(`   Skipping scan, will resume in ${remainingMin} minutes`);
        console.log(`   Resume at: ${new Date(adaptiveRateLimit.backupModeUntil).toISOString()}`);
        return { 
            success: true, 
            backupMode: true, 
            resumeAt: adaptiveRateLimit.backupModeUntil,
            message: `Backup mode active, resuming in ${remainingMin} minutes` 
        };
    }
    
    // v3.0.20: Log current backoff state
    if (adaptiveRateLimit.backoffMultiplier > 1) {
        console.log(`⚠️ Rate limit recovery: backoff ${adaptiveRateLimit.backoffMultiplier}x, delay ${getCurrentDelay(BASE_SCAN_DELAY_MS)}ms`);
    }
    
    const startTime = Date.now();
    
    const { db } = await connectToDatabase();
    
    // 1. Собираем все брейнроты
    const brainrots = await collectAllBrainrotsFromDB();
    
    if (brainrots.length === 0) {
        console.log('No brainrots found in database');
        return { success: true, scanned: 0 };
    }
    
    // 2. Получаем состояние сканера и все кэшированные цены
    const scanState = await getScanState(db);
    const cachedPrices = await getAllCachedPricesInfo(db);
    
    console.log(`📊 State: cycle #${scanState.cycleId}, cached prices: ${cachedPrices.size}`);
    
    // 3. Генерируем ключи и классифицируем брейнроты по приоритету
    const newBrainrots = [];      // Нет в кэше - высший приоритет
    const staleBrainrots = [];    // Есть в кэше, но устаревшие (>5 мин для активных, >1ч для неактивных)
    const freshBrainrots = [];    // Недавно сканировались - пропускаем
    
    // v10.4.0: Разные thresholds для активных и неактивных пользователей
    // Активные (<1ч назад) - обновляем каждые 5 минут
    // Неактивные (>1ч назад) - обновляем каждый час
    const FRESH_THRESHOLD_ACTIVE_MS = 5 * 60 * 1000; // 5 минут
    const FRESH_THRESHOLD_INACTIVE_MS = 60 * 60 * 1000; // 1 час
    const now = Date.now();
    
    for (const b of brainrots) {
        const cleanMut = cleanMutation(b.mutation);
        let cacheKey = `${b.name.toLowerCase()}_${b.income}`;
        if (cleanMut) cacheKey += `_${cleanMut}`;
        
        b._cacheKey = cacheKey; // Сохраняем для использования позже
        
        const cached = cachedPrices.get(cacheKey);
        
        if (!cached) {
            // Новый - нет в кэше вообще - высший приоритет
            newBrainrots.push(b);
        } else {
            const updatedAt = cached.updatedAt ? new Date(cached.updatedAt).getTime() : 0;
            const age = now - updatedAt;
            
            // v10.4.0: Выбираем threshold в зависимости от активности владельца
            const freshThreshold = b.hasActiveOwner ? FRESH_THRESHOLD_ACTIVE_MS : FRESH_THRESHOLD_INACTIVE_MS;
            
            if (age < freshThreshold) {
                // Свежий - сканировался недавно относительно активности владельца
                freshBrainrots.push(b);
            } else {
                // Устаревший - нужно пересканировать
                b._cachedUpdatedAt = cached.updatedAt;
                staleBrainrots.push(b);
            }
        }
    }
    
    // v3.0.14: Сортируем stale брейнроты по updatedAt (по возрастанию)
    // Те что дольше всего не обновлялись - сканируются первыми
    // v10.4.0: Брейнроты активных пользователей имеют приоритет
    staleBrainrots.sort((a, b) => {
        // Сначала приоритет по активности владельца (активные первые)
        if (a.hasActiveOwner && !b.hasActiveOwner) return -1;
        if (!a.hasActiveOwner && b.hasActiveOwner) return 1;
        // Затем по возрасту (oldest first)
        const aTime = a._cachedUpdatedAt ? new Date(a._cachedUpdatedAt).getTime() : 0;
        const bTime = b._cachedUpdatedAt ? new Date(b._cachedUpdatedAt).getTime() : 0;
        return aTime - bTime; // Ascending: oldest first
    });
    
    // v10.4.0: Подсчитываем активных/неактивных для логирования
    const activeStale = staleBrainrots.filter(b => b.hasActiveOwner).length;
    const inactiveStale = staleBrainrots.length - activeStale;
    console.log(`📋 Priority: ${newBrainrots.length} new, ${staleBrainrots.length} stale (${activeStale} active, ${inactiveStale} inactive), ${freshBrainrots.length} fresh (skipped)`);
    
    // 4. Формируем список для сканирования: сначала новые, потом устаревшие (sorted by oldest)
    const toScanAll = [...newBrainrots, ...staleBrainrots];
    
    // v10.3.24: Группируем связанные цены - когда сканируем mutation, добавляем и default
    // Это нужно чтобы на UI обе цены обновлялись одновременно
    const toScanWithRelated = [];
    const addedKeys = new Set();
    
    for (const b of toScanAll) {
        if (addedKeys.has(b._cacheKey)) continue;
        
        toScanWithRelated.push(b);
        addedKeys.add(b._cacheKey);
        
        // Если это mutation - найти и добавить связанный default
        if (b.mutation) {
            const defaultKey = `${b.name.toLowerCase()}_${b.income}`;
            if (!addedKeys.has(defaultKey)) {
                // Ищем default версию в brainrots
                const defaultVersion = brainrots.find(br => 
                    br._cacheKey === defaultKey && !br.mutation
                );
                if (defaultVersion) {
                    // Проверяем что default не свежий
                    const cached = cachedPrices.get(defaultKey);
                    const age = cached?.updatedAt ? (now - new Date(cached.updatedAt).getTime()) : Infinity;
                    // v10.4.0: Use active threshold for related prices (they should update together)
                    if (age >= FRESH_THRESHOLD_ACTIVE_MS) {
                        toScanWithRelated.push(defaultVersion);
                        addedKeys.add(defaultKey);
                    }
                }
            }
        }
        
        // Если это default - найти и добавить связанные mutations
        if (!b.mutation) {
            const defaultKey = b._cacheKey;
            // Ищем все mutations для этого брейнрота
            for (const br of brainrots) {
                if (br.mutation && br.name.toLowerCase() === b.name.toLowerCase() && br.income === b.income) {
                    if (!addedKeys.has(br._cacheKey)) {
                        // Проверяем что mutation не свежий
                        const cached = cachedPrices.get(br._cacheKey);
                        const age = cached?.updatedAt ? (now - new Date(cached.updatedAt).getTime()) : Infinity;
                        // v10.4.0: Use active threshold for related prices (they should update together)
                        if (age >= FRESH_THRESHOLD_ACTIVE_MS) {
                            toScanWithRelated.push(br);
                            addedKeys.add(br._cacheKey);
                        }
                    }
                }
            }
        }
    }
    
    console.log(`📋 After grouping: ${toScanWithRelated.length} (was ${toScanAll.length})`);
    
    // Ограничиваем batch
    let toScan = toScanWithRelated.slice(0, SCAN_BATCH_SIZE);
    
    // v9.12.100: Убрана логика cycleId - теперь всё основано на времени
    let currentCycleId = scanState.cycleId;
    let isNewCycle = false;
    
    // Если все brainrots fresh и нечего сканировать - просто ждём
    if (toScan.length === 0) {
        console.log('✅ All brainrots are fresh (<5min), nothing to scan');
    }
    
    console.log(`📋 Scanning ${toScan.length} brainrots (${newBrainrots.length} new priority)`);
    
    // 5. Сканируем
    let regexScanned = 0;
    let priceChanges = 0;
    let newPrices = 0;
    let errors = 0;
    let skipped = 0;
    let timeoutBreak = false;  // v10.3.7: Track if we hit time limit
    
    for (const brainrot of toScan) {
        // v3.0.33: Check PRICE scan time limit (35s) - leave time for offer scan
        const elapsedMs = Date.now() - startTime;
        if (elapsedMs >= MAX_PRICE_SCAN_TIME_MS) {
            console.log(`⏰ Price scan time limit (${(elapsedMs/1000).toFixed(1)}s >= ${MAX_PRICE_SCAN_TIME_MS/1000}s) - stopping to scan offers`);
            timeoutBreak = true;
            break;
        }
        
        try {
            const cacheKey = brainrot._cacheKey;
            
            // v3.0.15: Get cached data first (needed for oldPrice comparison later)
            const cached = cachedPrices.get(cacheKey);
            
            // v3.0.26: Убрана проверка cycleId - теперь используется time-based логика
            // Brainrots уже отфильтрованы в toScan как stale (>5min)
            // Дополнительная проверка на случай обновления в этом же запуске
            if (cached && cached._scannedThisRun) {
                skipped++;
                continue;
            }
            
            // Получаем новую цену через regex
            if (!eldoradoPrice) continue;
            
            const regexResult = await eldoradoPrice.calculateOptimalPrice(brainrot.name, brainrot.income, { 
                disableAI: true,
                mutation: brainrot.mutation 
            });
            regexScanned++;
            
            if (!regexResult || regexResult.error) {
                errors++;
                continue;
            }
            
            const newPrice = regexResult.suggestedPrice;
            const oldPrice = cached?.suggestedPrice;
            
            // Сохраняем в кэш с текущим cycleId
            // v3.0.22: Ensure JSON fields are null or valid objects, not undefined
            await savePriceToCache(db, brainrot.name, brainrot.income, {
                suggestedPrice: newPrice,
                source: regexResult.parsingSource || 'regex',
                priceSource: regexResult.priceSource || null,
                competitorPrice: regexResult.competitorPrice || null,
                competitorIncome: regexResult.competitorIncome || null,
                targetMsRange: regexResult.targetMsRange || null,
                medianPrice: regexResult.medianPrice || null,
                medianData: regexResult.medianData || null,
                nextCompetitorPrice: regexResult.nextCompetitorPrice || null,
                nextCompetitorData: regexResult.nextCompetitorData || null,
                nextRangeChecked: regexResult.nextRangeChecked || false,
                isInEldoradoList: regexResult.isInEldoradoList || false,
                lowerPrice: regexResult.lowerPrice || null,
                lowerIncome: regexResult.lowerIncome || null
            }, brainrot.mutation, currentCycleId);
            
            // v3.0.26: Обновляем локальный кэш с флагом _scannedThisRun
            cachedPrices.set(cacheKey, { cycleId: currentCycleId, updatedAt: new Date(), _scannedThisRun: true });
            
            // Статистика
            if (oldPrice === null || oldPrice === undefined) {
                newPrices++;
            } else if (oldPrice !== newPrice) {
                priceChanges++;
                console.log(`   💰 Price change: ${brainrot.name}${brainrot.mutation ? ' [' + brainrot.mutation + ']' : ''} @ ${brainrot.income}M/s: $${oldPrice} → $${newPrice}`);
            }
            
            // v3.0.20: Adaptive delay между запросами к Eldorado API
            await new Promise(r => setTimeout(r, getCurrentDelay(BASE_SCAN_DELAY_MS)));
            
        } catch (e) {
            errors++;
            console.warn(`Error scanning ${brainrot.name}:`, e.message);
        }
    }
    
    // 6. Сохраняем состояние
    // v3.0.11: Передаём currentCycleId (уже увеличенный если новый цикл)
    await saveScanState(db, currentCycleId, regexScanned, false); // isNewCycle=false т.к. cycleId уже правильный
    
    // 7. v3.0.0: Сканируем офферы
    // v10.3.7: Skip offers if already hit time limit
    let offerScanResult = null;
    const elapsedBeforeOffers = Date.now() - startTime;
    if (elapsedBeforeOffers >= MAX_SCAN_TIME_MS) {
        console.log(`⏰ Skipping offer scan - already at time limit (${(elapsedBeforeOffers/1000).toFixed(1)}s)`);
        offerScanResult = { skipped: true, reason: 'time_limit' };
    } else {
        try {
            offerScanResult = await scanOffers(db, startTime);
        } catch (e) {
            console.warn('Offer scan error:', e.message);
            offerScanResult = { error: e.message };
        }
    }
    
    // 7.5. v3.0.38: Записываем баланс всех фермеров
    // Это позволяет графикам накапливать данные даже когда пользователь оффлайн
    let balanceHistoryResult = null;
    try {
        balanceHistoryResult = await recordAllFarmersBalance(db);
    } catch (e) {
        console.warn('Balance history error:', e.message);
        balanceHistoryResult = { error: e.message };
    }
    
    // 8. v10.3.6: Очистка orphan цен (брейнротов которых нет у фермеров)
    // Удаляем цены старше 2 часов если брейнрот не в списке актуальных
    let orphansCleaned = 0;
    try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        
        // Создаём Set всех актуальных ключей
        const activeCacheKeys = new Set();
        for (const b of brainrots) {
            const cleanMut = cleanMutation(b.mutation);
            let cacheKey = `${b.name.toLowerCase()}_${b.income}`;
            activeCacheKeys.add(cacheKey);
            if (cleanMut) {
                activeCacheKeys.add(`${cacheKey}_${cleanMut}`);
            }
        }
        
        // Получаем все старые цены
        const collection = db.collection('price_cache');
        const allPrices = await collection.find({}).toArray();
        
        // Находим orphan цены (старше 2 часов и не в активных)
        const orphanKeys = [];
        for (const p of allPrices) {
            const key = p._id || p.cacheKey;
            if (!key) continue;
            
            const updatedAt = p.updatedAt ? new Date(p.updatedAt) : null;
            
            // Если цена старше 2 часов И её нет в активных - это orphan
            if (updatedAt && updatedAt < twoHoursAgo && !activeCacheKeys.has(key)) {
                orphanKeys.push(key);
            }
        }
        
        // Удаляем orphan цены
        if (orphanKeys.length > 0) {
            for (const key of orphanKeys) {
                await collection.deleteOne({ _id: key });
            }
            orphansCleaned = orphanKeys.length;
            console.log(`🧹 Cleaned ${orphansCleaned} orphan prices (older than 2h, not in farmers)`);
            if (orphanKeys.length <= 20) {
                console.log(`   Removed: ${orphanKeys.join(', ')}`);
            } else {
                console.log(`   Sample: ${orphanKeys.slice(0, 10).join(', ')}...`);
            }
        }
    } catch (e) {
        console.warn('Orphan cleanup error:', e.message);
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    
    // Считаем прогресс цикла
    // v3.0.11: При новом цикле freshBrainrots не считаются как отсканированные
    const actualFreshCount = isNewCycle ? 0 : freshBrainrots.length;
    const scannedInCycle = actualFreshCount + regexScanned;
    const cycleProgress = Math.round(scannedInCycle / brainrots.length * 100);
    
    const summary = {
        success: true,
        version: VERSION,
        duration: `${duration}s`,
        timeoutBreak, // v10.3.7: True if scan was stopped due to time limit
        totalBrainrots: brainrots.length,
        scanned: regexScanned,
        newPrices,
        priceChanges,
        skipped: skipped + actualFreshCount,
        errors,
        orphansCleaned, // v10.3.6: Count of cleaned orphan prices
        cycle: {
            id: currentCycleId,
            isNew: isNewCycle,
            progress: `${cycleProgress}%`,
            remaining: isNewCycle ? brainrots.length - regexScanned : staleBrainrots.length - regexScanned
        },
        offers: offerScanResult, // v3.0.0
        balanceHistory: balanceHistoryResult // v3.0.38
    };
    
    console.log(`✅ Cron scan complete:`, summary);
    
    return summary;
}

/**
 * Vercel Cron Handler
 * Вызывается по расписанию из vercel.json
 */
module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Debug: логируем все заголовки для диагностики
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    // Проверяем авторизацию для Vercel Cron
    // Vercel Cron отправляет заголовок Authorization: Bearer <CRON_SECRET>
    // если CRON_SECRET настроен в Environment Variables
    const authHeader = req.headers.authorization;
    const userAgent = req.headers['user-agent'] || '';
    
    // Проверяем User-Agent (case-insensitive)
    const isCronByUserAgent = userAgent.toLowerCase().includes('vercel-cron');
    
    // Также проверяем x-vercel-cron заголовок (альтернативный способ определения)
    const vercelCronHeader = req.headers['x-vercel-cron'];
    const isCronByHeader = vercelCronHeader === '1' || vercelCronHeader === 'true';
    
    // Vercel Cron с настроенным CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    const isCronByAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
    
    // Разрешаем если:
    // 1. Это Vercel Cron по User-Agent (без CRON_SECRET)
    // 2. Это Vercel Cron по x-vercel-cron заголовку
    // 3. Это Vercel Cron с правильным CRON_SECRET
    const isAuthorized = isCronByUserAgent || isCronByHeader || isCronByAuth;
    
    if (!isAuthorized) {
        console.log(`Unauthorized: UA="${userAgent}", x-vercel-cron=${vercelCronHeader || 'none'}, Auth=${authHeader ? 'present' : 'none'}, CRON_SECRET=${cronSecret ? 'set' : 'not set'}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log(`📅 Cron price scanner v${VERSION} triggered (byUA: ${isCronByUserAgent}, byHeader: ${isCronByHeader}, byAuth: ${isCronByAuth})`);
    
    try {
        const result = await runPriceScan();
        return res.status(200).json(result);
    } catch (error) {
        console.error('Cron price scanner error:', error);
        return res.status(500).json({ 
            error: error.message,
            success: false 
        });
    }
};

// Экспортируем функции для использования из других модулей (fallback)
module.exports.runPriceScan = runPriceScan;
module.exports.collectAllBrainrotsFromDB = collectAllBrainrotsFromDB;
module.exports.getCachedPrice = getCachedPrice;
module.exports.savePriceToCache = savePriceToCache;
module.exports.savePriceToCache = savePriceToCache;
