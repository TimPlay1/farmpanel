/**
 * AI Scanner API - Умный парсер офферов с нейросетью
 * 
 * Функции:
 * 1. Динамическая загрузка списков брейнротов/мутаций/рарити с Eldorado
 * 2. Парсинг income через Gemini AI (gemma-3-27b-it)
 * 3. Гибридная система: сначала Regex, потом AI валидация
 * 4. Очередь для обработки измененных цен
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { connectToDatabase } = require('./_lib/db');

// Gemini AI Configuration
// IMPORTANT: API key should be set via environment variable GEMINI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemma-3-27b-it';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Eldorado Configuration
const ELDORADO_GAME_ID = '259';

// Rate Limits
const MAX_TOKENS_PER_MINUTE = 14000;
const MAX_REQUESTS_PER_MINUTE = 7;
const BASE_PROMPT_TOKENS = 1500;
const TOKENS_PER_OFFER = 25;

// Загружаем актуальные списки из файла eldorado-dropdown-lists.json
let eldoradoDropdownLists = {
    brainrots: [],
    mutations: ['None', 'Gold', 'Diamond', 'Bloodrot', 'Candy', 'Lava', 'Galaxy', 'Yin-Yang', 'Radioactive', 'Rainbow'],
    rarities: ['Common', 'Rare', 'Festive', 'Epic', 'Legendary', 'Mythical', 'Brainrot God', 'Secret', 'OG', 'Admin', 'Taco'],
    msRanges: ['0-24 M/s', '25-49 M/s', '50-99 M/s', '100-249 M/s', '250-499 M/s', '500-749 M/s', '750-999 M/s', '1+ B/s']
};

try {
    const dropdownPath = path.join(__dirname, '../data/eldorado-dropdown-lists.json');
    const dropdownData = JSON.parse(fs.readFileSync(dropdownPath, 'utf8'));
    eldoradoDropdownLists = {
        brainrots: dropdownData.brainrots || [],
        mutations: dropdownData.mutations || eldoradoDropdownLists.mutations,
        rarities: dropdownData.rarities || eldoradoDropdownLists.rarities,
        msRanges: dropdownData.msRanges || eldoradoDropdownLists.msRanges
    };
    console.log(`📋 Loaded from eldorado-dropdown-lists.json: ${eldoradoDropdownLists.brainrots.length} brainrots, ${eldoradoDropdownLists.mutations.length} mutations, ${eldoradoDropdownLists.rarities.length} rarities`);
} catch (e) {
    console.warn('Could not load eldorado-dropdown-lists.json:', e.message);
}

// Также загружаем старый файл для совместимости (brainrot IDs)
let brainrotIdMap = new Map();
try {
    const idsPath = path.join(__dirname, '../data/eldorado-brainrot-ids.json');
    const idsData = JSON.parse(fs.readFileSync(idsPath, 'utf8'));
    idsData.forEach(item => {
        brainrotIdMap.set(item.name.toLowerCase(), { id: item.id, name: item.name, price: item.price });
    });
    console.log(`📋 Loaded ${brainrotIdMap.size} brainrot IDs from eldorado-brainrot-ids.json`);
} catch (e) {
    console.warn('Could not load eldorado-brainrot-ids.json:', e.message);
}

// Кэш для динамических списков (обновляется раз в час)
let eldoradoListsCache = null;
let eldoradoListsCacheTime = 0;
const ELDORADO_CACHE_TTL = 60 * 60 * 1000; // 1 час

/**
 * Загружает динамические списки с Eldorado API
 * Если API недоступен - использует локальный кэш
 * Возвращает: { brainrots: [], mutations: [], rarities: [], msRanges: [] }
 */
async function fetchEldoradoDynamicLists() {
    // Проверяем кэш
    if (eldoradoListsCache && Date.now() - eldoradoListsCacheTime < ELDORADO_CACHE_TTL) {
        return eldoradoListsCache;
    }
    
    // Используем локальные данные из eldorado-dropdown-lists.json
    const lists = {
        brainrots: eldoradoDropdownLists.brainrots,
        mutations: eldoradoDropdownLists.mutations,
        rarities: eldoradoDropdownLists.rarities,
        msRanges: eldoradoDropdownLists.msRanges
    };
    
    // Пробуем обновить из API Eldorado (получаем актуальные данные из офферов)
    try {
        const apiLists = await fetchBrainrotsFromOffers();
        if (apiLists.brainrots.length > 0) {
            // Мержим с локальными (добавляем новые)
            const existingSet = new Set(lists.brainrots.map(b => b.toLowerCase()));
            for (const b of apiLists.brainrots) {
                if (!existingSet.has(b.toLowerCase())) {
                    lists.brainrots.push(b);
                    existingSet.add(b.toLowerCase());
                }
            }
            console.log(`📋 Updated brainrots from API: ${lists.brainrots.length} total`);
        }
    } catch (e) {
        console.warn('Could not fetch from Eldorado API:', e.message);
    }
    
    // Кэшируем
    eldoradoListsCache = lists;
    eldoradoListsCacheTime = Date.now();
    
    return lists;
}

/**
 * Извлекает уникальные названия брейнротов из офферов Eldorado
 */
function fetchBrainrotsFromOffers() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'www.eldorado.gg',
            path: `/api/flexibleOffers?gameId=${ELDORADO_GAME_ID}&category=CustomItem&tradeEnvironmentValue0=Brainrot&pageSize=100&pageIndex=1`,
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
                    const results = parsed.results || [];
                    
                    // Извлекаем уникальные брейнроты из атрибутов офферов
                    const brainrotsSet = new Set();
                    const mutationsSet = new Set();
                    const raritiesSet = new Set();
                    
                    for (const item of results) {
                        const offer = item.offer || item;
                        const attrs = offer.offerAttributeIdValues || [];
                        
                        for (const attr of attrs) {
                            if (attr.name === 'Brainrot' || attr.name === 'Name') {
                                brainrotsSet.add(attr.value);
                            } else if (attr.name === 'Mutation') {
                                mutationsSet.add(attr.value);
                            } else if (attr.name === 'Rarity') {
                                raritiesSet.add(attr.value);
                            }
                        }
                    }
                    
                    resolve({
                        brainrots: Array.from(brainrotsSet),
                        mutations: mutationsSet.size > 0 ? Array.from(mutationsSet) : eldoradoDropdownLists.mutations,
                        rarities: raritiesSet.size > 0 ? Array.from(raritiesSet) : eldoradoDropdownLists.rarities
                    });
                } catch (e) {
                    resolve({ brainrots: [], mutations: [], rarities: [] });
                }
            });
        });

        req.on('error', () => resolve({ brainrots: [], mutations: [], rarities: [] }));
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({ brainrots: [], mutations: [], rarities: [] });
        });
        req.end();
    });
}

/**
 * Fallback списки если Eldorado недоступен
 */
function getFallbackLists() {
    return {
        brainrots: [
            'Los Planitos', 'Los 67', 'Tralalero Tralala', 'La Vacca Saturno Saturnita',
            'Bombardiro Crocodilo', 'La Secret Combinasion', 'Eviledon', 'Orcaledon',
            'Matteo', 'Los Primos', 'Los Tacoritas', 'Frigo Camelo'
        ],
        mutations: ['None', 'Gold', 'Diamond', 'Bloodrot', 'Candy', 'Lava', 'Galaxy', 'Yin-Yang', 'Radioactive', 'Rainbow'],
        rarities: ['Common', 'Rare', 'Festive', 'Epic', 'Legendary', 'Mythical', 'Brainrot God', 'Secret', 'OG', 'Admin', 'Taco'],
        msRanges: ['0-24 M/s', '25-49 M/s', '50-99 M/s', '100-249 M/s', '250-499 M/s', '500-749 M/s', '750-999 M/s', '1+ B/s']
    };
}

/**
 * Убирает все emoji из строки
 */
function stripEmojis(str) {
    if (!str) return '';
    return str
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
        .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
        .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
        .replace(/[\u{231A}\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}]/gu, '')
        .replace(/[\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}]/gu, '')
        .replace(/[\u{2614}\u{2615}]/gu, '')
        .replace(/[\u{2648}-\u{2653}]/gu, '')
        .replace(/[\u{267F}\u{2693}\u{26A1}\u{26AA}\u{26AB}]/gu, '')
        .replace(/[\u{26BD}\u{26BE}\u{26C4}\u{26C5}\u{26CE}\u{26D4}]/gu, '')
        .replace(/[\u{26EA}\u{26F2}\u{26F3}\u{26F5}\u{26FA}\u{26FD}]/gu, '')
        .replace(/[\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}]/gu, '')
        .replace(/[\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}]/gu, '')
        .replace(/[\u{2728}\u{2733}\u{2734}\u{2744}\u{2747}]/gu, '')
        .replace(/[\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}]/gu, '')
        .replace(/[\u{2763}\u{2764}\u{2795}-\u{2797}\u{27A1}]/gu, '')
        .replace(/[\u{27B0}\u{27BF}\u{2934}\u{2935}]/gu, '')
        .replace(/[\u{2B05}-\u{2B07}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}]/gu, '')
        .replace(/[\u{3030}\u{303D}\u{3297}\u{3299}]/gu, '')
        .replace(/[\u{20E3}]/gu, '')
        .replace(/[0-9]\uFE0F?\u20E3/gu, '')
        .replace(/[#*]\uFE0F?\u20E3/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * REGEX парсер (базовый, быстрый)
 */
function parseIncomeRegex(title) {
    if (!title) return { income: null, reason: 'empty', source: 'regex' };
    
    // Сначала удаляем эмодзи для чистого парсинга
    const cleanTitle = stripEmojis(title);
    
    const normalized = cleanTitle
        .replace(/,/g, '.')
        .replace(/\s+/g, ' ')
        .replace(/\s*\.\s*/g, '.')
        .trim();
    
    // Проверка на диапазоны
    const rangePatterns = [
        /(\d+)\s*[mMkKbB]\/?[sS]?\s*[-~–—>]+\s*(\d+)\s*[mMkKbB]\/?[sS]?/i,
        /(\d+)\s*[-~–—>]+\s*(\d+)\s*[mMkKbB]\/?[sS]/i,
        /(\d+)\s*[-~–—>]+\s*(\d+)\s*[mMkKbB]/i,
        /0\s*-\s*24\s*[mM]/i   // Специальный случай "0-24M/s"
    ];
    
    for (const pattern of rangePatterns) {
        if (pattern.test(normalized)) {
            return { income: null, reason: 'range', source: 'regex' };
        }
    }
    
    // Проверка на рандомные офферы (но не "Lucky Block" - это название брейнрота!)
    // Ищем: "spin the wheel", "random m/s", "mystery box", "lucky spin/wheel/draw"
    const randomPatterns = [
        /spin\s*(the)?\s*wheel/i,
        /random\s*(m\/s|brainrot|pet)/i,
        /mystery\s*(box|pet|brainrot)/i,
        /lucky\s*(spin|wheel|draw)/i
    ];
    
    for (const pattern of randomPatterns) {
        if (pattern.test(normalized)) {
            return { income: null, reason: 'random', source: 'regex' };
        }
    }
    
    // M/s паттерны - улучшенные
    const mPatterns = [
        // Явные M/s форматы (высший приоритет)
        /(\d+\.?\d*)\s*[mM]\s*\/\s*[sS]/i,        // 125M/s, 125 m / s
        /(\d+\.?\d*)\s*[mM]\/[sS]/i,              // 125m/s (без пробелов)
        /(\d+\.?\d*)\s*mil\s*\/\s*[sS]/i,         // 125mil/s
        // M без /s но с пробелом или в конце
        /(\d+\.?\d*)\s*[mM](?:\s|$|[^a-zA-Z\/])/i, // 125M , 125m (не 125Max)
        /(\d+\.?\d*)\s*mil\b/i,                    // 125mil
    ];

    for (const pattern of mPatterns) {
        const match = normalized.match(pattern);
        if (match) {
            const value = parseFloat(match[1]);
            if (!isNaN(value) && value >= 1 && value <= 99999) {
                return { income: value, reason: null, source: 'regex' };
            }
        }
    }
    
    // K/s паттерны
    const kPatterns = [
        /\$?([\d.]+)\s*[kK]\s*\/\s*[sS]/i,
        /\$?([\d.]+)\s*[kK]\b(?!\w)/
    ];
    
    for (const pattern of kPatterns) {
        const match = normalized.match(pattern);
        if (match) {
            const value = parseFloat(match[1]);
            const mValue = value / 1000;
            if (!isNaN(mValue) && mValue >= 0.001 && mValue <= 999) {
                return { income: mValue, reason: null, source: 'regex' };
            }
        }
    }
    
    // B/s паттерны
    const bPatterns = [
        /\$?([\d.]+)\s*[bB]\s*\/\s*[sS]/i,
        /\$?([\d.]+)\s*bil\/s/i
    ];
    
    for (const pattern of bPatterns) {
        const match = normalized.match(pattern);
        if (match) {
            const value = parseFloat(match[1]);
            const msValue = value * 1000;
            if (!isNaN(msValue) && msValue >= 1000 && msValue <= 999999) {
                return { income: msValue, reason: null, source: 'regex' };
            }
        }
    }
    
    return { income: null, reason: 'no_pattern', source: 'regex' };
}

/**
 * Создаёт AI prompt с динамическими списками
 */
function createAIPrompt(offers, eldoradoLists) {
    const cleanedOffers = offers.map(o => ({
        ...o,
        cleanTitle: stripEmojis(o.title || o.offerTitle || '')
    }));
    
    // Берём первые 50 брейнротов и 10 мутаций для контекста
    const brainrotsSample = eldoradoLists.brainrots.slice(0, 50).join(', ');
    const mutationsList = eldoradoLists.mutations.join(', ');
    const raritiesList = eldoradoLists.rarities.join(', ');
    
    return `TASK: Extract income values from Roblox "Steal a Brainrot" marketplace titles.

CONTEXT - Known Brainrot Names (IGNORE these in income detection):
${brainrotsSample}

MUTATIONS (IGNORE - NOT income): ${mutationsList}
RARITIES (IGNORE - NOT income): ${raritiesList}

OFFERS TO PARSE:
${cleanedOffers.map((o, i) => `${i + 1}. "${o.cleanTitle}"`).join('\n')}

EXTRACT for each offer:
- "m" (income): Income in M/s (millions/second), or null
- "r" (reason): If m=null: "range", "random", or "no_value"

INCOME FORMATS - CRITICAL - EXTRACT ANY NUMBER + M/m/K/B pattern:
- "270M/s" → 270
- "135m/s" → 135  
- "350 m" or "350m" → 350
- "18,5M/s" → 18.5 (COMMA IS DECIMAL SEPARATOR, NOT RANGE!)
- "18.5 mil" → 18.5
- "531K/s" → 0.531 (K=thousands, divide by 1000)
- "1.5B/s" → 1500 (B=billions, multiply by 1000)
- "125m/s LA SECRET" → 125 (ignore text after number!)
- "300M DIAMOND" → 300 (DIAMOND is mutation, ignore!)

CRITICAL RULES:
1. Look for NUMBER + M/m/K/B ANYWHERE in title (start, middle, end)
2. "m" alone after number = millions (e.g., "350 m" = 350 M/s)
3. Ignore all brainrot names, mutations, rarities
4. Ignore prices ($4.50, $12, etc.)
5. COMMA IN NUMBER (18,5) = DECIMAL (18.5), NOT A RANGE!

RANGE = null (MUST HAVE DASH/ARROW/TILDE BETWEEN TWO NUMBERS):
- "0-24M/s", "10m-13m/s" → null, r="range" (dash between numbers)
- "100->150m/s" → null, r="range" (arrow between numbers)  
- "50~100M" → null, r="range" (tilde between numbers)
- "18,5M/s" is NOT a range - comma is decimal separator!

RANDOM = null (when title contains "random" word or similar):
- "Random Brainrot" → null, r="random" (word "random" in title)
- "Random ms/s" → null, r="random"
- "Spin The Wheel" → null, r="random"
- "Mystery Box" → null, r="random"

OUTPUT STRICT JSON (no markdown, no explanation):
{"results":[{"i":1,"m":350},{"i":2,"m":null,"r":"range"}]}`;
}

/**
 * AI парсер (Gemini gemma-3-27b-it)
 */
async function parseIncomeAI(offers, eldoradoLists) {
    const prompt = createAIPrompt(offers, eldoradoLists);
    
    return new Promise((resolve, reject) => {
        const requestBody = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048,
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
                        // Проверяем на overload
                        if (parsed.error.message?.includes('overloaded') || 
                            parsed.error.code === 503) {
                            reject(new Error('MODEL_OVERLOADED'));
                            return;
                        }
                        reject(new Error(parsed.error.message));
                        return;
                    }
                    
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    
                    // Парсим JSON из ответа
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const result = JSON.parse(jsonMatch[0]);
                        resolve(result.results || []);
                    } else {
                        resolve([]);
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        
        req.write(requestBody);
        req.end();
    });
}

/**
 * Оценивает количество токенов
 */
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4 * 1.2);
}

/**
 * Разбивает офферы на батчи с учётом токенов
 * Сохраняет originalIndex если он уже есть в оффере
 */
function createTokenAwareBatches(offers, maxTokensPerBatch = 2000) {
    const batches = [];
    let currentBatch = [];
    let currentTokens = BASE_PROMPT_TOKENS;
    
    for (let i = 0; i < offers.length; i++) {
        const offer = offers[i];
        const title = offer.title || offer.offerTitle || '';
        const offerTokens = estimateTokens(title) + 5;
        
        if (currentBatch.length > 0 && currentTokens + offerTokens > maxTokensPerBatch) {
            batches.push({
                startIndex: i - currentBatch.length,
                offers: currentBatch,
                estimatedTokens: currentTokens
            });
            currentBatch = [];
            currentTokens = BASE_PROMPT_TOKENS;
        }
        
        // Сохраняем originalIndex если он уже есть, иначе используем локальный i
        const preservedIndex = offer.originalIndex !== undefined ? offer.originalIndex : i;
        currentBatch.push({ ...offer, originalIndex: preservedIndex });
        currentTokens += offerTokens;
    }
    
    if (currentBatch.length > 0) {
        batches.push({
            startIndex: offers.length - currentBatch.length,
            offers: currentBatch,
            estimatedTokens: currentTokens
        });
    }
    
    return batches;
}

/**
 * Группирует батчи в волны
 */
function createWaves(batches, maxTokens = MAX_TOKENS_PER_MINUTE, maxRequests = MAX_REQUESTS_PER_MINUTE) {
    const waves = [];
    let currentWave = [];
    let currentTokens = 0;
    
    for (const batch of batches) {
        const batchTokens = batch.estimatedTokens || 2000;
        
        if (currentWave.length > 0 && 
            (currentTokens + batchTokens > maxTokens || currentWave.length >= maxRequests)) {
            waves.push({
                batches: currentWave,
                totalTokens: currentTokens,
                requestCount: currentWave.length
            });
            currentWave = [];
            currentTokens = 0;
        }
        
        currentWave.push(batch);
        currentTokens += batchTokens;
    }
    
    if (currentWave.length > 0) {
        waves.push({
            batches: currentWave,
            totalTokens: currentTokens,
            requestCount: currentWave.length
        });
    }
    
    return waves;
}

/**
 * Гибридный парсинг: сначала Regex, потом AI валидация
 * Возвращает: { income, source: 'ai'|'regex'|'hybrid', confidence }
 */
async function hybridParse(offers, eldoradoLists) {
    const results = [];
    
    // Шаг 1: Быстрый Regex парсинг для всех
    const regexResults = offers.map((offer, i) => {
        const title = offer.title || offer.offerTitle || '';
        const regex = parseIncomeRegex(title);
        return {
            index: i,
            offer,
            regex,
            needsAI: regex.income === null && regex.reason === 'no_pattern'
        };
    });
    
    // Шаг 2: Собираем офферы для AI (где Regex не справился)
    const needAI = regexResults.filter(r => r.needsAI);
    
    if (needAI.length === 0) {
        // Regex справился со всеми
        return regexResults.map(r => ({
            ...r.offer,
            income: r.regex.income,
            reason: r.regex.reason,
            source: 'regex',
            confidence: 0.9
        }));
    }
    
    // Шаг 3: AI парсинг для проблемных
    // Важно: передаём оригинальный индекс из regexResults
    const offersForAI = needAI.map(r => ({ ...r.offer, originalIndex: r.index }));
    const batches = createTokenAwareBatches(offersForAI, 2000);
    const waves = createWaves(batches);
    
    const aiResultsMap = new Map();
    
    for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
        const wave = waves[waveIndex];
        
        // Параллельная обработка батчей в волне
        const wavePromises = wave.batches.map(async (batch, batchIndex) => {
            try {
                const aiResults = await parseIncomeAI(batch.offers, eldoradoLists);
                
                // Сопоставляем результаты с оригинальными индексами
                for (let j = 0; j < aiResults.length; j++) {
                    const ai = aiResults[j];
                    const offer = batch.offers[ai.i - 1]; // ai.i is 1-based
                    if (offer && offer.originalIndex !== undefined) {
                        aiResultsMap.set(offer.originalIndex, {
                            income: ai.m,
                            reason: ai.r,
                            source: 'ai'
                        });
                    }
                }
            } catch (e) {
                console.error(`Batch ${batchIndex} error:`, e.message);
                // При ошибке оставляем regex результат
            }
        });
        
        await Promise.all(wavePromises);
        
        // Пауза между волнами
        if (waveIndex < waves.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    
    // Шаг 4: Объединяем результаты
    return regexResults.map(r => {
        // AI результат только для тех, кому он нужен
        const ai = r.needsAI ? aiResultsMap.get(r.index) : null;
        
        if (r.regex.income !== null) {
            // Regex нашёл income - используем его
            return {
                ...r.offer,
                income: r.regex.income,
                reason: r.regex.reason,
                source: 'regex',
                confidence: 0.9
            };
        } else if (ai && ai.income !== null) {
            // AI нашёл income
            return {
                ...r.offer,
                income: ai.income,
                reason: ai.reason,
                source: 'ai',
                confidence: 0.95
            };
        } else if (ai) {
            // AI вернул reason (range/random/no_value)
            return {
                ...r.offer,
                income: null,
                reason: ai.reason || r.regex.reason,
                source: 'ai',
                confidence: 0.85
            };
        } else {
            // Fallback на regex результат
            return {
                ...r.offer,
                income: r.regex.income,
                reason: r.regex.reason,
                source: 'regex',
                confidence: 0.7
            };
        }
    });
}

/**
 * Находит upper и lower офферы для целевого income
 */
function findUpperLower(offers, targetIncome) {
    let upper = null;
    
    for (const offer of offers) {
        if (offer.income === null) continue;
        
        if (offer.income >= targetIncome) {
            const price = offer.price || offer.pricePerUnitInUSD?.amount || 0;
            if (!upper || price < upper.price) {
                upper = { ...offer, price };
            }
        }
    }
    
    let lower = null;
    const maxPrice = upper ? upper.price : Infinity;
    
    for (const offer of offers) {
        if (offer.income === null) continue;
        
        const price = offer.price || offer.pricePerUnitInUSD?.amount || 0;
        
        if (offer.income < targetIncome && price < maxPrice) {
            if (!lower || offer.income > lower.income) {
                lower = { ...offer, price };
            } else if (offer.income === lower.income && price < lower.price) {
                lower = { ...offer, price };
            }
        }
    }
    
    return { upper, lower };
}

/**
 * Основной обработчик API
 */
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // GET /api/ai-scanner/lists - Получить динамические списки
        if (req.method === 'GET' && req.url.includes('/lists')) {
            const lists = await fetchEldoradoDynamicLists();
            return res.json({
                success: true,
                lists,
                cacheAge: Date.now() - eldoradoListsCacheTime
            });
        }
        
        // GET /api/ai-scanner/regex - Только regex парсинг (быстрый)
        if (req.method === 'GET' && req.url.includes('/regex')) {
            const { title } = req.query;
            if (!title) {
                return res.status(400).json({ error: 'title required' });
            }
            const result = parseIncomeRegex(title);
            return res.json({ success: true, result });
        }
        
        // POST /api/ai-scanner - Гибридный парсинг офферов
        if (req.method === 'POST') {
            const { offers, targetIncome, mode = 'hybrid' } = req.body;
            
            if (!offers || !Array.isArray(offers)) {
                return res.status(400).json({ error: 'offers array required' });
            }
            
            // Загружаем динамические списки
            const eldoradoLists = await fetchEldoradoDynamicLists();
            
            let results;
            
            if (mode === 'regex') {
                // Только regex
                results = offers.map(o => {
                    const r = parseIncomeRegex(o.title || o.offerTitle);
                    return { ...o, ...r };
                });
            } else if (mode === 'ai') {
                // Только AI
                const batches = createTokenAwareBatches(offers, 2000);
                const waves = createWaves(batches);
                
                const aiResults = [];
                for (const wave of waves) {
                    for (const batch of wave.batches) {
                        try {
                            const ai = await parseIncomeAI(batch.offers, eldoradoLists);
                            for (let i = 0; i < ai.length; i++) {
                                const offer = batch.offers[i];
                                aiResults.push({
                                    ...offer,
                                    income: ai[i]?.m,
                                    reason: ai[i]?.r,
                                    source: 'ai'
                                });
                            }
                        } catch (e) {
                            // Fallback на regex при ошибке
                            for (const offer of batch.offers) {
                                const r = parseIncomeRegex(offer.title || offer.offerTitle);
                                aiResults.push({ ...offer, ...r, source: 'regex_fallback' });
                            }
                        }
                    }
                }
                results = aiResults;
            } else {
                // Гибридный режим (по умолчанию)
                results = await hybridParse(offers, eldoradoLists);
            }
            
            // Если указан targetIncome - находим upper/lower
            let upperLower = null;
            if (targetIncome) {
                upperLower = findUpperLower(results, targetIncome);
            }
            
            return res.json({
                success: true,
                results,
                upperLower,
                stats: {
                    total: results.length,
                    parsed: results.filter(r => r.income !== null).length,
                    aiParsed: results.filter(r => r.source === 'ai').length,
                    regexParsed: results.filter(r => r.source === 'regex').length
                }
            });
        }

        if (req.method === 'GET') {
            // GET /api/ai-scanner - получить текущие списки Eldorado
            const lists = await fetchEldoradoDynamicLists();
            return res.json({
                success: true,
                lists: {
                    brainrots: lists.brainrots,
                    mutations: lists.mutations,
                    rarities: lists.rarities,
                    msRanges: lists.msRanges
                },
                counts: {
                    brainrots: lists.brainrots.length,
                    mutations: lists.mutations.length,
                    rarities: lists.rarities.length,
                    msRanges: lists.msRanges.length
                }
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('AI Scanner error:', error);
        return res.status(500).json({ error: error.message });
    }
};

// Экспорты для использования в других модулях
module.exports.parseIncomeRegex = parseIncomeRegex;
module.exports.parseIncomeAI = parseIncomeAI;
module.exports.hybridParse = hybridParse;
module.exports.fetchEldoradoDynamicLists = fetchEldoradoDynamicLists;
module.exports.stripEmojis = stripEmojis;

// Экспорт для тестирования
module.exports.fetchEldoradoDynamicLists = fetchEldoradoDynamicLists;
module.exports.parseIncomeRegex = parseIncomeRegex;
module.exports.parseIncomeAI = parseIncomeAI;
module.exports.hybridParse = hybridParse;
module.exports.findUpperLower = findUpperLower;
