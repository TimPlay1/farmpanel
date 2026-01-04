/**
 * Vercel Cron Job - Централизованный сканер цен
 * 
 * Запускается каждые 10 минут через Vercel Cron
 * Сканирует ВСЕ брейнроты со ВСЕХ панелей пользователей
 * 
 * ЛОГИКА по схеме:
 * 1. Собираем все уникальные брейнроты из БД (все farmKeys)
 * 2. Regex парсит сразу - сохраняем результат
 * 3. При изменении цены → добавляем в AI очередь
 * 4. AI обрабатывает очередь батчами (7 req/min)
 * 5. Результаты сохраняются в глобальный кэш цен
 */

const { connectToDatabase } = require('./_lib/db');

// Rate limiting для Gemini
const MAX_REQUESTS_PER_MINUTE = 7;
const MAX_TOKENS_PER_MINUTE = 14000;
const TOKENS_PER_BATCH = 2500;
const MAX_BATCHES_PER_WAVE = 7; // До 7 батчей параллельно

// Загружаем модули
let aiScanner = null;
let eldoradoPrice = null;

try {
    aiScanner = require('./ai-scanner.js');
} catch (e) {
    console.warn('AI Scanner not available:', e.message);
}

try {
    eldoradoPrice = require('./eldorado-price.js');
} catch (e) {
    console.warn('Eldorado Price not available:', e.message);
}

/**
 * Собирает все уникальные брейнроты со всех панелей из БД
 */
async function collectAllBrainrotsFromDB() {
    const { db } = await connectToDatabase();
    const collection = db.collection('farmers');
    
    // Получаем все записи фермеров
    const farmers = await collection.find({}).toArray();
    
    const uniqueBrainrots = new Map();
    let totalAccounts = 0;
    let totalBrainrots = 0;
    
    for (const farmer of farmers) {
        if (!farmer.accounts) continue;
        
        for (const account of farmer.accounts) {
            if (!account.brainrots) continue;
            totalAccounts++;
            
            for (const b of account.brainrots) {
                totalBrainrots++;
                const name = b.name;
                const income = normalizeIncome(b.income, b.incomeText);
                const key = `${name.toLowerCase()}_${income}`;
                
                if (!uniqueBrainrots.has(key)) {
                    uniqueBrainrots.set(key, {
                        name,
                        income,
                        count: 1
                    });
                } else {
                    uniqueBrainrots.get(key).count++;
                }
            }
        }
    }
    
    console.log(`📊 Collected from DB: ${farmers.length} farmers, ${totalAccounts} accounts, ${totalBrainrots} brainrots, ${uniqueBrainrots.size} unique`);
    
    return Array.from(uniqueBrainrots.values());
}

/**
 * Нормализует income к числу M/s
 */
function normalizeIncome(income, incomeText) {
    if (typeof income === 'number' && income > 0) {
        // Округляем до ближайших 10
        return Math.floor(income / 10) * 10;
    }
    
    if (incomeText) {
        const match = incomeText.match(/(\d+(?:\.\d+)?)\s*([KMBT])?\/s/i);
        if (match) {
            let value = parseFloat(match[1]);
            const suffix = (match[2] || '').toUpperCase();
            
            if (suffix === 'K') value *= 0.001;
            else if (suffix === 'B') value *= 1000;
            else if (suffix === 'T') value *= 1000000;
            
            return Math.floor(value / 10) * 10;
        }
    }
    
    return 0;
}

/**
 * Получает текущую цену из глобального кэша
 */
async function getCachedPrice(db, name, income) {
    const cacheKey = `${name.toLowerCase()}_${income}`;
    const collection = db.collection('price_cache');
    
    const cached = await collection.findOne({ _id: cacheKey });
    return cached;
}

/**
 * Сохраняет цену в глобальный кэш
 */
async function savePriceToCache(db, name, income, priceData) {
    const cacheKey = `${name.toLowerCase()}_${income}`;
    const collection = db.collection('price_cache');
    
    await collection.updateOne(
        { _id: cacheKey },
        { 
            $set: {
                ...priceData,
                name,
                income,
                updatedAt: new Date()
            }
        },
        { upsert: true }
    );
}

/**
 * Добавляет в AI очередь
 */
async function addToAIQueue(db, brainrot, regexResult) {
    const collection = db.collection('ai_queue');
    const cacheKey = `${brainrot.name.toLowerCase()}_${brainrot.income}`;
    
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

/**
 * Главная функция сканирования
 */
async function runPriceScan() {
    console.log('🚀 Starting centralized price scan...');
    const startTime = Date.now();
    
    const { db } = await connectToDatabase();
    
    // 1. Собираем все брейнроты
    const brainrots = await collectAllBrainrotsFromDB();
    
    if (brainrots.length === 0) {
        console.log('No brainrots found in database');
        return { success: true, scanned: 0 };
    }
    
    // 2. Сканируем regex для каждого
    let regexScanned = 0;
    let priceChanges = 0;
    let aiQueued = 0;
    
    // Сортируем по популярности (count) - сначала самые популярные
    brainrots.sort((a, b) => b.count - a.count);
    
    // Ограничиваем до 200 за один запуск (чтобы не превысить timeout)
    const toScan = brainrots.slice(0, 200);
    
    console.log(`📋 Scanning ${toScan.length} brainrots (sorted by popularity)`);
    
    for (const brainrot of toScan) {
        try {
            // Получаем текущую кэшированную цену
            const cached = await getCachedPrice(db, brainrot.name, brainrot.income);
            const cachedPrice = cached?.suggestedPrice;
            
            // Получаем новую цену через regex (eldorado-price)
            if (!eldoradoPrice) continue;
            
            const regexResult = await eldoradoPrice.calculateOptimalPrice(brainrot.name, brainrot.income);
            regexScanned++;
            
            if (!regexResult || regexResult.error) continue;
            
            const newPrice = regexResult.suggestedPrice;
            
            // Сохраняем regex результат
            await savePriceToCache(db, brainrot.name, brainrot.income, {
                suggestedPrice: newPrice,
                source: regexResult.parsingSource || 'regex',
                priceSource: regexResult.priceSource,
                competitorPrice: regexResult.competitorPrice,
                competitorIncome: regexResult.competitorIncome,
                targetMsRange: regexResult.targetMsRange,
                // v9.10.16: Added median and nextCompetitor fields
                medianPrice: regexResult.medianPrice,
                medianData: regexResult.medianData,
                nextCompetitorPrice: regexResult.nextCompetitorPrice,
                nextCompetitorData: regexResult.nextCompetitorData,
                nextRangeChecked: regexResult.nextRangeChecked,
                isInEldoradoList: regexResult.isInEldoradoList,
                lowerPrice: regexResult.lowerPrice,
                lowerIncome: regexResult.lowerIncome
            });
            
            // Проверяем изменилась ли цена
            if (cachedPrice !== null && cachedPrice !== newPrice) {
                priceChanges++;
                console.log(`   💰 Price change: ${brainrot.name} @ ${brainrot.income}M/s: $${cachedPrice} → $${newPrice}`);
                
                // Добавляем в AI очередь для валидации
                const queued = await addToAIQueue(db, brainrot, regexResult);
                if (queued) {
                    aiQueued++;
                }
            } else if (cachedPrice === null) {
                // Новый брейнрот - тоже добавляем в AI очередь
                const queued = await addToAIQueue(db, brainrot, regexResult);
                if (queued) {
                    aiQueued++;
                }
            }
            
            // Небольшая задержка чтобы не перегружать Eldorado API
            await new Promise(r => setTimeout(r, 100));
            
        } catch (e) {
            console.warn(`Error scanning ${brainrot.name}:`, e.message);
        }
    }
    
    // 3. Обрабатываем AI очередь (если есть время и API key)
    let aiProcessed = 0;
    
    if (aiScanner && process.env.GEMINI_API_KEY) {
        const queueItems = await getAIQueueItems(db, 50);
        
        if (queueItems.length > 0) {
            console.log(`🤖 Processing ${queueItems.length} items in AI queue...`);
            
            // Создаём батчи для AI
            const batches = [];
            let currentBatch = [];
            
            for (const item of queueItems) {
                currentBatch.push(item);
                if (currentBatch.length >= 10) {
                    batches.push(currentBatch);
                    currentBatch = [];
                }
            }
            if (currentBatch.length > 0) {
                batches.push(currentBatch);
            }
            
            // Обрабатываем до 7 батчей (rate limit)
            const batchesToProcess = batches.slice(0, MAX_BATCHES_PER_WAVE);
            
            for (const batch of batchesToProcess) {
                try {
                    // Получаем офферы для каждого элемента батча
                    for (const item of batch) {
                        try {
                            // Получаем офферы с Eldorado
                            const searchResult = await eldoradoPrice.searchBrainrotOffers(item.name, item.income);
                            
                            if (!searchResult.allPageOffers || searchResult.allPageOffers.length === 0) {
                                await updateQueueItemStatus(db, item._id, 'failed');
                                continue;
                            }
                            
                            // AI парсинг
                            const eldoradoLists = await aiScanner.fetchEldoradoDynamicLists();
                            const aiResults = await aiScanner.hybridParse(searchResult.allPageOffers, eldoradoLists);
                            
                            // Находим лучшую цену из AI результатов
                            const validOffers = aiResults.filter(r => r.income !== null && r.source === 'ai');
                            
                            if (validOffers.length > 0) {
                                // Находим upper offer
                                validOffers.sort((a, b) => a.price - b.price);
                                const upperOffer = validOffers.find(o => o.income >= item.income);
                                
                                if (upperOffer) {
                                    const aiPrice = Math.round((upperOffer.price - 0.5) * 100) / 100;
                                    
                                    // Сохраняем AI результат
                                    await savePriceToCache(db, item.name, item.income, {
                                        suggestedPrice: aiPrice,
                                        source: 'ai',
                                        priceSource: `AI: upper ${upperOffer.income}M/s @ $${upperOffer.price}`,
                                        competitorPrice: upperOffer.price,
                                        competitorIncome: upperOffer.income,
                                        aiParsedCount: validOffers.length
                                    });
                                    
                                    console.log(`   🤖 AI: ${item.name} @ ${item.income}M/s → $${aiPrice}`);
                                }
                            }
                            
                            await updateQueueItemStatus(db, item._id, 'completed', { processed: true });
                            aiProcessed++;
                            
                        } catch (itemError) {
                            console.warn(`AI error for ${item.name}:`, itemError.message);
                            await updateQueueItemStatus(db, item._id, 'failed');
                        }
                    }
                    
                    // Пауза между батчами
                    await new Promise(r => setTimeout(r, 1000));
                    
                } catch (batchError) {
                    console.error('Batch error:', batchError.message);
                }
            }
        }
    }
    
    // 4. Очистка старых записей
    await cleanupQueue(db);
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    const summary = {
        success: true,
        duration: `${duration}s`,
        totalBrainrots: brainrots.length,
        scanned: regexScanned,
        priceChanges,
        aiQueued,
        aiProcessed
    };
    
    console.log(`✅ Price scan complete:`, summary);
    
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
    
    console.log(`📅 Cron price scanner triggered (byUA: ${isCronByUserAgent}, byHeader: ${isCronByHeader}, byAuth: ${isCronByAuth})`);
    
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
