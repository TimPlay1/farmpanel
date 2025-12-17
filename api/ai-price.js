/**
 * AI-First Price API
 * 
 * Использует AI как PRIMARY источник цен
 * Regex только для мгновенного показа пока AI грузится
 * 
 * Эндпоинт: /api/ai-price?name=BrainrotName&income=100
 */

const https = require('https');

// Импорты
let priceService = null;
let aiScanner = null;
let eldoradoPrice = null;

try {
    priceService = require('./price-service.js');
    console.log('✅ Price Service loaded');
} catch (e) {
    console.warn('⚠️ Price Service not available:', e.message);
}

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

// Кэш AI результатов
const aiCache = new Map();
const AI_CACHE_TTL = 10 * 60 * 1000; // 10 минут

// Очередь для AI обработки
const aiQueue = [];
let isProcessingAI = false;

// Rate limiting для Gemini
const GEMINI_RATE_LIMIT = {
    requestsPerMinute: 7,
    tokensPerMinute: 14000,
    requests: [],
    lastReset: Date.now()
};

function checkRateLimit() {
    const now = Date.now();
    
    // Сброс счётчика каждую минуту
    if (now - GEMINI_RATE_LIMIT.lastReset > 60000) {
        GEMINI_RATE_LIMIT.requests = [];
        GEMINI_RATE_LIMIT.lastReset = now;
    }
    
    // Удаляем старые запросы (старше минуты)
    GEMINI_RATE_LIMIT.requests = GEMINI_RATE_LIMIT.requests.filter(t => now - t < 60000);
    
    return GEMINI_RATE_LIMIT.requests.length < GEMINI_RATE_LIMIT.requestsPerMinute;
}

function recordRequest() {
    GEMINI_RATE_LIMIT.requests.push(Date.now());
}

/**
 * Основной метод - получает AI цену
 * Если нет в кэше - возвращает regex и ставит в очередь на AI
 */
async function getAIPrice(brainrotName, ourIncome) {
    const cacheKey = `${brainrotName.toLowerCase()}_${ourIncome}`;
    
    // 1. Проверяем AI кэш
    const cached = aiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < AI_CACHE_TTL) {
        console.log(`🤖 AI Cache HIT for ${brainrotName}`);
        return {
            ...cached.data,
            source: 'ai',
            fromCache: true,
            cacheAge: Math.round((Date.now() - cached.timestamp) / 1000)
        };
    }
    
    // 2. Нет в кэше - получаем regex результат сразу
    const regexResult = await eldoradoPrice.calculateOptimalPrice(brainrotName, ourIncome);
    
    // 3. Добавляем в очередь AI
    queueForAI(brainrotName, ourIncome, regexResult);
    
    // 4. Возвращаем regex с флагом pending
    return {
        ...regexResult,
        source: 'regex',
        aiPending: true,
        aiQueuePosition: getQueuePosition(brainrotName, ourIncome)
    };
}

/**
 * Принудительно получает AI цену (ждёт результат)
 */
async function forceAIPrice(brainrotName, ourIncome) {
    const cacheKey = `${brainrotName.toLowerCase()}_${ourIncome}`;
    
    // Проверяем кэш
    const cached = aiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < AI_CACHE_TTL) {
        return { ...cached.data, source: 'ai', fromCache: true };
    }
    
    // Проверяем rate limit
    if (!checkRateLimit()) {
        // Fallback на regex
        const regexResult = await eldoradoPrice.calculateOptimalPrice(brainrotName, ourIncome);
        return {
            ...regexResult,
            source: 'regex',
            aiError: 'Rate limit exceeded',
            waitTime: 60 - Math.round((Date.now() - GEMINI_RATE_LIMIT.lastReset) / 1000)
        };
    }
    
    console.log(`🤖 Force AI parsing for ${brainrotName}...`);
    
    try {
        recordRequest();
        
        // Получаем офферы
        const searchResult = await eldoradoPrice.searchBrainrotOffers(brainrotName, ourIncome);
        
        if (!searchResult.allPageOffers || searchResult.allPageOffers.length === 0) {
            throw new Error('No offers found');
        }
        
        // AI парсинг
        const eldoradoLists = await aiScanner.fetchEldoradoDynamicLists();
        const aiResults = await aiScanner.hybridParse(searchResult.allPageOffers, eldoradoLists);
        
        // Считаем статистику
        const aiParsed = aiResults.filter(r => r.source === 'ai');
        const regexParsed = aiResults.filter(r => r.source === 'regex');
        
        console.log(`   AI: ${aiParsed.length}, Regex: ${regexParsed.length}, Total: ${aiResults.length}`);
        
        // Находим upper/lower
        let upperOffer = null;
        let lowerOffer = null;
        
        // Сортируем по цене
        const sortedByPrice = aiResults
            .filter(r => r.income !== null && r.income > 0)
            .sort((a, b) => a.price - b.price);
        
        for (const offer of sortedByPrice) {
            if (!upperOffer && offer.income >= ourIncome) {
                upperOffer = offer;
            } else if (upperOffer && !lowerOffer && offer.income < ourIncome && offer.price <= upperOffer.price) {
                lowerOffer = offer;
            }
            if (upperOffer && lowerOffer) break;
        }
        
        // Рассчитываем цену
        let suggestedPrice = null;
        let priceSource = 'ai_calculated';
        
        if (upperOffer) {
            const upperPrice = upperOffer.price;
            const lowerPrice = lowerOffer?.price || 0;
            const diff = upperPrice - lowerPrice;
            
            if (diff >= 1) {
                suggestedPrice = Math.round((upperPrice - 1) * 100) / 100;
                priceSource = `AI: upper ${upperOffer.income}M/s @ $${upperPrice.toFixed(2)}, diff >= $1 → -$1`;
            } else {
                suggestedPrice = Math.round((upperPrice - 0.5) * 100) / 100;
                priceSource = `AI: upper ${upperOffer.income}M/s @ $${upperPrice.toFixed(2)}, diff < $1 → -$0.50`;
            }
        } else if (sortedByPrice.length > 0) {
            // Выше рынка
            const maxIncomeOffer = sortedByPrice.reduce((max, o) => o.income > max.income ? o : max);
            suggestedPrice = Math.round((maxIncomeOffer.price - 0.5) * 100) / 100;
            priceSource = `AI: above market, max ${maxIncomeOffer.income}M/s @ $${maxIncomeOffer.price.toFixed(2)} → -$0.50`;
        }
        
        const result = {
            suggestedPrice,
            priceSource,
            source: 'ai',
            brainrotName,
            ourIncome,
            offersFound: aiResults.length,
            aiParsedCount: aiParsed.length,
            regexParsedCount: regexParsed.length,
            upperOffer: upperOffer ? { income: upperOffer.income, price: upperOffer.price, source: upperOffer.source } : null,
            lowerOffer: lowerOffer ? { income: lowerOffer.income, price: lowerOffer.price, source: lowerOffer.source } : null,
            samples: aiResults.slice(0, 5).map(r => ({
                income: r.income,
                price: r.price,
                source: r.source,
                title: r.title?.substring(0, 50)
            }))
        };
        
        // Кэшируем
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
 * Добавляет в очередь на AI обработку
 */
function queueForAI(brainrotName, ourIncome, regexResult) {
    const existing = aiQueue.find(q => 
        q.brainrotName.toLowerCase() === brainrotName.toLowerCase() && 
        q.ourIncome === ourIncome
    );
    
    if (!existing) {
        aiQueue.push({ brainrotName, ourIncome, regexResult, addedAt: Date.now() });
        processAIQueue();
    }
}

/**
 * Возвращает позицию в очереди
 */
function getQueuePosition(brainrotName, ourIncome) {
    const idx = aiQueue.findIndex(q => 
        q.brainrotName.toLowerCase() === brainrotName.toLowerCase() && 
        q.ourIncome === ourIncome
    );
    return idx >= 0 ? idx + 1 : 0;
}

/**
 * Обрабатывает очередь AI
 */
async function processAIQueue() {
    if (isProcessingAI || aiQueue.length === 0) return;
    
    isProcessingAI = true;
    
    while (aiQueue.length > 0 && checkRateLimit()) {
        const item = aiQueue.shift();
        
        try {
            await forceAIPrice(item.brainrotName, item.ourIncome);
        } catch (e) {
            console.error(`Queue processing error for ${item.brainrotName}:`, e.message);
        }
        
        // Пауза между запросами
        await new Promise(r => setTimeout(r, 9000)); // ~6.6 запросов в минуту
    }
    
    isProcessingAI = false;
    
    // Если остались в очереди - продолжим через минуту
    if (aiQueue.length > 0) {
        console.log(`⏳ ${aiQueue.length} items in AI queue, waiting for rate limit reset...`);
        setTimeout(() => processAIQueue(), 60000);
    }
}

/**
 * Получает статус AI кэша
 */
function getAIStatus(brainrotName, ourIncome) {
    const cacheKey = `${brainrotName.toLowerCase()}_${ourIncome}`;
    const cached = aiCache.get(cacheKey);
    
    if (!cached) {
        const queuePos = getQueuePosition(brainrotName, ourIncome);
        return { 
            status: queuePos > 0 ? 'queued' : 'not_cached', 
            queuePosition: queuePos,
            source: 'regex' 
        };
    }
    
    const age = Date.now() - cached.timestamp;
    return {
        status: age < AI_CACHE_TTL ? 'cached' : 'expired',
        source: 'ai',
        age: Math.round(age / 1000),
        price: cached.data.suggestedPrice
    };
}

/**
 * Получает статистику
 */
function getStats() {
    return {
        cacheSize: aiCache.size,
        queueLength: aiQueue.length,
        isProcessing: isProcessingAI,
        rateLimit: {
            used: GEMINI_RATE_LIMIT.requests.length,
            max: GEMINI_RATE_LIMIT.requestsPerMinute,
            resetIn: Math.max(0, 60 - Math.round((Date.now() - GEMINI_RATE_LIMIT.lastReset) / 1000))
        }
    };
}

/**
 * Очищает кэш
 */
function clearCache() {
    aiCache.clear();
    console.log('🗑️ AI Price cache cleared');
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
    
    const { name, brainrot, income, force, status, stats: getStatsFlag, clear } = req.query;
    const brainrotName = name || brainrot;
    const ourIncome = parseFloat(income) || 0;
    
    // Эндпоинт статистики
    if (getStatsFlag !== undefined) {
        return res.status(200).json(getStats());
    }
    
    // Эндпоинт очистки кэша
    if (clear !== undefined) {
        clearCache();
        return res.status(200).json({ message: 'Cache cleared' });
    }
    
    // Эндпоинт статуса
    if (status !== undefined && brainrotName) {
        return res.status(200).json(getAIStatus(brainrotName, ourIncome));
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
            // Обычный запрос (regex сразу, AI в фоне)
            result = await getAIPrice(brainrotName, ourIncome);
        }
        
        return res.status(200).json(result);
    } catch (err) {
        console.error('AI Price API error:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Экспорты
module.exports.getAIPrice = getAIPrice;
module.exports.forceAIPrice = forceAIPrice;
module.exports.getAIStatus = getAIStatus;
module.exports.getStats = getStats;
module.exports.clearCache = clearCache;
