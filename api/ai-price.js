/**
 * AI-First Price API
 * 
 * ЛОГИКА:
 * 1. Regex парсит сразу - показывает мгновенно
 * 2. Если есть AI кэш - возвращает AI результат
 * 3. При изменении цены regex → добавляет в очередь AI валидации
 * 4. AI результат имеет приоритет над regex
 * 
 * Эндпоинт: /api/ai-price?name=BrainrotName&income=100
 */

// Импорты
let aiScanner = null;
let eldoradoPrice = null;

try {
    aiScanner = require('./ai-scanner.js');
    console.log('✅ AI Scanner loaded');
} catch (e) {
    console.warn('⚠️ AI Scanner not available:', e.message);
}

try {
    eldoradoPrice = require('./eldorado-price.js');
    console.log('✅ Eldorado Price loaded');
} catch (e) {
    console.warn('⚠️ Eldorado Price not available:', e.message);
}

// Кэш AI результатов (brainrot_income -> {data, timestamp})
const aiCache = new Map();
const AI_CACHE_TTL = 10 * 60 * 1000; // 10 минут

// Кэш предыдущих regex цен для отслеживания изменений
const previousPrices = new Map();

// Очередь брейнротов на AI валидацию
const aiValidationQueue = [];
let isProcessingQueue = false;

// Rate limiting для Gemini (7 req/min, 14K tokens/min)
const rateLimit = {
    requests: [],
    maxPerMinute: 7,
    
    canMakeRequest() {
        const now = Date.now();
        // Удаляем запросы старше минуты
        this.requests = this.requests.filter(t => now - t < 60000);
        return this.requests.length < this.maxPerMinute;
    },
    
    recordRequest() {
        this.requests.push(Date.now());
    },
    
    getWaitTime() {
        if (this.requests.length === 0) return 0;
        const oldest = Math.min(...this.requests);
        return Math.max(0, 60000 - (Date.now() - oldest));
    }
};

/**
 * Основной метод - получает цену
 * 
 * ЛОГИКА ПО СХЕМЕ:
 * 1. Проверяем AI кэш → если есть свежий AI результат, возвращаем его
 * 2. Regex парсит сразу → показываем пользователю мгновенно
 * 3. AI добавляется в очередь → парсит параллельно
 * 4. Когда AI готов → кэшируем, следующий запрос получит AI цену
 */
async function getAIPrice(brainrotName, ourIncome) {
    const cacheKey = `${brainrotName.toLowerCase()}_${Math.round(ourIncome)}`;
    
    // 1. Проверяем AI кэш - если есть свежий AI результат, возвращаем его
    const aiCached = aiCache.get(cacheKey);
    if (aiCached && Date.now() - aiCached.timestamp < AI_CACHE_TTL) {
        console.log(`🤖 AI cache HIT for ${brainrotName}: $${aiCached.data.suggestedPrice}`);
        return {
            ...aiCached.data,
            source: 'ai',
            fromCache: true,
            cacheAge: Math.round((Date.now() - aiCached.timestamp) / 1000)
        };
    }
    
    // 2. Нет AI кэша - получаем regex результат СРАЗУ
    const regexResult = await eldoradoPrice.calculateOptimalPrice(brainrotName, ourIncome);
    
    // 3. Сохраняем regex цену для сравнения
    const prevPrice = previousPrices.get(cacheKey);
    const currentPrice = regexResult.suggestedPrice;
    if (currentPrice !== null) {
        previousPrices.set(cacheKey, currentPrice);
    }
    
    // 4. ВСЕГДА добавляем в очередь AI валидации (не только при изменении)
    // Но только если нет в очереди уже
    const alreadyQueued = aiValidationQueue.some(q => q.cacheKey === cacheKey);
    if (!alreadyQueued && currentPrice !== null) {
        queueForAIValidation(brainrotName, ourIncome, regexResult);
    }
    
    // 5. Возвращаем regex результат сразу (AI обновит кэш позже)
    return {
        ...regexResult,
        source: 'regex',
        aiQueued: !alreadyQueued,
        queueLength: aiValidationQueue.length
    };
}

/**
 * Принудительный AI парсинг (для force mode)
 */
async function forceAIPrice(brainrotName, ourIncome) {
    const cacheKey = `${brainrotName.toLowerCase()}_${Math.round(ourIncome)}`;
    
    // Проверяем кэш
    const cached = aiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < AI_CACHE_TTL) {
        return { ...cached.data, source: 'ai', fromCache: true };
    }
    
    // Проверяем rate limit
    if (!rateLimit.canMakeRequest()) {
        console.log(`⏳ Rate limit, wait ${rateLimit.getWaitTime()}ms`);
        // Возвращаем regex как fallback
        const regexResult = await eldoradoPrice.calculateOptimalPrice(brainrotName, ourIncome);
        return {
            ...regexResult,
            source: 'regex',
            aiError: 'Rate limit exceeded',
            waitTime: Math.round(rateLimit.getWaitTime() / 1000)
        };
    }
    
    try {
        console.log(`🤖 Force AI parsing for ${brainrotName} @ ${ourIncome}M/s...`);
        rateLimit.recordRequest();
        
        // Получаем офферы с Eldorado
        const searchResult = await eldoradoPrice.searchBrainrotOffers(brainrotName, ourIncome);
        
        if (!searchResult.allPageOffers || searchResult.allPageOffers.length === 0) {
            throw new Error('No offers found on Eldorado');
        }
        
        // AI парсинг через hybridParse
        const eldoradoLists = await aiScanner.fetchEldoradoDynamicLists();
        const aiResults = await aiScanner.hybridParse(searchResult.allPageOffers, eldoradoLists);
        
        // Статистика
        const aiParsed = aiResults.filter(r => r.source === 'ai');
        const regexParsed = aiResults.filter(r => r.source === 'regex');
        console.log(`   AI: ${aiParsed.length}, Regex: ${regexParsed.length}`);
        
        // Находим upper/lower из AI результатов
        const validOffers = aiResults.filter(r => r.income !== null && r.income > 0);
        validOffers.sort((a, b) => a.price - b.price);
        
        let upperOffer = null;
        let lowerOffer = null;
        
        for (const offer of validOffers) {
            if (!upperOffer && offer.income >= ourIncome) {
                upperOffer = offer;
            }
            if (upperOffer && !lowerOffer && offer.income < ourIncome && offer.price <= upperOffer.price) {
                lowerOffer = offer;
            }
        }
        
        // Рассчитываем цену
        let suggestedPrice = null;
        let priceSource = 'ai';
        
        if (upperOffer) {
            const upperPrice = upperOffer.price;
            const lowerPrice = lowerOffer?.price || 0;
            const diff = upperPrice - lowerPrice;
            
            if (diff >= 1) {
                suggestedPrice = Math.round((upperPrice - 1) * 100) / 100;
                priceSource = `AI: upper ${upperOffer.income}M/s @ $${upperPrice.toFixed(2)}, diff >= $1`;
            } else {
                suggestedPrice = Math.round((upperPrice - 0.5) * 100) / 100;
                priceSource = `AI: upper ${upperOffer.income}M/s @ $${upperPrice.toFixed(2)}, diff < $1`;
            }
        } else if (validOffers.length > 0) {
            // Выше рынка
            const maxIncomeOffer = validOffers.reduce((max, o) => o.income > max.income ? o : max);
            suggestedPrice = Math.round((maxIncomeOffer.price - 0.5) * 100) / 100;
            priceSource = `AI: above market, max ${maxIncomeOffer.income}M/s`;
        }
        
        // v9.10.10: Вычисляем medianPrice и nextCompetitorPrice для AI результатов
        let medianPrice = null;
        let medianData = null;
        let nextCompetitorPrice = null;
        let nextCompetitorData = null;
        
        // Median: медиана цен из первых 24 офферов
        if (validOffers.length >= 3) {
            const prices = validOffers.slice(0, 24).map(o => o.price).sort((a, b) => a - b);
            const mid = Math.floor(prices.length / 2);
            const median = prices.length % 2 === 0 
                ? (prices[mid - 1] + prices[mid]) / 2 
                : prices[mid];
            const minPrice = Math.min(...prices);
            const diff = median - minPrice;
            const reduction = Math.min(1.0, Math.max(0.1, diff * 0.15));
            medianPrice = Math.round((median - reduction) * 100) / 100;
            medianData = {
                offersUsed: prices.length,
                medianValue: median,
                minPrice: minPrice,
                maxPrice: Math.max(...prices),
                source: 'ai'
            };
        }
        
        // NextCompetitor: следующий конкурент после upper
        if (upperOffer && validOffers.length > 1) {
            // Ищем следующий оффер с тем же или большим income но более высокой ценой
            const nextComp = validOffers.find(o => 
                o.income >= upperOffer.income && 
                o.price > upperOffer.price &&
                o !== upperOffer
            );
            if (nextComp) {
                const ncDiff = nextComp.price - upperOffer.price;
                const ncReduction = Math.min(1.0, Math.max(0.1, ncDiff * 0.15));
                nextCompetitorPrice = Math.round((nextComp.price - ncReduction) * 100) / 100;
                nextCompetitorData = {
                    income: nextComp.income,
                    price: nextComp.price,
                    lowerPrice: upperOffer.price,
                    lowerIncome: upperOffer.income,
                    priceDiff: ncDiff,
                    source: 'ai'
                };
            }
        }
        
        const result = {
            suggestedPrice,
            priceSource,
            source: 'ai',
            brainrotName,
            targetMsRange: searchResult.targetMsRange,
            offersFound: aiResults.length,
            aiParsedCount: aiParsed.length,
            regexParsedCount: regexParsed.length,
            competitorPrice: upperOffer?.price || null,
            competitorIncome: upperOffer?.income || null,
            lowerPrice: lowerOffer?.price || null,
            lowerIncome: lowerOffer?.income || null,
            // v9.10.10: Добавляем median и nextCompetitor
            medianPrice,
            medianData,
            nextCompetitorPrice,
            nextCompetitorData,
            samples: aiResults.slice(0, 5).map(r => ({
                income: r.income,
                price: r.price,
                source: r.source,
                title: r.title?.substring(0, 50)
            }))
        };
        
        // Кэшируем AI результат
        aiCache.set(cacheKey, { data: result, timestamp: Date.now() });
        
        console.log(`✅ AI price for ${brainrotName}: $${suggestedPrice}`);
        return result;
        
    } catch (e) {
        console.error(`❌ AI parsing failed for ${brainrotName}:`, e.message);
        
        // Fallback на regex
        const regexResult = await eldoradoPrice.calculateOptimalPrice(brainrotName, ourIncome);
        return {
            ...regexResult,
            source: 'regex',
            aiError: e.message
        };
    }
}

/**
 * Добавляет брейнрота в очередь AI валидации
 */
function queueForAIValidation(brainrotName, ourIncome, regexResult) {
    const cacheKey = `${brainrotName.toLowerCase()}_${Math.round(ourIncome)}`;
    
    // Не добавляем дубликаты
    const exists = aiValidationQueue.find(q => q.cacheKey === cacheKey);
    if (exists) return;
    
    // Лимит очереди - не более 100 элементов
    if (aiValidationQueue.length >= 100) {
        console.log(`⚠️ AI queue full (100), skipping ${brainrotName}`);
        return;
    }
    
    aiValidationQueue.push({
        brainrotName,
        ourIncome,
        regexResult,
        cacheKey,
        addedAt: Date.now(),
        retries: 0
    });
    
    console.log(`📋 Queued ${brainrotName} @ ${ourIncome}M/s for AI (queue: ${aiValidationQueue.length})`);
    
    // Запускаем обработку очереди
    processAIQueue();
}

/**
 * Обрабатывает очередь AI валидации в фоне
 * Волнами по схеме: 7 запросов в минуту
 */
async function processAIQueue() {
    if (isProcessingQueue || aiValidationQueue.length === 0) return;
    
    isProcessingQueue = true;
    console.log(`🤖 Starting AI queue processing: ${aiValidationQueue.length} items`);
    
    while (aiValidationQueue.length > 0) {
        // Проверяем rate limit
        if (!rateLimit.canMakeRequest()) {
            const waitTime = rateLimit.getWaitTime();
            console.log(`⏳ Rate limit hit, waiting ${Math.round(waitTime/1000)}s...`);
            await new Promise(r => setTimeout(r, waitTime + 1000));
            continue;
        }
        
        const item = aiValidationQueue.shift();
        
        try {
            console.log(`🔍 AI processing: ${item.brainrotName} @ ${item.ourIncome}M/s`);
            const aiResult = await forceAIPrice(item.brainrotName, item.ourIncome);
            
            if (aiResult.source === 'ai' && aiResult.suggestedPrice !== null) {
                const regexPrice = item.regexResult?.suggestedPrice;
                const aiPrice = aiResult.suggestedPrice;
                
                if (regexPrice !== aiPrice) {
                    console.log(`   📊 DIFFERENT: regex $${regexPrice} vs AI $${aiPrice} → using AI`);
                } else {
                    console.log(`   ✅ CONFIRMED: $${aiPrice}`);
                }
            } else {
                console.log(`   ⚠️ AI returned no price, using regex $${item.regexResult?.suggestedPrice}`);
            }
        } catch (e) {
            console.error(`   ❌ AI error for ${item.brainrotName}:`, e.message);
            
            // Retry максимум 2 раза
            if (item.retries < 2) {
                item.retries++;
                aiValidationQueue.push(item); // В конец очереди
                console.log(`   🔄 Retry ${item.retries}/2 queued`);
            } else {
                console.log(`   ⛔ Max retries reached, skipping`);
            }
        }
        
        // Пауза между запросами (9 сек = ~6.6 req/min < 7 limit)
        await new Promise(r => setTimeout(r, 9000));
    }
    
    isProcessingQueue = false;
    console.log('✅ AI queue empty, processing complete');
}

/**
 * Возвращает статус AI системы
 */
function getStats() {
    return {
        cacheSize: aiCache.size,
        queueLength: aiValidationQueue.length,
        isProcessing: isProcessingQueue,
        rateLimit: {
            used: rateLimit.requests.length,
            max: rateLimit.maxPerMinute,
            waitTime: Math.round(rateLimit.getWaitTime() / 1000)
        },
        previousPricesTracked: previousPrices.size
    };
}

/**
 * Очищает кэши
 */
function clearCache() {
    aiCache.clear();
    previousPrices.clear();
    console.log('🗑️ AI cache cleared');
}

/**
 * Vercel serverless handler
 */
module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const { name, brainrot, income, force, stats: getStatsFlag, clear } = req.query;
    const brainrotName = name || brainrot;
    const ourIncome = parseFloat(income) || 0;
    
    // Статистика
    if (getStatsFlag !== undefined) {
        return res.status(200).json(getStats());
    }
    
    // Очистка кэша
    if (clear !== undefined) {
        clearCache();
        return res.status(200).json({ message: 'Cache cleared' });
    }
    
    if (!brainrotName) {
        return res.status(400).json({ error: 'Missing brainrot name' });
    }
    
    try {
        let result;
        
        if (force !== undefined) {
            // Принудительный AI парсинг
            result = await forceAIPrice(brainrotName, ourIncome);
        } else {
            // Обычный запрос - regex сразу, AI в фоне при изменениях
            result = await getAIPrice(brainrotName, ourIncome);
        }
        
        return res.status(200).json(result);
    } catch (err) {
        console.error('AI Price API error:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Экспорты для тестирования
module.exports.getAIPrice = getAIPrice;
module.exports.forceAIPrice = forceAIPrice;
module.exports.getStats = getStats;
module.exports.clearCache = clearCache;
module.exports.queueForAIValidation = queueForAIValidation;
