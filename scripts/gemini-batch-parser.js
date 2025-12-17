/**
 * Gemini Batch Parser - анализ офферов ВСЕХ брейнротов одним запросом
 * 
 * Оптимизация: 
 * 1. Загружаем офферы для всех брейнротов параллельно с Eldorado
 * 2. Отправляем ВСЕ офферы ОДНИМ запросом в Gemini
 * 3. Получаем структурированный ответ с группировкой
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemma-3-27b-it';  // Gemma 3 27B - отдельные лимиты от Gemini
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Eldorado API
const ELDORADO_GAME_ID = '259';
const OFFERS_PER_BRAINROT = 15; // Берём топ-15 офферов по цене для каждого брейнрота

// Token limits for gemma-3-27b (free tier)
const MAX_TOKENS_PER_MINUTE = 15000;  // TPM limit
const RPM_LIMIT = 30;                  // 30 requests per minute

// Batch strategy: 5 brainrots per batch, 10 parallel batches
const BRAINROTS_PER_BATCH = 5;         // Max 5 brainrots per batch (small batches = fast response)
const PARALLEL_BATCHES = 10;           // 10 parallel batches
const MIN_CYCLE_TIME_MS = 60000;       // 1 minute minimum cycle time
const CYCLE_BUFFER_MS = 20000;         // +20 seconds buffer after cycle

// Загружаем список брейнротов
let BRAINROTS = [];
try {
    const dataPath = path.join(__dirname, '../data/eldorado-brainrot-ids.json');
    BRAINROTS = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`📦 Loaded ${BRAINROTS.length} brainrots from database`);
} catch (e) {
    console.error('Failed to load brainrots:', e.message);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Разбивает данные на батчи по количеству брейнротов
 */
function splitIntoBatches(dataWithOffers, brainrotsPerBatch) {
    const batches = [];
    
    for (let i = 0; i < dataWithOffers.length; i += brainrotsPerBatch) {
        batches.push(dataWithOffers.slice(i, i + brainrotsPerBatch));
    }
    
    return batches;
}

/**
 * Загружает офферы с Eldorado для одного брейнрота
 */
function fetchEldoradoOffers(brainrotName) {
    return new Promise((resolve) => {
        const params = new URLSearchParams({
            gameId: ELDORADO_GAME_ID,
            category: 'CustomItem',
            tradeEnvironmentValue0: 'Brainrot',
            tradeEnvironmentValue2: brainrotName,
            pageSize: String(OFFERS_PER_BRAINROT),
            pageIndex: '1',
            offerSortingCriterion: 'Price',
            isAscending: 'true'
        });

        const options = {
            hostname: 'www.eldorado.gg',
            path: '/api/flexibleOffers?' + params.toString(),
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'swagger': 'Swager request'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const results = parsed.results || [];
                    
                    // Преобразуем в нужный формат
                    const offers = results.map(r => ({
                        title: r.offer?.offerTitle || '',
                        price: r.offer?.pricePerUnitInUSD?.amount || 0,
                        seller: r.user?.username || 'unknown'
                    })).filter(o => o.title && o.price > 0);
                    
                    resolve({ brainrot: brainrotName, offers, total: parsed.recordCount || 0 });
                } catch (e) {
                    resolve({ brainrot: brainrotName, offers: [], error: e.message });
                }
            });
        });

        req.on('error', (e) => resolve({ brainrot: brainrotName, offers: [], error: e.message }));
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({ brainrot: brainrotName, offers: [], error: 'timeout' });
        });
        req.end();
    });
}

/**
 * Загружает офферы для ВСЕХ брейнротов параллельно (с лимитом concurrency)
 */
async function fetchAllBrainrotsOffers(brainrotNames, concurrency = 10) {
    console.log(`\n🔍 Fetching offers for ${brainrotNames.length} brainrots (concurrency: ${concurrency})...`);
    
    const results = [];
    
    for (let i = 0; i < brainrotNames.length; i += concurrency) {
        const batch = brainrotNames.slice(i, i + concurrency);
        const batchPromises = batch.map(name => fetchEldoradoOffers(name));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Прогресс
        const done = Math.min(i + concurrency, brainrotNames.length);
        process.stdout.write(`\r   Progress: ${done}/${brainrotNames.length} brainrots`);
        
        // Небольшая пауза между батчами
        if (i + concurrency < brainrotNames.length) {
            await sleep(200);
        }
    }
    
    console.log('\n');
    return results;
}

/**
 * Вызов Gemini API с retry
 */
async function callGeminiAPI(prompt, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = await callGeminiAPIOnce(prompt);
            return result;
        } catch (e) {
            const isRateLimit = e.message.includes('quota') || e.message.includes('rate');
            
            if (isRateLimit && attempt < retries) {
                const waitMatch = e.message.match(/retry in ([\d.]+)s/i);
                const waitTime = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) : (attempt * 30000);
                console.log(`⏳ Rate limited, waiting ${Math.round(waitTime/1000)}s before retry ${attempt + 1}/${retries}...`);
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
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,  // Больше токенов для большого ответа
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
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(180000, () => {  // 180 секунд timeout для медленной модели
            req.destroy();
            reject(new Error('Timeout'));
        });
        
        req.write(requestBody);
        req.end();
    });
}

/**
 * Формирует один большой промпт для ВСЕХ брейнротов
 */
function buildBatchPrompt(allData) {
    // Формируем компактный список офферов с группировкой по брейнроту
    let offersList = '';
    let offerIndex = 0;
    
    for (const data of allData) {
        if (data.offers.length === 0) continue;
        
        offersList += `\n[${data.brainrot}]\n`;
        for (const offer of data.offers) {
            offerIndex++;
            // Компактный формат: индекс|цена|title
            offersList += `${offerIndex}|$${offer.price.toFixed(2)}|${offer.title.substring(0, 80)}\n`;
        }
    }
    
    return `Analyze Roblox "Steal a Brainrot" marketplace offers. Extract income (M/s) and filter bad offers.

DATA FORMAT: Each brainrot section starts with [BrainrotName], then offers: index|price|title

${offersList}

RULES:
1. Extract income in M/s from each title (e.g., "135M/s" → 135, "1.5B/s" → 1500)
2. SKIP (mark as null):
   - Range offers: "150m-500m/s" (variable income)
   - Random/gambling: "Spin", "Random", "Mystery", "Lucky"
   - No income value found
3. B/s = Billions, multiply by 1000

RESPOND WITH JSON ONLY (no markdown):
{
  "brainrots": {
    "BrainrotName1": [
      {"i": 1, "m": 135, "p": 2.50},
      {"i": 2, "m": null, "r": "range"},
      ...
    ],
    "BrainrotName2": [...],
    ...
  }
}

Fields: i=original index, m=income M/s (null if skip), p=price, r=skip reason (only if m=null)`;
}

/**
 * Парсит ответ Gemini и возвращает структурированные данные
 */
function parseGeminiResponse(response, allData) {
    try {
        // Ищем JSON в ответе
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('❌ No JSON in response');
            return null;
        }
        
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.brainrots || parsed;
    } catch (e) {
        console.error('❌ Failed to parse response:', e.message);
        return null;
    }
}

/**
 * Анализирует все офферы и формирует результаты для каждого брейнрота
 */
function analyzeResults(allData, geminiResults) {
    const results = [];
    
    // Создаём маппинг индекс -> оффер
    const indexToOffer = new Map();
    let idx = 0;
    for (const data of allData) {
        for (const offer of data.offers) {
            idx++;
            indexToOffer.set(idx, { ...offer, brainrot: data.brainrot });
        }
    }
    
    // Обрабатываем каждый брейнрот
    for (const data of allData) {
        const brainrotName = data.brainrot;
        const geminiData = geminiResults?.[brainrotName] || [];
        
        const validOffers = [];
        const skippedOffers = [];
        
        // Если нет данных от Gemini, используем все офферы как skipped
        if (geminiData.length === 0) {
            data.offers.forEach(o => skippedOffers.push({ ...o, reason: 'no AI data' }));
        } else {
            // Маппим результаты
            for (const result of geminiData) {
                const offer = indexToOffer.get(result.i);
                if (!offer || offer.brainrot !== brainrotName) continue;
                
                if (result.m !== null && result.m !== undefined) {
                    validOffers.push({
                        title: offer.title,
                        price: result.p || offer.price,
                        income: result.m,
                        seller: offer.seller
                    });
                } else {
                    skippedOffers.push({
                        title: offer.title,
                        price: offer.price,
                        reason: result.r || 'filtered'
                    });
                }
            }
        }
        
        // Сортируем valid по income (desc) для поиска upper/lower
        validOffers.sort((a, b) => b.income - a.income);
        
        results.push({
            brainrot: brainrotName,
            totalOffers: data.total,
            validOffers,
            skippedOffers,
            upperOffer: validOffers[0] || null,
            lowerOffer: validOffers.length > 1 ? validOffers[validOffers.length - 1] : null
        });
    }
    
    return results;
}

/**
 * Главная функция - анализ всех брейнротов
 */
async function analyzeAllBrainrots(brainrotNames) {
    console.log('='.repeat(80));
    console.log('GEMINI BATCH PARSER - ALL BRAINROTS IN ONE REQUEST');
    console.log('='.repeat(80));
    
    // 1. Загружаем офферы для всех брейнротов
    const startFetch = Date.now();
    const allData = await fetchAllBrainrotsOffers(brainrotNames);
    const fetchTime = ((Date.now() - startFetch) / 1000).toFixed(1);
    
    // Статистика загрузки
    const totalOffers = allData.reduce((sum, d) => sum + d.offers.length, 0);
    const brainrotsWithOffers = allData.filter(d => d.offers.length > 0).length;
    
    console.log(`📊 Eldorado fetch complete in ${fetchTime}s:`);
    console.log(`   - Brainrots with offers: ${brainrotsWithOffers}/${brainrotNames.length}`);
    console.log(`   - Total offers loaded: ${totalOffers}`);
    
    if (totalOffers === 0) {
        console.log('❌ No offers found!');
        return;
    }
    
    // 2. Формируем промпт и отправляем в Gemini
    // Разбиваем на батчи по 5 брейнротов
    const dataWithOffers = allData.filter(d => d.offers.length > 0);
    
    let geminiResults = {};
    const batches = splitIntoBatches(dataWithOffers, BRAINROTS_PER_BATCH);
    
    console.log(`\n🤖 Processing ${totalOffers} offers in ${batches.length} batch(es)...`);
    console.log(`   📊 Strategy: ${PARALLEL_BATCHES} parallel batches, ${BRAINROTS_PER_BATCH} brainrots per batch`);
    console.log(`   📊 Min cycle time: ${MIN_CYCLE_TIME_MS/1000}s + ${CYCLE_BUFFER_MS/1000}s buffer`);
    console.log(`   📊 Limits: ${RPM_LIMIT} RPM, ${MAX_TOKENS_PER_MINUTE} TPM`);
    
    const startAI = Date.now();
    
    // Группируем батчи для параллельной отправки (по 10 параллельно)
    for (let groupStart = 0; groupStart < batches.length; groupStart += PARALLEL_BATCHES) {
        const groupEnd = Math.min(groupStart + PARALLEL_BATCHES, batches.length);
        const parallelBatches = batches.slice(groupStart, groupEnd);
        const cycleStart = Date.now();
        
        console.log(`\n   🚀 Group ${Math.floor(groupStart / PARALLEL_BATCHES) + 1}: Sending ${parallelBatches.length} batch(es) in parallel...`);
        
        // Запускаем батчи параллельно
        const batchPromises = parallelBatches.map(async (batch, localIdx) => {
            const batchIdx = groupStart + localIdx;
            const batchOffers = batch.reduce((sum, d) => sum + d.offers.length, 0);
            const prompt = buildBatchPrompt(batch);
            
            console.log(`   📦 Batch ${batchIdx + 1}/${batches.length}: ${batch.length} brainrots, ${batchOffers} offers (~${Math.round(prompt.length / 4)} tokens)`);
            
            try {
                const response = await callGeminiAPI(prompt);
                const batchResults = parseGeminiResponse(response, batch);
                
                if (batchResults) {
                    console.log(`   ✅ Batch ${batchIdx + 1} complete`);
                    return { success: true, results: batchResults };
                } else {
                    console.log(`   ⚠️  Batch ${batchIdx + 1} failed to parse`);
                    return { success: false, results: {} };
                }
            } catch (e) {
                console.error(`   ❌ Batch ${batchIdx + 1} error: ${e.message}`);
                return { success: false, results: {}, error: e.message };
            }
        });
        
        // Ждём завершения всех параллельных запросов
        const results = await Promise.all(batchPromises);
        
        // Мержим результаты
        for (const result of results) {
            if (result.success) {
                Object.assign(geminiResults, result.results);
            }
        }
        
        // Проверяем, нужно ли ждать до минуты + буфер (если есть ещё группы)
        if (groupStart + PARALLEL_BATCHES < batches.length) {
            const cycleTime = Date.now() - cycleStart;
            const minCycleTime = MIN_CYCLE_TIME_MS + CYCLE_BUFFER_MS; // 80 секунд
            
            if (cycleTime < minCycleTime) {
                const waitTime = minCycleTime - cycleTime;
                console.log(`\n   ⏳ Cycle completed in ${(cycleTime/1000).toFixed(1)}s, waiting ${(waitTime/1000).toFixed(1)}s to respect rate limits...`);
                await sleep(waitTime);
            } else {
                console.log(`\n   ✅ Cycle took ${(cycleTime/1000).toFixed(1)}s (no wait needed)`);
            }
        }
    }
    
    const aiTime = ((Date.now() - startAI) / 1000).toFixed(1);
    console.log(`\n✅ All batches complete in ${aiTime}s`);
    
    if (Object.keys(geminiResults).length === 0) {
        console.log('❌ No valid results from Gemini');
        return;
    }
    
    // 3. Анализируем результаты
    const results = analyzeResults(allData, geminiResults);
    
    // 4. Выводим результаты
    console.log('\n' + '='.repeat(80));
    console.log('RESULTS BY BRAINROT');
    console.log('='.repeat(80));
    
    let totalValid = 0;
    let totalSkipped = 0;
    
    for (const r of results) {
        if (r.validOffers.length === 0 && r.skippedOffers.length === 0) continue;
        
        totalValid += r.validOffers.length;
        totalSkipped += r.skippedOffers.length;
        
        console.log(`\n📦 ${r.brainrot} (${r.totalOffers} total)`);
        console.log(`   ✅ Valid: ${r.validOffers.length} | ⏭️ Skipped: ${r.skippedOffers.length}`);
        
        if (r.upperOffer) {
            console.log(`   📈 Upper: ${r.upperOffer.income}M/s @ $${r.upperOffer.price.toFixed(2)}`);
        }
        if (r.lowerOffer) {
            console.log(`   📉 Lower: ${r.lowerOffer.income}M/s @ $${r.lowerOffer.price.toFixed(2)}`);
        }
        
        // Показываем топ-3 валидных
        if (r.validOffers.length > 0) {
            console.log('   Top offers:');
            r.validOffers.slice(0, 3).forEach(o => {
                console.log(`     - ${o.income}M/s @ $${o.price.toFixed(2)} "${o.title.substring(0, 35)}..."`);
            });
        }
        
        // Показываем причины skip
        if (r.skippedOffers.length > 0) {
            const reasons = {};
            r.skippedOffers.forEach(o => {
                reasons[o.reason] = (reasons[o.reason] || 0) + 1;
            });
            console.log(`   Skip reasons: ${Object.entries(reasons).map(([k,v]) => `${k}(${v})`).join(', ')}`);
        }
    }
    
    // Итоговая статистика
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total brainrots analyzed: ${brainrotsWithOffers}`);
    console.log(`Total offers processed: ${totalOffers}`);
    console.log(`Valid offers: ${totalValid} (${(totalValid/totalOffers*100).toFixed(1)}%)`);
    console.log(`Skipped offers: ${totalSkipped} (${(totalSkipped/totalOffers*100).toFixed(1)}%)`);
    console.log(`Total time: ${((Date.now() - startFetch) / 1000).toFixed(1)}s`);
    const parallelGroups = Math.ceil(batches.length / PARALLEL_BATCHES);
    console.log(`API calls: ${batches.length} batch(es) in ${parallelGroups} parallel group(s)`);
    
    return results;
}

// CLI
async function main() {
    const args = process.argv.slice(2);
    
    if (args[0] === '--all') {
        // Все брейнроты из базы
        const names = BRAINROTS.map(b => b.name);
        await analyzeAllBrainrots(names);
    } else if (args[0] === '--top') {
        // Топ N брейнротов
        const count = parseInt(args[1]) || 20;
        const names = BRAINROTS.slice(0, count).map(b => b.name);
        await analyzeAllBrainrots(names);
    } else if (args[0] === '--list') {
        // Конкретный список брейнротов через запятую
        const names = args.slice(1).join(' ').split(',').map(s => s.trim());
        await analyzeAllBrainrots(names);
    } else {
        // По умолчанию - тестовые 10 брейнротов
        const testBrainrots = [
            'Los 67',
            'Esok Sekolah', 
            'Los Mobilis',
            'Mieteteira Bicicleteira',
            'La Ginger Sekolah',
            'Las Sis',
            'Los Planitos',
            'Garama and Madundung',
            'La Secret Combinasion',
            'Chimnino'
        ];
        await analyzeAllBrainrots(testBrainrots);
    }
}

main().catch(console.error);
