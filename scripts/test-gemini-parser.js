/**
 * Тестовый парсер title офферов с помощью Gemini 2.0 Flash Lite
 * Использует AI для семантического анализа вместо regex паттернов
 * 
 * ОПТИМИЗАЦИЯ: Все офферы обрабатываются ОДНИМ запросом к API
 * чтобы не упираться в квоту (free tier: 30 req/min, 1500 req/day)
 */

const https = require('https');

// Gemini API конфигурация
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Доступные модели: gemma-3-27b-it, gemini-2.0-flash-exp, gemini-2.5-flash
const GEMINI_MODEL = 'gemma-3-27b-it';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Максимум офферов в одном запросе (чтобы не превысить лимит токенов)
const MAX_OFFERS_PER_REQUEST = 50;

/**
 * Задержка
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Вызов Gemini API с retry логикой
 */
async function callGeminiAPI(prompt, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = await callGeminiAPIOnce(prompt);
            return result;
        } catch (e) {
            const isRateLimit = e.message.includes('quota') || e.message.includes('rate');
            
            if (isRateLimit && attempt < retries) {
                // Парсим время ожидания из сообщения или используем экспоненциальный backoff
                const waitMatch = e.message.match(/retry in ([\d.]+)s/i);
                const waitTime = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) : (attempt * 10000);
                
                console.log(`⏳ Rate limited, waiting ${waitTime/1000}s before retry ${attempt + 1}/${retries}...`);
                await sleep(waitTime);
                continue;
            }
            
            throw e;
        }
    }
}

function callGeminiAPIOnce(prompt) {
    return new Promise((resolve, reject) => {
        const requestBody = JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.1,  // Низкая температура для консистентных ответов
                maxOutputTokens: 1024,
                topP: 0.8
            }
        });

        const url = new URL(GEMINI_API_URL);
        
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        reject(new Error(parsed.error.message));
                        return;
                    }
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    resolve(text);
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}, data: ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        
        req.write(requestBody);
        req.end();
    });
}

/**
 * Парсит income из title оффера с помощью Gemini
 * @param {string} title - заголовок оффера
 * @param {string} msRange - M/s диапазон из атрибутов (например "250-499 M/s")
 * @returns {Object} - { income: number|null, isReliable: boolean, reason: string }
 */
async function parseIncomeWithGemini(title, msRange = null) {
    const prompt = `You are analyzing a Roblox "Steal a Brainrot" game item listing title to extract the income value (M/s = Millions per second).

TITLE: "${title}"
EXPECTED M/s RANGE: ${msRange || 'unknown'}

RULES:
1. Extract the EXACT income value in M/s (Millions per second)
2. If the title shows a RANGE like "150m - 500m/s" - this is unreliable (random/spin wheel offer), return null
3. If the title contains "Spin the Wheel", "Random", "Mystery", "Lucky" - this is unreliable, return null
4. B/s means Billions, convert to M/s by multiplying by 1000 (e.g., 1.5B/s = 1500 M/s)
5. The income should be within or near the expected M/s range if provided
6. If no clear income value is found, return null

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, just JSON):
{
  "income": <number or null>,
  "isReliable": <true or false>,
  "reason": "<brief explanation>"
}

Examples:
- "Los 67 135M/s Fast Delivery" → {"income": 135, "isReliable": true, "reason": "Clear 135M/s value"}
- "150m - 500m/s Brainrot Spin the Wheel!" → {"income": null, "isReliable": false, "reason": "Range offer, unreliable income"}
- "Garama GOLD 262.5M/s ⭐" → {"income": 262.5, "isReliable": true, "reason": "Clear 262.5M/s value"}
- "Best Brainrot Fast Delivery" → {"income": null, "isReliable": false, "reason": "No income value found"}`;

    try {
        const response = await callGeminiAPI(prompt);
        
        // Парсим JSON из ответа
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('No JSON in response:', response);
            return { income: null, isReliable: false, reason: 'Failed to parse AI response' };
        }
        
        const result = JSON.parse(jsonMatch[0]);
        return {
            income: result.income,
            isReliable: result.isReliable,
            reason: result.reason
        };
    } catch (e) {
        console.error('Gemini API error:', e.message);
        return { income: null, isReliable: false, reason: `API error: ${e.message}` };
    }
}

/**
 * Batch парсинг нескольких title за один запрос (экономит токены)
 * Это ОСНОВНОЙ метод - все офферы обрабатываются ОДНИМ запросом!
 * @param {Array} offers - массив { title, msRange, price }
 * @returns {Array} - массив результатов с income и флагами
 */
async function parseOffersBatch(offers) {
    if (!offers || offers.length === 0) return [];
    
    // Если офферов слишком много - разбиваем на чанки
    if (offers.length > MAX_OFFERS_PER_REQUEST) {
        console.log(`⚠️ Too many offers (${offers.length}), splitting into chunks of ${MAX_OFFERS_PER_REQUEST}`);
        const results = [];
        for (let i = 0; i < offers.length; i += MAX_OFFERS_PER_REQUEST) {
            const chunk = offers.slice(i, i + MAX_OFFERS_PER_REQUEST);
            const chunkResults = await parseOffersBatch(chunk);
            results.push(...chunkResults);
            
            // Пауза между чанками чтобы не превысить rate limit
            if (i + MAX_OFFERS_PER_REQUEST < offers.length) {
                console.log('⏳ Waiting 2s before next chunk...');
                await sleep(2000);
            }
        }
        return results;
    }
    
    // Форматируем офферы для промпта
    const titlesFormatted = offers.map((o, i) => {
        const parts = [`${i + 1}. "${o.title}"`];
        if (o.msRange) parts.push(`range: ${o.msRange}`);
        if (o.price) parts.push(`price: $${o.price}`);
        return parts.join(' | ');
    }).join('\n');
    
    const prompt = `Analyze these Roblox "Steal a Brainrot" marketplace listings. Extract income (M/s) and identify bad offers.

LISTINGS:
${titlesFormatted}

RULES:
1. Extract EXACT income in M/s (Millions/second)
2. SKIP these (income=null, skip=true):
   - Range offers: "150m - 500m/s" (variable income)
   - Random/gambling: "Spin the Wheel", "Random", "Mystery", "Lucky"
   - No income mentioned at all
   - Clearly fake/misleading values
3. B/s = Billions, convert: 1.5B/s = 1500 M/s
4. Income should reasonably match the M/s range attribute if provided

RESPOND ONLY WITH JSON ARRAY (no markdown):
[{"i":1,"m":135,"s":false},{"i":2,"m":null,"s":true,"r":"range offer"}]

Fields: i=index, m=income(M/s or null), s=skip(true if bad offer), r=reason(only if skip=true)`;

    try {
        const response = await callGeminiAPI(prompt);
        
        // Парсим JSON массив
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.error('❌ No JSON in response:', response.substring(0, 200));
            return offers.map(() => ({ income: null, skip: true, reason: 'AI parse failed' }));
        }
        
        const results = JSON.parse(jsonMatch[0]);
        
        // Маппим результаты обратно к офферам
        return offers.map((offer, idx) => {
            const result = results.find(r => r.i === idx + 1);
            if (!result) {
                return { income: null, skip: true, reason: 'Missing in response' };
            }
            return {
                income: result.m,
                skip: result.s || false,
                reason: result.r || null
            };
        });
    } catch (e) {
        console.error('❌ Gemini API error:', e.message);
        return offers.map(() => ({ income: null, skip: true, reason: `API error: ${e.message}` }));
    }
}

/**
 * Фильтрация и анализ офферов для ценообразования
 * Один запрос → получаем все income + отсеиваем плохие офферы
 * @param {Array} offers - сырые офферы с Eldorado API
 * @param {number} targetIncome - наш income для сравнения
 * @returns {Object} - { validOffers, skippedOffers, upperOffer, lowerOffer }
 */
async function analyzeOffersForPricing(offers, targetIncome) {
    console.log(`\n📊 Analyzing ${offers.length} offers with Gemini AI...`);
    
    // Готовим данные для batch-запроса
    const offerData = offers.map(o => ({
        title: o.title || '',
        msRange: o.msRange || null,
        price: o.price || o.unitPrice || null
    }));
    
    // ОДИН запрос на все офферы
    const results = await parseOffersBatch(offerData);
    
    // Разделяем на валидные и пропущенные
    const validOffers = [];
    const skippedOffers = [];
    
    offers.forEach((offer, idx) => {
        const result = results[idx];
        const enrichedOffer = {
            ...offer,
            parsedIncome: result.income,
            skipReason: result.reason
        };
        
        if (result.skip || result.income === null) {
            skippedOffers.push(enrichedOffer);
        } else {
            validOffers.push(enrichedOffer);
        }
    });
    
    console.log(`✅ Valid offers: ${validOffers.length}`);
    console.log(`⏭️ Skipped offers: ${skippedOffers.length}`);
    
    // Находим upper и lower для нашего income
    let upperOffer = null;
    let lowerOffer = null;
    
    for (const offer of validOffers) {
        const offerIncome = offer.parsedIncome;
        const offerPrice = offer.price || offer.unitPrice;
        
        // Upper: income >= target, минимальная цена
        if (offerIncome >= targetIncome) {
            if (!upperOffer || offerPrice < upperOffer.price) {
                upperOffer = { ...offer, price: offerPrice };
            }
        }
        
        // Lower: income < target, максимальная цена
        if (offerIncome < targetIncome) {
            if (!lowerOffer || offerPrice > lowerOffer.price) {
                lowerOffer = { ...offer, price: offerPrice };
            }
        }
    }
    
    return {
        validOffers,
        skippedOffers,
        upperOffer,
        lowerOffer
    };
}

/**
 * Batch парсинг нескольких title за один запрос (экономит токены)
 * @param {Array} offers - массив { title, msRange }
 * @returns {Array} - массив результатов
 */
async function parseIncomeBatch(offers) {
    const titlesFormatted = offers.map((o, i) => `${i + 1}. "${o.title}" (range: ${o.msRange || 'unknown'})`).join('\n');
    
    const prompt = `You are analyzing Roblox "Steal a Brainrot" game item listing titles to extract income values (M/s = Millions per second).

TITLES TO ANALYZE:
${titlesFormatted}

RULES:
1. Extract the EXACT income value in M/s for each title
2. If title shows a RANGE like "150m - 500m/s" - unreliable (random/spin wheel), income = null
3. If title contains "Spin the Wheel", "Random", "Mystery", "Lucky" - unreliable, income = null  
4. B/s means Billions, convert to M/s by × 1000 (1.5B/s = 1500 M/s)
5. Income should be within or near the expected range if provided
6. No clear income = null

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, just JSON array):
[
  {"index": 1, "income": <number or null>, "isReliable": <boolean>, "reason": "<brief>"},
  {"index": 2, "income": <number or null>, "isReliable": <boolean>, "reason": "<brief>"},
  ...
]`;

    try {
        const response = await callGeminiAPI(prompt);
        
        // Парсим JSON массив из ответа
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.error('No JSON array in response:', response);
            return offers.map(() => ({ income: null, isReliable: false, reason: 'Failed to parse AI response' }));
        }
        
        const results = JSON.parse(jsonMatch[0]);
        
        // Сопоставляем результаты с офферами по индексу
        return offers.map((_, i) => {
            const result = results.find(r => r.index === i + 1);
            return result || { income: null, isReliable: false, reason: 'Missing in response' };
        });
    } catch (e) {
        console.error('Gemini API batch error:', e.message);
        return offers.map(() => ({ income: null, isReliable: false, reason: `API error: ${e.message}` }));
    }
}

/**
 * Текущий regex парсер (для сравнения)
 */
function parseIncomeRegex(title, msRangeAttr = null) {
    if (!title) return null;
    
    // Проверка на диапазоны
    const rangePattern = /(\d+)\s*[mM]\s*[-~]\s*(\d+)\s*[mM]\/[sS]/i;
    if (rangePattern.test(title)) return null;
    
    // Проверка на рандомные офферы
    if (/spin\s*(the)?\s*wheel|random|mystery|lucky/i.test(title)) return null;
    
    // M/s паттерны
    const mPatterns = [
        /(\d+[.,]?\d*)\s*M\/s/i,
        /(\d+[.,]?\d*)\s*m\/sec/i,
        /(\d+[.,]?\d*)\s*mil\/s/i,
    ];

    for (const pattern of mPatterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            if (value >= 1 && value <= 9999) return value;
        }
    }
    
    // B/s паттерны
    const bPatterns = [
        /(\d+[.,]?\d*)\s*B\/S/i,
        /(\d+[.,]?\d*)B\/s/i,
    ];
    
    for (const pattern of bPatterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            const msValue = value * 1000;
            if (msValue >= 1000 && msValue <= 99999) return msValue;
        }
    }
    
    return null;
}

// =============================================
// ТЕСТИРОВАНИЕ
// =============================================

const testCases = [
    // Нормальные офферы
    { title: "🔥Los 67 l 135M/s🔥 Fast Delivery🚚 👾Glitched Store👾", msRange: "100-249 M/s", expected: 135 },
    { title: "Garama and Madundung Gold 262.5M/s ⭐ Instant Delivery", msRange: "250-499 M/s", expected: 262.5 },
    { title: "💥Garamma and Madudung💥 $250M/S 🚚 Fast Delivery🚚", msRange: "250-499 M/s", expected: 250 },
    { title: "Los Planitos 249.7 M/s", msRange: "100-249 M/s", expected: 249.7 },
    { title: "4⭐️ Brainrot-Secret-Los Planitos 111M/s 1 TRAIT⭐️", msRange: "100-249 M/s", expected: 111 },
    
    // Проблемные офферы (должны вернуть null)
    { title: "150m - 500m/s Brainrot Spin the Wheel! !READ THE DESCRIPTION", msRange: "250-499 M/s", expected: null },
    { title: "Random Brainrot Lucky Box! Best Deal!", msRange: "100-249 M/s", expected: null },
    { title: "Garama and Madundung GOLD", msRange: "250-499 M/s", expected: null }, // Нет income
    { title: "Garama en venta 🔥", msRange: "250-499 M/s", expected: null }, // Нет income
    { title: "Mystery Brainrot - Spin & Win!", msRange: "100-249 M/s", expected: null },
    
    // Сложные случаи
    { title: "🎗️ GARAMA AND MADUNDUNG ~ NORMAL ~ 250M/s 🚚", msRange: "250-499 M/s", expected: 250 },
    { title: "Gold Garama And Madundung 262.5M/s INSTADELIVERY 🟢", msRange: "250-499 M/s", expected: 262.5 },
    { title: "Garama and Madundung Gold ⭐ 262.5M/s ⭐ Instant Delivery", msRange: "250-499 M/s", expected: 262.5 },
    { title: "2⭐️ Brainrot-Secret-Los Planitos 203.5M/s 3 TRAITS⭐️", msRange: "100-249 M/s", expected: 203.5 },
    
    // B/s примеры
    { title: "Super Brainrot 1.5B/s MEGA DEAL!", msRange: "1+ B/s", expected: 1500 },
    { title: "Epic Brainrot 2.7B GET 111M/S fast", msRange: "100-249 M/s", expected: 111 }, // Хитрый - B манипуляция
];

async function runTests() {
    console.log('='.repeat(80));
    console.log('GEMINI vs REGEX PARSER COMPARISON TEST');
    console.log('='.repeat(80));
    console.log('');
    
    let geminiCorrect = 0;
    let regexCorrect = 0;
    
    // Тестируем batch запрос
    console.log('Testing batch API call...\n');
    
    const batchResults = await parseIncomeBatch(testCases);
    
    for (let i = 0; i < testCases.length; i++) {
        const test = testCases[i];
        const geminiResult = batchResults[i];
        const regexResult = parseIncomeRegex(test.title, test.msRange);
        
        const geminiMatch = geminiResult.income === test.expected;
        const regexMatch = regexResult === test.expected;
        
        if (geminiMatch) geminiCorrect++;
        if (regexMatch) regexCorrect++;
        
        console.log(`${i + 1}. "${test.title.substring(0, 50)}..."`);
        console.log(`   Expected: ${test.expected === null ? 'null' : test.expected + ' M/s'}`);
        console.log(`   Regex:    ${regexResult === null ? 'null' : regexResult + ' M/s'} ${regexMatch ? '✅' : '❌'}`);
        console.log(`   Gemini:   ${geminiResult.income === null ? 'null' : geminiResult.income + ' M/s'} ${geminiMatch ? '✅' : '❌'}`);
        console.log(`   Reason:   ${geminiResult.reason}`);
        console.log('');
    }
    
    console.log('='.repeat(80));
    console.log('RESULTS:');
    console.log(`   Regex:  ${regexCorrect}/${testCases.length} correct (${Math.round(regexCorrect/testCases.length*100)}%)`);
    console.log(`   Gemini: ${geminiCorrect}/${testCases.length} correct (${Math.round(geminiCorrect/testCases.length*100)}%)`);
    console.log('='.repeat(80));
}

async function testSingleTitle(title, msRange) {
    console.log('\n--- Single Title Test ---');
    console.log(`Title: "${title}"`);
    console.log(`Range: ${msRange}`);
    
    const regexResult = parseIncomeRegex(title, msRange);
    console.log(`\nRegex result: ${regexResult === null ? 'null' : regexResult + ' M/s'}`);
    
    console.log('\nCalling Gemini API...');
    const geminiResult = await parseIncomeWithGemini(title, msRange);
    console.log(`Gemini result: ${geminiResult.income === null ? 'null' : geminiResult.income + ' M/s'}`);
    console.log(`Reliable: ${geminiResult.isReliable}`);
    console.log(`Reason: ${geminiResult.reason}`);
}

// Запуск тестов
async function main() {
    const args = process.argv.slice(2);
    
    if (args[0] === '--single' && args[1]) {
        // Тест одного title
        await testSingleTitle(args[1], args[2] || '250-499 M/s');
    } else if (args[0] === '--real') {
        // Реальный тест с Eldorado API
        await testRealEldoradoOffers(args[1] || 'Garama and Madundung');
    } else {
        // Полный тест
        await runTests();
    }
}

// Eldorado API конфигурация
const ELDORADO_GAME_ID = '259';

/**
 * Загружает офферы с Eldorado API
 */
function fetchEldoradoOffers(brainrotName, msRangeAttrId = null, pageIndex = 1) {
    return new Promise((resolve) => {
        const params = new URLSearchParams({
            gameId: ELDORADO_GAME_ID,
            category: 'CustomItem',
            tradeEnvironmentValue0: 'Brainrot',
            pageSize: '50',
            pageIndex: String(pageIndex),
            offerSortingCriterion: 'Price',
            isAscending: 'true'
        });
        
        if (msRangeAttrId) {
            params.set('offerAttributeIdsCsv', msRangeAttrId);
        }
        
        if (brainrotName) {
            params.set('tradeEnvironmentValue2', brainrotName);
        }

        const options = {
            hostname: 'www.eldorado.gg',
            path: '/api/flexibleOffers?' + params.toString(),
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'swagger': 'Swager request'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({
                        results: parsed.results || parsed.flexibleOffers || [],
                        totalCount: parsed.recordCount || parsed.totalCount || 0
                    });
                } catch (e) {
                    resolve({ error: e.message, results: [] });
                }
            });
        });

        req.on('error', (e) => resolve({ error: e.message, results: [] }));
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({ error: 'timeout', results: [] });
        });
        req.end();
    });
}

/**
 * Получает M/s диапазон из атрибутов оффера
 */
function getMsRangeFromOffer(offerData) {
    const attrs = offerData.offer?.offerAttributeIdValues || [];
    const msAttr = attrs.find(a => a.name === 'M/s');
    return msAttr?.value || null;
}

/**
 * Реальный тест - загружаем офферы с Eldorado и анализируем через Gemini
 */
async function testRealEldoradoOffers(brainrotName) {
    console.log('='.repeat(80));
    console.log(`REAL ELDORADO TEST: ${brainrotName}`);
    console.log('='.repeat(80));
    
    console.log(`\n🔍 Fetching offers from Eldorado for "${brainrotName}"...`);
    
    // Загружаем реальные офферы с Eldorado API
    const response = await fetchEldoradoOffers(brainrotName);
    
    if (response.error) {
        console.error(`❌ Eldorado API error: ${response.error}`);
        return;
    }
    
    if (!response.results || response.results.length === 0) {
        console.log(`❌ No offers found for "${brainrotName}"`);
        return;
    }
    
    // Преобразуем офферы в нужный формат (данные в result.offer)
    const offers = response.results.slice(0, 30).map(r => ({
        title: r.offer?.offerTitle || '',
        price: r.offer?.pricePerUnitInUSD?.amount || 0,
        msRange: getMsRangeFromOffer(r),
        sellerId: r.user?.id,
        sellerName: r.user?.username
    }));
    
    console.log(`✅ Found ${response.totalCount} total offers, analyzing first ${offers.length}...`);
    
    // Примерный income для этого брейнрота (берём из первого оффера с income в title)
    let targetIncome = 100; // default
    for (const o of offers) {
        const match = o.title.match(/(\d+[.,]?\d*)\s*[MB]\/s/i);
        if (match) {
            targetIncome = parseFloat(match[1].replace(',', '.'));
            break;
        }
    }
    
    console.log(`\nTarget income: ~${targetIncome} M/s`);
    console.log(`Testing with ${offers.length} offers...\n`);
    
    // ОДИН запрос на ВСЕ офферы
    const result = await analyzeOffersForPricing(offers, targetIncome);
    
    console.log(`\n✅ Valid offers: ${result.validOffers.length}`);
    console.log(`⏭️ Skipped offers: ${result.skippedOffers.length}`);
    
    console.log('\n--- VALID OFFERS ---');
    result.validOffers.forEach(o => {
        console.log(`  ${o.parsedIncome}M/s @ $${o.price.toFixed(2)} - "${o.title.substring(0, 45)}..."`);
    });
    
    console.log('\n--- SKIPPED OFFERS ---');
    result.skippedOffers.forEach(o => {
        console.log(`  ⏭️ "${o.title.substring(0, 45)}..." - ${o.skipReason || 'no income'}`);
    });
    
    console.log('\n--- PRICING RESULT ---');
    if (result.upperOffer) {
        console.log(`  Upper: ${result.upperOffer.parsedIncome}M/s @ $${result.upperOffer.price.toFixed(2)}`);
    } else {
        console.log('  Upper: Not found');
    }
    if (result.lowerOffer) {
        console.log(`  Lower: ${result.lowerOffer.parsedIncome}M/s @ $${result.lowerOffer.price.toFixed(2)}`);
    } else {
        console.log('  Lower: Not found');
    }
    
    // Расчёт suggested price
    if (result.upperOffer) {
        const upperPrice = result.upperOffer.price;
        const lowerPrice = result.lowerOffer?.price || 0;
        const diff = upperPrice - lowerPrice;
        
        let suggestedPrice;
        if (diff >= 1) {
            suggestedPrice = upperPrice - 1;
        } else {
            suggestedPrice = upperPrice - 0.5;
        }
        
        console.log(`\n  💰 SUGGESTED PRICE: $${suggestedPrice.toFixed(2)}`);
    }
    
    console.log('\n' + '='.repeat(80));
    
    return result;
}

main().catch(console.error);
