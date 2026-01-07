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

const VERSION = '3.0.11';  // Fix cycle logic - properly handle new cycle start
const https = require('https');
const { connectToDatabase } = require('./_lib/db');

// ⚠️ AI ПОЛНОСТЬЮ ОТКЛЮЧЁН В CRON!
// Вся квота Gemini (15K tokens/min) зарезервирована для пользователей
const CRON_USE_AI = false;           // НЕ МЕНЯТЬ! AI отключён!

// v2.9.0: Увеличенные параметры сканирования
// Тесты: 100 sequential requests = 42 sec, no rate limit errors
// Безопасный лимит: 100 запросов за 60 секунд = ~250 брейнротов
const SCAN_BATCH_SIZE = 200;         // Увеличено с 100 (больше брейнротов за запуск)
const SCAN_DELAY_MS = 30;            // Уменьшено с 50ms (быстрее сканирование)

// v3.0.0: Параметры сканирования офферов
const OFFER_SCAN_PAGES = 10;         // Страниц офферов за один запуск (1000 офферов)
const OFFER_SCAN_DELAY_MS = 150;     // Уменьшено с 300ms - Eldorado API держит

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
    
    for (const farmer of farmers) {
        if (!farmer.accounts) continue;
        
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
                        count: 1
                    });
                } else {
                    uniqueBrainrots.get(defaultKey).count++;
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
                            count: 1
                        });
                    } else {
                        uniqueBrainrots.get(mutationKey).count++;
                    }
                }
            }
        }
    }
    
    console.log(`📊 Collected from DB: ${farmers.length} farmers, ${totalAccounts} accounts, ${totalBrainrots} brainrots (${totalMutations} mutations), ${uniqueBrainrots.size} unique`);
    
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
 */
function fetchEldoradoOffers(pageIndex = 1, pageSize = 100, searchText = null) {
    return new Promise((resolve) => {
        // v3.0.6: Добавляем поиск по тексту для поиска конкретных кодов
        let queryPath = `/api/flexibleOffers?gameId=${ELDORADO_GAME_ID}&category=CustomItem&te_v0=Brainrot&pageSize=${pageSize}&pageIndex=${pageIndex}&offerSortingCriterion=CreationDate&isAscending=false`;
        
        // v3.0.7: Используем searchQuery (как в scan-glitched) - ищет в title И description
        if (searchText) {
            queryPath += `&searchQuery=${encodeURIComponent(searchText)}`;
        }

        const options = {
            hostname: 'www.eldorado.gg',
            path: queryPath,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({
                        results: parsed.results || [],
                        totalCount: parsed.recordCount || 0
                    });
                } catch (e) {
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
 * v3.0.0: Сканирует офферы на Eldorado и обновляет БД
 * Запускается ПОСЛЕ сканирования цен
 */
async function scanOffers(db) {
    console.log(`\n📦 Starting offer scan (${OFFER_SCAN_PAGES} pages)...`);
    const startTime = Date.now();
    
    const codesCollection = db.collection('offer_codes');
    const offersCollection = db.collection('offers');
    const now = new Date();
    
    // v3.0.4: Загружаем коды из ДВУХ источников:
    // 1. offer_codes - зарегистрированные коды
    // 2. offers - существующие офферы (offerId = код)
    const codeToOwner = new Map();
    
    // Из offer_codes
    const registeredCodes = await codesCollection.find({}).toArray();
    for (const doc of registeredCodes) {
        codeToOwner.set(doc.code.toUpperCase(), {
            farmKey: doc.farmKey,
            brainrotName: doc.brainrotName,
            source: 'offer_codes'
        });
    }
    
    // Из offers (offerId = код в тайтле)
    const existingOffers = await offersCollection.find({}).toArray();
    for (const offer of existingOffers) {
        if (offer.offerId && !codeToOwner.has(offer.offerId.toUpperCase())) {
            codeToOwner.set(offer.offerId.toUpperCase(), {
                farmKey: offer.farmKey,
                brainrotName: offer.brainrotName,
                source: 'offers'
            });
        }
    }
    
    console.log(`📋 Loaded ${codeToOwner.size} codes (${registeredCodes.length} from offer_codes, ${existingOffers.length} from offers)`);
    
    let totalScanned = 0;
    let matchedCount = 0;
    let updatedCount = 0;
    let createdCount = 0;
    const foundCodes = new Set(); // Отслеживаем найденные коды
    
    // Последовательно сканируем страницы
    for (let page = 1; page <= OFFER_SCAN_PAGES; page++) {
        const response = await fetchEldoradoOffers(page, 100);
        
        if (response.error) {
            console.warn(`⚠️ Page ${page} error: ${response.error}`);
            break;
        }
        if (!response.results?.length) break;
        
        totalScanned += response.results.length;
        
        // Обрабатываем офферы на странице
        for (const item of response.results) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            const codes = extractAllCodes(title);
            
            if (codes.length === 0) continue;
            
            // Проверяем каждый код
            for (const code of codes) {
                const owner = codeToOwner.get(code);
                if (!owner) continue;
                
                foundCodes.add(code); // Помечаем как найденный
                matchedCount++;
                
                // Данные оффера
                const price = offer.pricePerUnitInUSD?.amount || 0;
                const mutation = extractMutationFromAttributes(offer.offerAttributeIdValues);
                const imageName = offer.mainOfferImage?.originalSizeImage || offer.mainOfferImage?.largeImage;
                
                // v3.0.2: Debug логирование для отладки мутаций
                if (title.toLowerCase().includes('money money')) {
                    console.log(`🔍 DEBUG ${code}: title="${title.substring(0, 60)}...", mutation=${mutation || 'null'}`);
                    console.log(`   offerAttributeIdValues:`, JSON.stringify(offer.offerAttributeIdValues || []));
                    console.log(`   attributes (object):`, JSON.stringify(offer.attributes || []));
                    console.log(`   Full offer keys:`, Object.keys(offer || {}).join(', '));
                }
                
                // Парсим income из title
                const incomeMatch = title.match(/(\d+(?:\.\d+)?)\s*([MB])\/s/i);
                let income = null;
                if (incomeMatch) {
                    income = parseFloat(incomeMatch[1]);
                    if (incomeMatch[2].toUpperCase() === 'B') income *= 1000;
                }
                
                // Обновляем offer_codes
                await codesCollection.updateOne(
                    { code: code },
                    { $set: {
                        status: 'active',
                        eldoradoOfferId: offer.id,
                        currentPrice: price,
                        mutation: mutation,
                        lastSeenAt: now,
                        updatedAt: now
                    }}
                );
                
                // Проверяем существует ли оффер
                const existingOffer = await offersCollection.findOne({ 
                    farmKey: owner.farmKey, 
                    offerId: code 
                });
                
                if (existingOffer) {
                    // Обновляем существующий
                    await offersCollection.updateOne(
                        { _id: existingOffer._id },
                        { $set: {
                            status: 'active',
                            eldoradoOfferId: offer.id,
                            currentPrice: price,
                            mutation: mutation,
                            income: income || existingOffer.income,
                            brainrotName: owner.brainrotName || existingOffer.brainrotName,
                            imageUrl: buildImageUrl(imageName) || existingOffer.imageUrl,
                            eldoradoTitle: title,
                            sellerName: item.user?.username || null,
                            lastScannedAt: now,
                            updatedAt: now
                        }}
                    );
                    updatedCount++;
                } else {
                    // Создаём новый оффер
                    await offersCollection.insertOne({
                        farmKey: owner.farmKey,
                        offerId: code,
                        brainrotName: owner.brainrotName,
                        income: income,
                        currentPrice: price,
                        status: 'active',
                        mutation: mutation,
                        imageUrl: buildImageUrl(imageName),
                        eldoradoOfferId: offer.id,
                        eldoradoTitle: title,
                        sellerName: item.user?.username || null,
                        lastScannedAt: now,
                        createdAt: now,
                        updatedAt: now
                    });
                    createdCount++;
                }
            }
        }
        
        // Задержка между страницами (Cloudflare)
        if (page < OFFER_SCAN_PAGES) {
            await new Promise(r => setTimeout(r, OFFER_SCAN_DELAY_MS));
        }
    }
    
    // v3.0.6: Дополнительное сканирование - ищем конкретные коды пользователей которые НЕ были найдены
    // Это нужно потому что офферы могут быть на страницах дальше чем первые 10
    const notFoundCodes = [];
    for (const [code, owner] of codeToOwner.entries()) {
        if (!foundCodes.has(code)) {
            notFoundCodes.push({ code, owner });
        }
    }
    
    // v3.0.8: Приоритизируем pending офферы - сканируем их первыми
    // Это важно чтобы новые офферы быстрее получали статус active
    const pendingOffers = await offersCollection.find({ 
        status: 'pending',
        offerId: { $exists: true, $ne: null }
    }).toArray();
    const pendingCodes = new Set(pendingOffers.map(o => o.offerId?.toUpperCase()).filter(Boolean));
    
    // Сортируем: pending первые, потом остальные
    notFoundCodes.sort((a, b) => {
        const aIsPending = pendingCodes.has(a.code);
        const bIsPending = pendingCodes.has(b.code);
        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;
        return 0;
    });
    
    console.log(`📊 Priority sort: ${pendingCodes.size} pending codes will be scanned first`);
    
    if (notFoundCodes.length > 0) {
        console.log(`🔍 Searching for ${notFoundCodes.length} not-found codes by direct search...`);
        
        // v3.0.9: Курсор для direct search - сканируем разные офферы в каждом запуске
        // Получаем текущую позицию курсора из БД
        const scanStateCollection = db.collection('scan_state');
        const offerCursorDoc = await scanStateCollection.findOne({ _id: 'offer_direct_cursor' });
        let cursorPosition = offerCursorDoc?.position || 0;
        
        // Если курсор вышел за пределы - сбрасываем
        if (cursorPosition >= notFoundCodes.length) {
            cursorPosition = 0;
        }
        
        // Берём офферы начиная с позиции курсора
        const codesToSearch = notFoundCodes.slice(cursorPosition, cursorPosition + MAX_DIRECT_SEARCHES);
        const nextCursorPosition = cursorPosition + codesToSearch.length;
        
        // Сохраняем новую позицию курсора
        await scanStateCollection.updateOne(
            { _id: 'offer_direct_cursor' },
            { $set: { position: nextCursorPosition, updatedAt: now, totalCodes: notFoundCodes.length } },
            { upsert: true }
        );
        
        console.log(`📍 Direct search cursor: ${cursorPosition} → ${nextCursorPosition} of ${notFoundCodes.length}`);
        
        for (const { code, owner } of codesToSearch) {
            // Задержка между запросами
            await new Promise(r => setTimeout(r, OFFER_SCAN_DELAY_MS));
            
            // v3.0.7: Ищем по #CODE (как в scan-glitched) - searchQuery ищет в title И description
            const response = await fetchEldoradoOffers(1, 10, `#${code}`);
            
            if (response.error) {
                console.warn(`⚠️ Search for #${code} failed: ${response.error}`);
                continue;
            }
            
            if (!response.results?.length) {
                console.log(`   ❌ #${code} - not found on Eldorado`);
                continue;
            }
            
            // Ищем оффер с нашим кодом в результатах
            for (const item of response.results) {
                const offer = item.offer || item;
                const title = offer.offerTitle || '';
                const codes = extractAllCodes(title);
                
                if (!codes.includes(code)) continue;
                
                // Нашли! Обновляем
                foundCodes.add(code);
                matchedCount++;
                
                const price = offer.pricePerUnitInUSD?.amount || 0;
                const mutation = extractMutationFromAttributes(offer.offerAttributeIdValues);
                const imageName = offer.mainOfferImage?.originalSizeImage || offer.mainOfferImage?.largeImage;
                
                // Парсим income из title
                const incomeMatch = title.match(/(\d+(?:\.\d+)?)\s*([MB])\/s/i);
                let income = null;
                if (incomeMatch) {
                    income = parseFloat(incomeMatch[1]);
                    if (incomeMatch[2].toUpperCase() === 'B') income *= 1000;
                }
                
                // Обновляем offer_codes
                await codesCollection.updateOne(
                    { code: code },
                    { $set: {
                        status: 'active',
                        eldoradoOfferId: offer.id,
                        currentPrice: price,
                        mutation: mutation,
                        lastSeenAt: now,
                        updatedAt: now
                    }},
                    { upsert: true }
                );
                
                // Обновляем или создаём оффер
                const existingOffer = await offersCollection.findOne({ 
                    farmKey: owner.farmKey, 
                    offerId: code 
                });
                
                if (existingOffer) {
                    await offersCollection.updateOne(
                        { _id: existingOffer._id },
                        { $set: {
                            status: 'active',
                            eldoradoOfferId: offer.id,
                            currentPrice: price,
                            mutation: mutation,
                            income: income || existingOffer.income,
                            brainrotName: owner.brainrotName || existingOffer.brainrotName,
                            imageUrl: buildImageUrl(imageName) || existingOffer.imageUrl,
                            eldoradoTitle: title,
                            sellerName: item.user?.username || null,
                            lastScannedAt: now,
                            updatedAt: now
                        }}
                    );
                    updatedCount++;
                } else {
                    await offersCollection.insertOne({
                        farmKey: owner.farmKey,
                        offerId: code,
                        brainrotName: owner.brainrotName,
                        income: income,
                        currentPrice: price,
                        status: 'active',
                        mutation: mutation,
                        imageUrl: buildImageUrl(imageName),
                        eldoradoOfferId: offer.id,
                        eldoradoTitle: title,
                        sellerName: item.user?.username || null,
                        lastScannedAt: now,
                        createdAt: now,
                        updatedAt: now
                    });
                    createdCount++;
                }
                
                console.log(`   ✅ ${code} - FOUND via direct search! price=$${price}`);
                foundCodes.add(code); // Добавляем в found после direct search
                break; // Нашли, выходим из цикла
            }
        }
        
        if (notFoundCodes.length > codesToSearch.length) {
            const remaining = notFoundCodes.length - nextCursorPosition;
            console.log(`   ⏭️ ${remaining} codes remaining for next scan cycle`);
        }
    }
    
    // v9.12.1 FIX: Помечаем НЕ найденные офферы как paused
    // Важно: помечаем только те коды которые были проверены через direct search
    // Коды которые не попали в direct search (из-за лимита) - НЕ трогаем
    let pausedCount = 0;
    
    // v3.0.9: Используем codesToSearch которые реально были просканированы
    // codesToSearch определена внутри if блока, поэтому проверяем существование
    const searchedCodes = (typeof codesToSearch !== 'undefined' ? codesToSearch : []).map(c => c.code);
    const stillNotFound = searchedCodes.filter(code => !foundCodes.has(code));
    
    if (stillNotFound.length > 0) {
        console.log(`🔍 Marking ${stillNotFound.length} offers as paused (not found after direct search)...`);
        
        for (const code of stillNotFound) {
            const owner = codeToOwner.get(code);
            if (!owner) continue;
            
            // Обновляем offer_codes
            await codesCollection.updateOne(
                { code: code },
                { $set: { status: 'paused', pausedAt: now, updatedAt: now } }
            );
            
            // Обновляем offers
            const result = await offersCollection.updateMany(
                { farmKey: owner.farmKey, offerId: code, status: { $ne: 'paused' } },
                { $set: { status: 'paused', pausedAt: now, updatedAt: now } }
            );
            
            if (result.modifiedCount > 0) {
                pausedCount++;
                console.log(`   ⏸️ Marked paused: ${code}`);
            }
        }
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`📦 Offer scan complete: ${totalScanned} scanned, ${matchedCount} matched, ${updatedCount} updated, ${createdCount} created, ${pausedCount} paused (${duration}s)`);
    
    return { 
        totalScanned, 
        matchedCount, 
        updatedCount, 
        createdCount,
        pausedCount,
        foundCodes: foundCodes.size,
        duration 
    };
}

// ==================== END OFFER SCANNING ====================

/**
 * Главная функция сканирования
 * v2.8.0: Приоритизация - новые брейнроты первые, дубликаты пропускаются
 * v3.0.0: Добавлено сканирование офферов после цен
 * 
 * Приоритеты:
 * 1. Новые (нет в кэше) - сканируем ПЕРВЫМИ
 * 2. Не сканировались в текущем цикле - сканируем
 * 3. Уже сканировались в этом цикле - ПРОПУСКАЕМ (берём из кэша)
 */
async function runPriceScan() {
    console.log(`🚀 Starting centralized price scan v${VERSION}`);
    console.log(`⚠️ AI DISABLED: CRON_USE_AI=${CRON_USE_AI} - using regex only`);
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
    const staleBrainrots = [];    // Есть в кэше, но не в текущем цикле
    const freshBrainrots = [];    // Уже сканировались в текущем цикле - пропускаем
    
    for (const b of brainrots) {
        const cleanMut = cleanMutation(b.mutation);
        let cacheKey = `${b.name.toLowerCase()}_${b.income}`;
        if (cleanMut) cacheKey += `_${cleanMut}`;
        
        b._cacheKey = cacheKey; // Сохраняем для использования позже
        
        const cached = cachedPrices.get(cacheKey);
        
        if (!cached) {
            // Новый - нет в кэше вообще
            newBrainrots.push(b);
        } else if (cached.cycleId < scanState.cycleId) {
            // Есть в кэше, но сканировался в прошлом цикле
            staleBrainrots.push(b);
        } else {
            // Уже сканировался в текущем цикле - пропускаем
            freshBrainrots.push(b);
        }
    }
    
    console.log(`📋 Priority: ${newBrainrots.length} new, ${staleBrainrots.length} stale, ${freshBrainrots.length} fresh (skipped)`);
    
    // 4. Формируем список для сканирования: сначала новые, потом устаревшие
    const toScanAll = [...newBrainrots, ...staleBrainrots];
    
    // Ограничиваем batch
    let toScan = toScanAll.slice(0, SCAN_BATCH_SIZE);
    
    // v3.0.11: Проверяем завершился ли цикл (все отсканированы)
    // Если ничего для сканирования - начинаем новый цикл
    let isNewCycle = toScan.length === 0 && brainrots.length > 0;
    let currentCycleId = scanState.cycleId;
    
    if (isNewCycle) {
        // Начинаем новый цикл - берём ВСЕХ брейнротов, не только первых N
        // Потому что они все "fresh" для старого цикла, но "stale" для нового
        currentCycleId = scanState.cycleId + 1;
        console.log(`🔄 Cycle complete! Starting cycle #${currentCycleId}`);
        // Берём первых N для нового цикла
        toScan = brainrots.slice(0, SCAN_BATCH_SIZE);
    }
    
    console.log(`📋 Scanning ${toScan.length} brainrots (${newBrainrots.length} new priority)`);
    
    // 5. Сканируем
    let regexScanned = 0;
    let priceChanges = 0;
    let newPrices = 0;
    let errors = 0;
    let skipped = 0;
    
    for (const brainrot of toScan) {
        try {
            const cacheKey = brainrot._cacheKey;
            
            // v3.0.11: При новом цикле - сканируем всех, не пропускаем
            // В обычном режиме - пропускаем если уже сканировали в этом цикле
            if (!isNewCycle) {
                const cached = cachedPrices.get(cacheKey);
                if (cached && cached.cycleId >= currentCycleId) {
                    skipped++;
                    continue;
                }
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
            await savePriceToCache(db, brainrot.name, brainrot.income, {
                suggestedPrice: newPrice,
                source: regexResult.parsingSource || 'regex',
                priceSource: regexResult.priceSource,
                competitorPrice: regexResult.competitorPrice,
                competitorIncome: regexResult.competitorIncome,
                targetMsRange: regexResult.targetMsRange,
                medianPrice: regexResult.medianPrice,
                medianData: regexResult.medianData,
                nextCompetitorPrice: regexResult.nextCompetitorPrice,
                nextCompetitorData: regexResult.nextCompetitorData,
                nextRangeChecked: regexResult.nextRangeChecked,
                isInEldoradoList: regexResult.isInEldoradoList,
                lowerPrice: regexResult.lowerPrice,
                lowerIncome: regexResult.lowerIncome
            }, brainrot.mutation, currentCycleId);
            
            // Обновляем локальный кэш чтобы не сканировать повторно в этом запуске
            cachedPrices.set(cacheKey, { cycleId: currentCycleId, updatedAt: new Date() });
            
            // Статистика
            if (oldPrice === null || oldPrice === undefined) {
                newPrices++;
            } else if (oldPrice !== newPrice) {
                priceChanges++;
                console.log(`   💰 Price change: ${brainrot.name}${brainrot.mutation ? ' [' + brainrot.mutation + ']' : ''} @ ${brainrot.income}M/s: $${oldPrice} → $${newPrice}`);
            }
            
            // Задержка между запросами к Eldorado API
            await new Promise(r => setTimeout(r, SCAN_DELAY_MS));
            
        } catch (e) {
            errors++;
            console.warn(`Error scanning ${brainrot.name}:`, e.message);
        }
    }
    
    // 6. Сохраняем состояние
    await saveScanState(db, scanState.cycleId, regexScanned, isNewCycle);
    
    // 7. v3.0.0: Сканируем офферы
    let offerScanResult = null;
    try {
        offerScanResult = await scanOffers(db);
    } catch (e) {
        console.warn('Offer scan error:', e.message);
        offerScanResult = { error: e.message };
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
        totalBrainrots: brainrots.length,
        scanned: regexScanned,
        newPrices,
        priceChanges,
        skipped: skipped + actualFreshCount,
        errors,
        cycle: {
            id: currentCycleId,
            isNew: isNewCycle,
            progress: `${cycleProgress}%`,
            remaining: isNewCycle ? brainrots.length - regexScanned : staleBrainrots.length - regexScanned
        },
        offers: offerScanResult // v3.0.0
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
