/**
 * Price Service - AI-first ценообразование с фоновой валидацией
 * 
 * АРХИТЕКТУРА:
 * 1. Regex показывает цену сразу (мгновенно)
 * 2. AI парсит в фоне, результаты кэшируются
 * 3. При изменении цены regex → спрашиваем AI для валидации
 * 4. AI результат имеет приоритет над regex
 * 
 * ИСТОЧНИКИ ЦЕН:
 * - 'ai' - цена определена нейросетью (🤖)
 * - 'regex' - цена определена regex'ом (⚡ Bot)
 * - 'ai_validated' - regex цена подтверждена AI
 * - 'pending_ai' - ждём ответ от AI
 */

const https = require('https');
const path = require('path');
const fs = require('fs');

// Импортируем AI сканер
let aiScanner = null;
try {
    aiScanner = require('./ai-scanner.js');
    console.log('✅ AI Scanner loaded in price-service');
} catch (e) {
    console.warn('⚠️ AI Scanner not available:', e.message);
}

// Кэш AI результатов (brainrotName -> { income, price, source, timestamp, offers })
const aiPriceCache = new Map();
const AI_CACHE_TTL = 10 * 60 * 1000; // 10 минут

// Очередь брейнротов для AI валидации
const aiValidationQueue = [];
let isProcessingQueue = false;

// Кэш regex результатов для сравнения
const regexPriceCache = new Map();

// Статистика
const stats = {
    aiRequests: 0,
    regexRequests: 0,
    aiHits: 0,
    regexFallbacks: 0,
    validationRequests: 0
};

/**
 * Получает цену для брейнрота
 * Возвращает сразу regex результат, AI загружается в фоне
 * 
 * @param {string} brainrotName - название брейнрота
 * @param {number} ourIncome - наш income для расчёта
 * @returns {Object} - { price, source, aiPending, ... }
 */
async function getPrice(brainrotName, ourIncome) {
    const cacheKey = `${brainrotName.toLowerCase()}_${ourIncome}`;
    
    // 1. Проверяем AI кэш
    const aiCached = aiPriceCache.get(cacheKey);
    if (aiCached && Date.now() - aiCached.timestamp < AI_CACHE_TTL) {
        stats.aiHits++;
        return {
            ...aiCached,
            source: 'ai',
            fromCache: true
        };
    }
    
    // 2. Получаем regex результат сразу
    const { calculateOptimalPrice } = require('./eldorado-price.js');
    const regexResult = await calculateOptimalPrice(brainrotName, ourIncome);
    
    stats.regexRequests++;
    
    // Сохраняем regex результат для сравнения
    regexPriceCache.set(cacheKey, {
        price: regexResult.suggestedPrice,
        timestamp: Date.now()
    });
    
    // 3. Добавляем в очередь AI валидации (если есть API ключ)
    if (aiScanner && process.env.GEMINI_API_KEY) {
        queueAIValidation(brainrotName, ourIncome, regexResult);
    }
    
    // 4. Возвращаем regex результат с флагом ожидания AI
    return {
        ...regexResult,
        source: 'regex',
        aiPending: true,
        aiStatus: 'queued'
    };
}

/**
 * Получает AI-валидированную цену (ждёт AI результат)
 * Используется когда нужна точная цена
 */
async function getPriceWithAI(brainrotName, ourIncome) {
    const cacheKey = `${brainrotName.toLowerCase()}_${ourIncome}`;
    
    // 1. Проверяем AI кэш
    const aiCached = aiPriceCache.get(cacheKey);
    if (aiCached && Date.now() - aiCached.timestamp < AI_CACHE_TTL) {
        return { ...aiCached, source: 'ai', fromCache: true };
    }
    
    // 2. Запускаем AI парсинг
    stats.aiRequests++;
    
    try {
        const aiResult = await runAIParsing(brainrotName, ourIncome);
        
        // Кэшируем
        aiPriceCache.set(cacheKey, {
            ...aiResult,
            timestamp: Date.now()
        });
        
        return { ...aiResult, source: 'ai' };
    } catch (e) {
        console.error(`AI parsing failed for ${brainrotName}:`, e.message);
        
        // Fallback на regex
        stats.regexFallbacks++;
        const { calculateOptimalPrice } = require('./eldorado-price.js');
        const regexResult = await calculateOptimalPrice(brainrotName, ourIncome);
        
        return { ...regexResult, source: 'regex', aiError: e.message };
    }
}

/**
 * Добавляет брейнрота в очередь AI валидации
 */
function queueAIValidation(brainrotName, ourIncome, regexResult) {
    const cacheKey = `${brainrotName.toLowerCase()}_${ourIncome}`;
    
    // Не добавляем дубликаты
    const exists = aiValidationQueue.find(q => 
        q.brainrotName.toLowerCase() === brainrotName.toLowerCase() && 
        q.ourIncome === ourIncome
    );
    
    if (!exists) {
        aiValidationQueue.push({
            brainrotName,
            ourIncome,
            regexResult,
            cacheKey,
            addedAt: Date.now()
        });
        
        // Запускаем обработку очереди
        processAIQueue();
    }
}

/**
 * Обрабатывает очередь AI валидации
 * Работает в фоне, волнами по 5 брейнротов
 */
async function processAIQueue() {
    if (isProcessingQueue || aiValidationQueue.length === 0) return;
    
    isProcessingQueue = true;
    console.log(`🤖 Processing AI queue: ${aiValidationQueue.length} items`);
    
    try {
        // Берём до 5 брейнротов за раз
        const batch = aiValidationQueue.splice(0, 5);
        
        for (const item of batch) {
            try {
                stats.validationRequests++;
                
                const aiResult = await runAIParsing(item.brainrotName, item.ourIncome);
                
                // Сравниваем с regex
                const regexPrice = item.regexResult?.suggestedPrice;
                const aiPrice = aiResult?.suggestedPrice;
                
                if (aiPrice !== null && aiPrice !== undefined) {
                    // AI нашёл цену
                    console.log(`✅ AI validated ${item.brainrotName}: $${aiPrice} (regex was $${regexPrice})`);
                    
                    aiPriceCache.set(item.cacheKey, {
                        ...aiResult,
                        source: 'ai',
                        regexPrice,
                        timestamp: Date.now()
                    });
                } else if (regexPrice !== null) {
                    // AI не нашёл, но regex нашёл - используем regex
                    console.log(`⚠️ AI failed for ${item.brainrotName}, using regex: $${regexPrice}`);
                    
                    aiPriceCache.set(item.cacheKey, {
                        ...item.regexResult,
                        source: 'regex_validated',
                        aiError: aiResult?.error || 'AI returned null',
                        timestamp: Date.now()
                    });
                }
                
                // Пауза между запросами
                await new Promise(r => setTimeout(r, 500));
                
            } catch (e) {
                console.error(`AI validation error for ${item.brainrotName}:`, e.message);
            }
        }
        
        // Пауза между волнами (rate limit)
        if (aiValidationQueue.length > 0) {
            console.log(`⏳ Waiting 10s before next AI wave (${aiValidationQueue.length} remaining)`);
            await new Promise(r => setTimeout(r, 10000));
        }
        
    } catch (e) {
        console.error('AI queue processing error:', e.message);
    }
    
    isProcessingQueue = false;
    
    // Продолжаем обработку если есть ещё
    if (aiValidationQueue.length > 0) {
        processAIQueue();
    }
}

/**
 * Запускает AI парсинг для конкретного брейнрота
 */
async function runAIParsing(brainrotName, ourIncome) {
    if (!aiScanner) {
        throw new Error('AI Scanner not available');
    }
    
    // Загружаем офферы с Eldorado
    const { searchBrainrotOffers } = require('./eldorado-price.js');
    const searchResult = await searchBrainrotOffers(brainrotName, ourIncome);
    
    if (!searchResult.allPageOffers || searchResult.allPageOffers.length === 0) {
        return { suggestedPrice: null, error: 'No offers found' };
    }
    
    // Парсим через AI
    const eldoradoLists = await aiScanner.fetchEldoradoDynamicLists();
    const aiResults = await aiScanner.hybridParse(searchResult.allPageOffers, eldoradoLists);
    
    // Находим upper/lower
    const upperLower = aiScanner.findUpperLower(aiResults, ourIncome);
    
    // Рассчитываем цену
    let suggestedPrice = null;
    let priceSource = 'ai_calculated';
    
    if (upperLower.upper) {
        const upperPrice = upperLower.upper.price;
        const lowerPrice = upperLower.lower?.price || 0;
        const diff = upperPrice - lowerPrice;
        
        if (diff >= 1) {
            suggestedPrice = Math.round((upperPrice - 1) * 100) / 100;
        } else {
            suggestedPrice = Math.round((upperPrice - 0.5) * 100) / 100;
        }
    }
    
    return {
        suggestedPrice,
        priceSource,
        upperOffer: upperLower.upper,
        lowerOffer: upperLower.lower,
        aiParsedCount: aiResults.filter(r => r.source === 'ai').length,
        regexParsedCount: aiResults.filter(r => r.source === 'regex').length,
        totalOffers: aiResults.length
    };
}

/**
 * Проверяет изменение цены и валидирует через AI
 * Вызывается когда regex обнаружил изменение цены
 */
async function validatePriceChange(brainrotName, ourIncome, oldPrice, newRegexPrice) {
    console.log(`🔄 Price change detected for ${brainrotName}: $${oldPrice} → $${newRegexPrice}`);
    
    // Добавляем в приоритетную очередь
    aiValidationQueue.unshift({
        brainrotName,
        ourIncome,
        regexResult: { suggestedPrice: newRegexPrice },
        cacheKey: `${brainrotName.toLowerCase()}_${ourIncome}`,
        addedAt: Date.now(),
        priority: true
    });
    
    // Запускаем обработку
    processAIQueue();
}

/**
 * Получает статус AI кэша для брейнрота
 */
function getAIStatus(brainrotName, ourIncome) {
    const cacheKey = `${brainrotName.toLowerCase()}_${ourIncome}`;
    const cached = aiPriceCache.get(cacheKey);
    
    if (!cached) {
        return { status: 'not_cached', source: 'regex' };
    }
    
    const age = Date.now() - cached.timestamp;
    const isValid = age < AI_CACHE_TTL;
    
    return {
        status: isValid ? 'cached' : 'expired',
        source: cached.source,
        age: Math.round(age / 1000),
        price: cached.suggestedPrice
    };
}

/**
 * Получает статистику сервиса
 */
function getStats() {
    return {
        ...stats,
        queueLength: aiValidationQueue.length,
        cacheSize: aiPriceCache.size,
        isProcessing: isProcessingQueue
    };
}

/**
 * Очищает AI кэш
 */
function clearCache() {
    aiPriceCache.clear();
    regexPriceCache.clear();
    aiValidationQueue.length = 0;
    console.log('🗑️ Price service cache cleared');
}

module.exports = {
    getPrice,
    getPriceWithAI,
    validatePriceChange,
    getAIStatus,
    getStats,
    clearCache,
    queueAIValidation
};
