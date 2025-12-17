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
 * Основной метод - получает цену с AI приоритетом
 */
async function getAIPrice(brainrotName, ourIncome) {
    const cacheKey = `${brainrotName.toLowerCase()}_${Math.round(ourIncome)}`;
    
    // 1. Проверяем AI кэш
    const aiCached = aiCache.get(cacheKey);
    if (aiCached && Date.now() - aiCached.timestamp < AI_CACHE_TTL) {
        return {
            ...aiCached.data,
            source: 'ai',
            fromCache: true,
            cacheAge: Math.round((Date.now() - aiCached.timestamp) / 1000)
        };
    }
    
    // 2. Получаем regex результат
    const regexResult = await eldoradoPrice.calculateOptimalPrice(brainrotName, ourIncome);
    
    // 3. Проверяем изменилась ли цена
    const prevPrice = previousPrices.get(cacheKey);
    const currentPrice = regexResult.suggestedPrice;
    const priceChanged = prevPrice !== undefined && prevPrice !== currentPrice;
    
    // Сохраняем текущую цену
    if (currentPrice !== null) {
        previousPrices.set(cacheKey, currentPrice);
    }
    
    // 4. Если цена изменилась - добавляем в очередь AI валидации
    if (priceChanged && currentPrice !== null) {
        console.log(`📊 Price changed for ${brainrotName}: $${prevPrice} → $${currentPrice}, queuing for AI validation`);
        queueForAIValidation(brainrotName, ourIncome, regexResult);
    }
    
    // 5. Возвращаем regex результат
    return {
        ...regexResult,
        source: 'regex',
        priceChanged,
        prevPrice: prevPrice || null
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
    
    aiValidationQueue.push({
        brainrotName,
        ourIncome,
        regexResult,
        cacheKey,
        addedAt: Date.now()
    });
    
    console.log(`📋 Queued ${brainrotName} for AI validation (queue: ${aiValidationQueue.length})`);
    
    // Запускаем обработку очереди
    processAIQueue();
}

/**
 * Обрабатывает очередь AI валидации в фоне
 */
async function processAIQueue() {
    if (isProcessingQueue || aiValidationQueue.length === 0) return;
    
    isProcessingQueue = true;
    console.log(`🤖 Processing AI queue: ${aiValidationQueue.length} items`);
    
    while (aiValidationQueue.length > 0) {
        // Проверяем rate limit
        if (!rateLimit.canMakeRequest()) {
            const waitTime = rateLimit.getWaitTime();
            console.log(`⏳ Rate limit, waiting ${Math.round(waitTime/1000)}s...`);
            await new Promise(r => setTimeout(r, waitTime + 1000));
            continue;
        }
        
        const item = aiValidationQueue.shift();
        
        try {
            const aiResult = await forceAIPrice(item.brainrotName, item.ourIncome);
            
            if (aiResult.source === 'ai' && aiResult.suggestedPrice !== null) {
                const regexPrice = item.regexResult?.suggestedPrice;
                const aiPrice = aiResult.suggestedPrice;
                
                if (regexPrice !== aiPrice) {
                    console.log(`🔄 AI validation: ${item.brainrotName} - regex $${regexPrice} vs AI $${aiPrice} → using AI`);
                } else {
                    console.log(`✅ AI confirmed: ${item.brainrotName} @ $${aiPrice}`);
                }
            }
        } catch (e) {
            console.error(`AI validation error for ${item.brainrotName}:`, e.message);
            // Возвращаем в конец очереди для retry
            aiValidationQueue.push(item);
        }
        
        // Пауза между запросами (чтобы не превысить rate limit)
        await new Promise(r => setTimeout(r, 9000));
    }
    
    isProcessingQueue = false;
    console.log('✅ AI queue processing complete');
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
