/**
 * AI-First Price API
 * 
 * ЛОГИКА:
 * 1. Regex парсит сразу - показывает мгновенно
 * 2. Если есть AI кэш - возвращает AI результат
 * 3. При изменении цены regex → добавляет в очередь AI валидации
 * 4. AI результат имеет приоритет над regex
 * 
 * v2.5.2: AI кэш теперь в MongoDB для работы между serverless инстансами
 * 
 * Эндпоинт: /api/ai-price?name=BrainrotName&income=100
 */

// Импорты - AI кэш теперь в MongoDB
const { checkGlobalRateLimit, getAIUsageStats, getAICache, setAICache } = require('./_lib/db');

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

// УДАЛЁН in-memory кэш - теперь используем MongoDB через getAICache/setAICache
// Это позволяет сохранять AI результаты между serverless инстансами
const AI_CACHE_TTL = 10 * 60 * 1000; // 10 минут (для совместимости)

// Кэш предыдущих regex цен для отслеживания изменений (локальный OK - не критичен)
const previousPrices = new Map();

// Очередь брейнротов на AI валидацию
// ВАЖНО: В serverless очередь не персистентна, но это OK - 
// AI вызывается через force при необходимости
const aiValidationQueue = [];
let isProcessingQueue = false;

// УДАЛЁН локальный rate limiter - используем глобальный из db.js
// Старый локальный лимитер не работает между serverless инстансами!
// Теперь используем checkGlobalRateLimit() и recordAIUsage() из db.js

/**
 * Основной метод - получает цену
 * 
 * ЛОГИКА ПО СХЕМЕ:
 * 1. Проверяем AI кэш (MongoDB) → если есть свежий AI результат, возвращаем его
 * 2. Regex парсит сразу → показываем пользователю мгновенно
 * 3. AI вызывается сразу (не в очередь) если rate limit позволяет
 * 4. AI результат кэшируется в MongoDB
 */
async function getAIPrice(brainrotName, ourIncome) {
    const cacheKey = `${brainrotName.toLowerCase()}_${Math.round(ourIncome)}`;
    
    // 1. Проверяем AI кэш в MongoDB - если есть свежий AI результат, возвращаем его
    const aiCached = await getAICache(cacheKey);
    if (aiCached) {
        console.log(`🤖 AI cache HIT (MongoDB) for ${brainrotName}: $${aiCached.suggestedPrice}`);
        return {
            ...aiCached,
            source: 'ai',
            fromCache: true
        };
    }
    
    // 2. Нет AI кэша - получаем regex результат СРАЗУ
    const regexResult = await eldoradoPrice.calculateOptimalPrice(brainrotName, ourIncome);
    
    // 3. Пробуем вызвать AI сразу (если rate limit позволяет)
    // Это лучше чем очередь которая теряется в serverless
    try {
        const rateCheck = await checkGlobalRateLimit(1500);
        if (rateCheck.allowed && aiScanner) {
            console.log(`🤖 Trying AI for ${brainrotName} (rate limit OK)...`);
            
            // Запускаем AI парсинг
            const aiResult = await forceAIPrice(brainrotName, ourIncome);
            
            if (aiResult && aiResult.source === 'ai' && aiResult.suggestedPrice !== null) {
                console.log(`✅ AI success for ${brainrotName}: $${aiResult.suggestedPrice}`);
                return aiResult;
            }
        } else {
            console.log(`⏳ Rate limit, returning regex for ${brainrotName}`);
        }
    } catch (e) {
        console.warn(`AI failed for ${brainrotName}, using regex:`, e.message);
    }
    
    // 4. Возвращаем regex результат
    return {
        ...regexResult,
        source: 'regex'
    };
}

/**
 * Принудительный AI парсинг (для force mode)
 * v2.5.2: Кэш теперь в MongoDB
 */
async function forceAIPrice(brainrotName, ourIncome) {
    const cacheKey = `${brainrotName.toLowerCase()}_${Math.round(ourIncome)}`;
    
    // Проверяем MongoDB кэш
    const cached = await getAICache(cacheKey);
    if (cached) {
        return { ...cached, source: 'ai', fromCache: true };
    }
    
    // Rate limit теперь проверяется внутри hybridParse для каждого батча
    // Это позволяет получить частичные AI результаты вместо полного отказа
    
    try {
        console.log(`🤖 Force AI parsing for ${brainrotName} @ ${ourIncome}M/s...`);
        
        // Проверяем что aiScanner загружен
        if (!aiScanner) {
            throw new Error('AI Scanner module not loaded');
        }
        
        // Получаем офферы с Eldorado
        const searchResult = await eldoradoPrice.searchBrainrotOffers(brainrotName, ourIncome);
        
        if (!searchResult.allPageOffers || searchResult.allPageOffers.length === 0) {
            throw new Error('No offers found on Eldorado');
        }
        
        // НЕ записываем usage здесь - hybridParse сам записывает для каждого батча
        // Это предотвращает двойной учёт токенов
        
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
        
        // v9.10.12: Функция процентного уменьшения (15% от разницы, min $0.10, max $1.00)
        // Если lower нету - используем минимальное уменьшение $0.10
        function calculateReduction(competitorPrice, lowerPrice, hasLower) {
            if (!hasLower) return 0.10; // Нет lower = минимальное уменьшение
            const diff = competitorPrice - lowerPrice;
            return Math.min(1.0, Math.max(0.1, diff * 0.15));
        }
        
        // Рассчитываем цену
        let suggestedPrice = null;
        let priceSource = 'ai';
        
        if (upperOffer) {
            const upperPrice = upperOffer.price;
            const lowerPrice = lowerOffer?.price || 0;
            const hasLower = lowerOffer !== null && lowerOffer !== undefined;
            
            // v9.10.12: Процентное уменьшение, $0.10 если нет lower
            const reduction = calculateReduction(upperPrice, lowerPrice, hasLower);
            suggestedPrice = Math.round((upperPrice - reduction) * 100) / 100;
            priceSource = hasLower 
                ? `AI: upper ${upperOffer.income}M/s @ $${upperPrice.toFixed(2)}, lower $${lowerPrice.toFixed(2)}, diff $${(upperPrice - lowerPrice).toFixed(2)} → -$${reduction.toFixed(2)}`
                : `AI: upper ${upperOffer.income}M/s @ $${upperPrice.toFixed(2)}, no lower → -$${reduction.toFixed(2)}`;
        } else if (validOffers.length > 0) {
            // Выше рынка - нет lower, используем минимальное уменьшение
            const maxIncomeOffer = validOffers.reduce((max, o) => o.income > max.income ? o : max);
            const reduction = 0.10; // v9.10.12: above market = минимальное уменьшение
            suggestedPrice = Math.round((maxIncomeOffer.price - reduction) * 100) / 100;
            priceSource = `AI: above market, max ${maxIncomeOffer.income}M/s @ $${maxIncomeOffer.price.toFixed(2)} → -$${reduction.toFixed(2)}`;
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
        
        // NextCompetitor: следующий конкурент после upper (с большей ценой)
        if (upperOffer && validOffers.length > 1) {
            // Офферы отсортированы по цене от меньшей к большей
            // Ищем первый оффер ПОСЛЕ upperOffer с тем же или большим income
            const upperIndex = validOffers.indexOf(upperOffer);
            let nextComp = null;
            
            // Ищем среди офферов с большей ценой (после upperOffer в отсортированном массиве)
            for (let i = upperIndex + 1; i < validOffers.length; i++) {
                const o = validOffers[i];
                if (o.income >= upperOffer.income && o.price > upperOffer.price) {
                    nextComp = o;
                    break;
                }
            }
            
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
                console.log(`   📈 NextCompetitor: ${nextComp.income}M/s @ $${nextComp.price} → $${nextCompetitorPrice}`);
            }
        }
        
        // v2.5.4: Если AI не нашёл nextCompetitor, используем данные из searchResult (regex)
        // Это важно потому что regex уже находит nextCompetitor из следующего диапазона
        if (!nextCompetitorPrice && searchResult.nextCompetitor) {
            nextCompetitorPrice = searchResult.nextCompetitorPrice;
            nextCompetitorData = searchResult.nextCompetitorData || {
                income: searchResult.nextCompetitor.income,
                price: searchResult.nextCompetitor.price,
                source: 'regex'
            };
            console.log(`   📈 Using regex nextCompetitor: ${searchResult.nextCompetitor.income}M/s @ $${searchResult.nextCompetitor.price}`);
        }
        
        // То же для median - если AI не вычислил, берём из searchResult
        if (!medianPrice && searchResult.medianPrice) {
            medianPrice = searchResult.medianPrice;
            medianData = searchResult.medianData;
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
            competitorPrice: upperOffer?.price || searchResult.competitorPrice || null,
            competitorIncome: upperOffer?.income || searchResult.competitorIncome || null,
            lowerPrice: lowerOffer?.price || searchResult.lowerPrice || null,
            lowerIncome: lowerOffer?.income || searchResult.lowerIncome || null,
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
        
        // Кэшируем AI результат в MongoDB
        await setAICache(cacheKey, result);
        
        console.log(`✅ AI price for ${brainrotName}: $${suggestedPrice} (cached in MongoDB)`);
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
 * Использует глобальный rate limiter через MongoDB
 */
async function processAIQueue() {
    if (isProcessingQueue || aiValidationQueue.length === 0) return;
    
    isProcessingQueue = true;
    console.log(`🤖 Starting AI queue processing: ${aiValidationQueue.length} items`);
    
    while (aiValidationQueue.length > 0) {
        // Проверяем ГЛОБАЛЬНЫЙ rate limit (MongoDB)
        const estimatedTokens = 1500;
        const rateCheck = await checkGlobalRateLimit(estimatedTokens);
        
        if (!rateCheck.allowed) {
            const waitTime = rateCheck.waitMs || 30000;
            console.log(`⏳ Global rate limit (${rateCheck.currentTokens} tokens, ${rateCheck.currentRequests} reqs), waiting ${Math.round(waitTime/1000)}s...`);
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
async function getStats() {
    // Получаем глобальную статистику из MongoDB
    const globalStats = await getAIUsageStats();
    
    // Получаем размер кэша из MongoDB (примерно)
    let cacheSize = 0;
    try {
        const { connectToDatabase } = require('./_lib/db');
        const { db } = await connectToDatabase();
        cacheSize = await db.collection('ai_price_cache').countDocuments();
    } catch (e) {
        console.error('Error getting cache size:', e.message);
    }
    
    return {
        cacheSize,  // Теперь из MongoDB
        cacheType: 'mongodb',
        queueLength: aiValidationQueue.length,
        isProcessing: isProcessingQueue,
        globalRateLimit: globalStats,
        previousPricesTracked: previousPrices.size
    };
}

/**
 * Очищает кэши
 */
async function clearCache() {
    previousPrices.clear();
    
    // Очищаем MongoDB кэш
    try {
        const { connectToDatabase } = require('./_lib/db');
        const { db } = await connectToDatabase();
        const result = await db.collection('ai_price_cache').deleteMany({});
        console.log(`🗑️ AI cache cleared: ${result.deletedCount} entries from MongoDB`);
    } catch (e) {
        console.error('Error clearing cache:', e.message);
    }
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
        const stats = await getStats();
        return res.status(200).json(stats);
    }
    
    // Очистка кэша
    if (clear !== undefined) {
        await clearCache();
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
