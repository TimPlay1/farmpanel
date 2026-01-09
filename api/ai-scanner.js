/**
 * AI Scanner API - Умный парсер офферов с нейросетью
 * 
 * Функции:
 * 1. Динамическая загрузка списков брейнротов/мутаций/рарити с Eldorado
 * 2. Парсинг income через Gemini AI (gemma-3-27b-it)
 * 3. Гибридная система: сначала Regex, потом AI валидация
 * 4. ГЛОБАЛЬНЫЙ rate limiter через MongoDB для координации serverless инстансов
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { connectToDatabase, checkGlobalRateLimit, recordAIUsage } = require('./_lib/db');

// Gemini AI Configuration
// IMPORTANT: API key should be set via environment variable GEMINI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemma-3-27b-it';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Eldorado Configuration
const ELDORADO_GAME_ID = '259';

// Local rate limits (backup, global limiter is primary)
// Используем консервативные значения - глобальный лимитер в MongoDB основной
const MAX_TOKENS_PER_MINUTE = 10000;  // Реально 15K, но оставляем запас
const MAX_REQUESTS_PER_MINUTE = 5;     // Реально 30, но оставляем запас для пользователей
const BASE_PROMPT_TOKENS = 1200;       // Сокращённый промпт
const TOKENS_PER_OFFER = 20;           // ~20 токенов на оффер

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
const ELDORADO_LIBRARY_API = '/api/library/259/CustomItem?locale=en-US';
const DATA_DIR = path.join(__dirname, '../data');

/**
 * Получает данные из Eldorado Library API
 * Это официальный API который возвращает ВСЕ dropdown списки
 */
function fetchEldoradoLibraryAPI() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.eldorado.gg',
            path: ELDORADO_LIBRARY_API,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'swagger': 'Swagger request'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Failed to parse Library API response: ' + e.message));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Library API request timeout'));
        });
        req.end();
    });
}

/**
 * Рекурсивно извлекает брейнроты из tradeEnvironments
 */
function extractBrainrotsFromTree(tradeEnvironments, brainrotsMap = new Map(), raritiesSet = new Set()) {
    for (const env of tradeEnvironments) {
        if (env.name === 'Rarity' && env.value) {
            raritiesSet.add(env.value);
        }
        if (env.name === 'Brainrot' && env.value && env.value !== 'Other') {
            brainrotsMap.set(env.value.toLowerCase(), {
                name: env.value,
                id: env.id,
                rarity: env.parentId ? env.parentId.split('-')[1] : null
            });
        }
        if (env.childTradeEnvironments && env.childTradeEnvironments.length > 0) {
            extractBrainrotsFromTree(env.childTradeEnvironments, brainrotsMap, raritiesSet);
        }
    }
    return { brainrotsMap, raritiesSet };
}

/**
 * Извлекает атрибуты (M/s, Mutations) из Library API
 */
function extractAttributesFromLibrary(attributes) {
    const msRanges = [];
    const mutations = [];
    
    for (const attr of attributes) {
        if (attr.name === 'M/s' && attr.attributeValues) {
            for (const val of attr.attributeValues) {
                msRanges.push(val.name);
            }
        } else if (attr.name === 'Mutations' && attr.attributeValues) {
            for (const val of attr.attributeValues) {
                mutations.push(val.name);
            }
        }
    }
    
    return { msRanges, mutations };
}

/**
 * Обновляет списки Eldorado через Library API и сохраняет в файлы
 * Экспортируется для вызова из server.js
 */
async function updateEldoradoLists() {
    console.log('🔄 Fetching Eldorado Library API...');
    
    try {
        const data = await fetchEldoradoLibraryAPI();
        
        if (!data.tradeEnvironments) {
            console.error('❌ Invalid Library API response - no tradeEnvironments');
            return null;
        }
        
        const { brainrotsMap, raritiesSet } = extractBrainrotsFromTree(data.tradeEnvironments);
        const { msRanges, mutations } = extractAttributesFromLibrary(data.attributes || []);
        
        const brainrotsList = Array.from(brainrotsMap.values()).map(b => b.name).sort();
        const raritiesList = Array.from(raritiesSet);
        
        console.log(`📋 Found: ${brainrotsList.length} brainrots, ${raritiesList.length} rarities, ${mutations.length} mutations, ${msRanges.length} M/s ranges`);
        
        // Создаем объект данных (только in-memory, НЕ записываем файлы на Vercel - read-only FS)
        const dropdownData = {
            lastUpdated: new Date().toISOString(),
            source: 'eldorado.gg Library API',
            msRanges: msRanges,
            rarities: raritiesList,
            mutations: mutations,
            brainrots: brainrotsList
        };
        
        // НЕ записываем в файлы - Vercel serverless имеет read-only файловую систему
        // Используем только in-memory кэш
        console.log(`✅ Loaded ${brainrotsList.length} brainrots into memory cache`);
        
        // Подготавливаем IDs данные (только для in-memory)
        const idsData = Array.from(brainrotsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        console.log(`✅ Loaded ${idsData.length} brainrot IDs into memory cache`);
        
        // Обновляем локальный кэш
        eldoradoDropdownLists = dropdownData;
        eldoradoListsCache = dropdownData;
        eldoradoListsCacheTime = Date.now();
        
        // Обновляем brainrotIdMap
        brainrotIdMap.clear();
        idsData.forEach(item => {
            brainrotIdMap.set(item.name.toLowerCase(), { id: item.id, name: item.name });
        });
        
        return dropdownData;
        
    } catch (error) {
        console.error('❌ Library API Error:', error.message);
        return null;
    }
}

/**
 * Загружает динамические списки с Eldorado
 * Использует кэш, при необходимости обновляет через Library API
 */
async function fetchEldoradoDynamicLists() {
    // Проверяем кэш
    if (eldoradoListsCache && Date.now() - eldoradoListsCacheTime < ELDORADO_CACHE_TTL) {
        return eldoradoListsCache;
    }
    
    // Пробуем обновить через Library API
    const result = await updateEldoradoLists();
    if (result) {
        return result;
    }
    
    // Fallback: возвращаем локальные данные
    return {
        brainrots: eldoradoDropdownLists.brainrots,
        mutations: eldoradoDropdownLists.mutations,
        rarities: eldoradoDropdownLists.rarities,
        msRanges: eldoradoDropdownLists.msRanges
    };
}

/**
 * Извлекает уникальные значения для dropdown списков из офферов Eldorado
 * Сканирует несколько страниц для получения полного списка
 * 
 * Источники из tradeEnvironmentValues:
 * - name='Brainrot' → список брейнротов
 * - name='Rarity' → список рарити
 * 
 * Источники из offerAttributeIdValues:
 * - name='M/s' → диапазоны M/s
 * - name='Mutations' → мутации
 */
function fetchBrainrotsFromOffers(pagesToScan = 50) {
    return new Promise(async (resolve) => {
        const brainrotsSet = new Set();
        const brainrotsIdMap = new Map(); // name -> { id, minPrice }
        const mutationsSet = new Set();
        const raritiesSet = new Set();
        const msRangesSet = new Set();
        
        console.log(`🔄 Scanning ${pagesToScan} pages from Eldorado API for brainrot list update...`);
        
        // Сканируем несколько страниц для получения разнообразных данных
        for (let page = 1; page <= pagesToScan; page++) {
            try {
                const pageData = await fetchEldoradoPage(page);
                if (!pageData.results || pageData.results.length === 0) break;
                
                for (const item of pageData.results) {
                    const offer = item.offer || item;
                    
                    // Из tradeEnvironmentValues (официальные фильтры Eldorado)
                    const tradeEnvs = offer.tradeEnvironmentValues || [];
                    for (const env of tradeEnvs) {
                        if (env.name === 'Brainrot' && env.value) {
                            brainrotsSet.add(env.value);
                            // Сохраняем ID и минимальную цену
                            const nameLower = env.value.toLowerCase();
                            const offerPrice = parseFloat(offer.unitPrice || 0);
                            if (!brainrotsIdMap.has(nameLower)) {
                                brainrotsIdMap.set(nameLower, { name: env.value, id: env.id || null, minPrice: offerPrice > 0 ? offerPrice : null });
                            } else {
                                const existing = brainrotsIdMap.get(nameLower);
                                if (!existing.id && env.id) existing.id = env.id;
                                if (offerPrice > 0 && (!existing.minPrice || offerPrice < existing.minPrice)) {
                                    existing.minPrice = offerPrice;
                                }
                            }
                        } else if (env.name === 'Rarity' && env.value) {
                            raritiesSet.add(env.value);
                        }
                    }
                    
                    // Из offerAttributeIdValues (атрибуты)
                    const attrs = offer.offerAttributeIdValues || [];
                    for (const attr of attrs) {
                        if (attr.name === 'Mutations' && attr.value) {
                            mutationsSet.add(attr.value);
                        } else if (attr.name === 'M/s' && attr.value) {
                            msRangesSet.add(attr.value);
                        }
                    }
                }
                
                // Небольшая задержка между страницами
                if (page < pagesToScan) {
                    await new Promise(r => setTimeout(r, 100));
                }
            } catch (e) {
                console.warn(`Failed to fetch page ${page}:`, e.message);
                break;
            }
        }
        
        console.log(`📋 Fetched from Eldorado API: ${brainrotsSet.size} brainrots, ${raritiesSet.size} rarities, ${mutationsSet.size} mutations, ${msRangesSet.size} M/s ranges`);
        
        // Сохраняем обновлённые списки в файлы (если есть новые данные)
        if (brainrotsSet.size > 0) {
            try {
                const brainrotsList = Array.from(brainrotsSet).sort();
                const dropdownData = {
                    lastUpdated: new Date().toISOString(),
                    source: 'eldorado.gg API auto-scan',
                    msRanges: msRangesSet.size > 0 ? Array.from(msRangesSet).sort() : eldoradoDropdownLists.msRanges,
                    rarities: raritiesSet.size > 0 ? Array.from(raritiesSet).sort() : eldoradoDropdownLists.rarities,
                    mutations: mutationsSet.size > 0 ? Array.from(mutationsSet).sort() : eldoradoDropdownLists.mutations,
                    brainrots: brainrotsList
                };
                
                // НЕ записываем в файлы - Vercel serverless имеет read-only файловую систему
                // Только обновляем in-memory кэш
                
                const idsArray = Array.from(brainrotsIdMap.values()).sort((a, b) => a.name.localeCompare(b.name));
                
                // Обновляем in-memory кэш
                eldoradoDropdownLists.brainrots = brainrotsList;
                if (msRangesSet.size > 0) eldoradoDropdownLists.msRanges = Array.from(msRangesSet);
                if (raritiesSet.size > 0) eldoradoDropdownLists.rarities = Array.from(raritiesSet);
                if (mutationsSet.size > 0) eldoradoDropdownLists.mutations = Array.from(mutationsSet);
                
                // Обновляем brainrotIdMap
                brainrotIdMap.clear();
                for (const item of idsArray) {
                    brainrotIdMap.set(item.name.toLowerCase(), item);
                }
                
                console.log(`✅ Updated memory cache: ${brainrotsList.length} brainrots, ${idsArray.length} IDs`);
            } catch (saveErr) {
                console.warn('Could not update memory cache:', saveErr.message);
            }
        }
        
        resolve({
            brainrots: Array.from(brainrotsSet),
            brainrotsIdMap: brainrotsIdMap,
            mutations: mutationsSet.size > 0 ? Array.from(mutationsSet) : eldoradoDropdownLists.mutations,
            rarities: raritiesSet.size > 0 ? Array.from(raritiesSet) : eldoradoDropdownLists.rarities,
            msRanges: msRangesSet.size > 0 ? Array.from(msRangesSet) : eldoradoDropdownLists.msRanges
        });
    });
}

/**
 * Fetch одной страницы офферов с Eldorado
 * НЕ используем tradeEnvironmentValue0=Brainrot - он блокирует результаты
 */
function fetchEldoradoPage(pageIndex) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.eldorado.gg',
            path: `/api/flexibleOffers?gameId=${ELDORADO_GAME_ID}&category=CustomItem&pageSize=100&pageIndex=${pageIndex}&offerSortingCriterion=Price&isAscending=true`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'swagger': 'Swager request'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout'));
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
    
    // v10.3.16: Убираем паттерны количества товаров "x2 mutations", "x3", "2x" и т.д.
    // Продавцы пишут это чтобы показать количество на продажу, а не количество мутаций
    // "740M - x2 mutations" -> "740M"
    let preprocessed = cleanTitle
        .replace(/\s*[-–—]\s*x\d+\s*(mutation|mutations|mut)?\s*/gi, ' ')
        .replace(/\s*x\d+\s*(mutation|mutations|mut)\s*/gi, ' ')
        .replace(/\s*\d+x\s*(mutation|mutations|mut)\s*/gi, ' ');
    
    const normalized = preprocessed
        .replace(/,/g, '.')
        .replace(/\s+/g, ' ')
        .replace(/\s*\.\s*/g, '.')
        .trim();
    
    // Проверка на диапазоны: "88M to 220M/s", "150m - 500m/s", "100~500M/s"
    // Такие офферы ненадёжны для определения цены
    const rangePatterns = [
        /(\d+)\s*[mMkKbB]\/?[sS]?\s*[-~–—>]+\s*(\d+)\s*[mMkKbB]\/?[sS]?/i,
        /(\d+)\s*[-~–—>]+\s*(\d+)\s*[mMkKbB]\/?[sS]/i,
        /(\d+)\s*[-~–—>]+\s*(\d+)\s*[mMkKbB]/i,
        /(\d+)\s*[mM]?\s+to\s+(\d+)\s*[mMkKbB]\/?[sS]?/i,  // "88M to 220M/s", "88 to 220M/s"
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
 * v9.10.15: Добавлена поддержка expectedBrainrot для проверки wrong_brainrot
 * 
 * @param {Array} offers - офферы для парсинга
 * @param {Object} eldoradoLists - списки брейнротов/мутаций/рарити
 * @param {string|null} expectedBrainrot - ожидаемое название брейнрота (опционально)
 */
function createAIPrompt(offers, eldoradoLists, expectedBrainrot = null) {
    const cleanedOffers = offers.map(o => ({
        ...o,
        cleanTitle: stripEmojis(o.title || o.offerTitle || '')
    }));
    
    // Берём первые 50 брейнротов и 10 мутаций для контекста
    const brainrotsSample = eldoradoLists.brainrots.slice(0, 50).join(', ');
    const mutationsList = eldoradoLists.mutations.join(', ');
    const raritiesList = eldoradoLists.rarities.join(', ');
    
    // v9.10.15: Дополнительный блок для проверки названия брейнрота
    const brainrotCheckSection = expectedBrainrot ? `
BRAINROT NAME CHECK - VERY IMPORTANT:
Expected brainrot: "${expectedBrainrot}"
- "b" (brainrot): Detected brainrot name in title, or "unknown" if not found
- If title contains a DIFFERENT brainrot from the list (not "${expectedBrainrot}"), mark it!
- Examples for "${expectedBrainrot}":
  * "Los 25 100M/s" → b="${expectedBrainrot}" (matches)
  * "Los 67 100M/s" → b="Los 67" (DIFFERENT brainrot!)
  * "La Secret Combinasion 1.5B/s" → b="La Secret Combinasion" (DIFFERENT!)
  * "100M/s fast delivery" → b="unknown" (no brainrot name found)
- For "Los XX" patterns (Los 25, Los 67, etc.), the NUMBER matters! Los 25 ≠ Los 67
` : '';

    const outputFormat = expectedBrainrot 
        ? '{"results":[{"i":1,"m":350,"b":"Los 25"},{"i":2,"m":null,"r":"range","b":"Los 67"}]}'
        : '{"results":[{"i":1,"m":350},{"i":2,"m":null,"r":"range"}]}';

    return `TASK: Extract income values from Roblox "Steal a Brainrot" marketplace titles.

CONTEXT - Known Brainrot Names (IGNORE these in income detection):
${brainrotsSample}

MUTATIONS (IGNORE - NOT income): ${mutationsList}
RARITIES (IGNORE - NOT income): ${raritiesList}

OFFERS TO PARSE:
${cleanedOffers.map((o, i) => `${i + 1}. "${o.cleanTitle}"`).join('\n')}

EXTRACT for each offer:
- "m" (income): Income in M/s (millions/second), or null
- "r" (reason): If m=null: "range", "random", or "no_value"${expectedBrainrot ? '\n- "b" (brainrot): Detected brainrot name or "unknown"' : ''}
${brainrotCheckSection}
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
3. Ignore all brainrot names, mutations, rarities IN INCOME DETECTION
4. Ignore prices ($4.50, $12, etc.)
5. COMMA IN NUMBER (18,5) = DECIMAL (18.5), NOT A RANGE!

RANGE = null (MUST HAVE DASH/ARROW/TILDE/TO BETWEEN TWO NUMBERS):
- "0-24M/s", "10m-13m/s" → null, r="range" (dash between numbers)
- "100->150m/s" → null, r="range" (arrow between numbers)  
- "50~100M" → null, r="range" (tilde between numbers)
- "88M to 220M/s" → null, r="range" ("to" word between numbers)
- "100 to 500M/s" → null, r="range" ("to" word between numbers)
- "18,5M/s" is NOT a range - comma is decimal separator!

RANDOM = null (when title contains "random" word or similar):
- "Random Brainrot" → null, r="random" (word "random" in title)
- "Random ms/s" → null, r="random"
- "Spin The Wheel" → null, r="random"
- "Mystery Box" → null, r="random"

OUTPUT STRICT JSON (no markdown, no explanation):
${outputFormat}`;
}

/**
 * AI парсер (Gemini gemma-3-27b-it)
 * v9.10.15: Добавлен параметр expectedBrainrot для проверки wrong_brainrot
 * 
 * @param {Array} offers - офферы для парсинга
 * @param {Object} eldoradoLists - списки брейнротов/мутаций/рарити  
 * @param {string|null} expectedBrainrot - ожидаемое название брейнрота (опционально)
 */
async function parseIncomeAI(offers, eldoradoLists, expectedBrainrot = null) {
    const prompt = createAIPrompt(offers, eldoradoLists, expectedBrainrot);
    
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
                    
                    // v2.5.3: Более robust парсинг JSON из ответа AI
                    // Gemini иногда добавляет текст до/после JSON
                    let jsonResult = null;
                    
                    // Метод 1: Ищем JSON объект с "results"
                    const resultsMatch = text.match(/\{\s*"results"\s*:\s*\[[\s\S]*?\]\s*\}/);
                    if (resultsMatch) {
                        try {
                            jsonResult = JSON.parse(resultsMatch[0]);
                        } catch (e) {
                            console.log('Method 1 parse failed:', e.message);
                        }
                    }
                    
                    // Метод 2: Ищем JSON между ```json и ```
                    if (!jsonResult) {
                        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
                        if (codeBlockMatch) {
                            try {
                                jsonResult = JSON.parse(codeBlockMatch[1].trim());
                            } catch (e) {
                                console.log('Method 2 parse failed:', e.message);
                            }
                        }
                    }
                    
                    // Метод 3: Пробуем найти первый { и последний соответствующий }
                    if (!jsonResult) {
                        const firstBrace = text.indexOf('{');
                        if (firstBrace !== -1) {
                            let depth = 0;
                            let lastBrace = -1;
                            for (let i = firstBrace; i < text.length; i++) {
                                if (text[i] === '{') depth++;
                                else if (text[i] === '}') {
                                    depth--;
                                    if (depth === 0) {
                                        lastBrace = i;
                                        break;
                                    }
                                }
                            }
                            if (lastBrace !== -1) {
                                try {
                                    jsonResult = JSON.parse(text.substring(firstBrace, lastBrace + 1));
                                } catch (e) {
                                    console.log('Method 3 parse failed:', e.message);
                                }
                            }
                        }
                    }
                    
                    if (jsonResult && jsonResult.results) {
                        resolve(jsonResult.results);
                    } else {
                        console.log('AI returned no valid JSON results, raw text length:', text.length);
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
 * Гибридный парсинг: Regex сразу + AI параллельно
 * AI имеет ПРИОРИТЕТ над regex если нашёл значение
 * 
 * ЛОГИКА по схеме:
 * 1. Regex парсит ВСЕ офферы → мгновенный результат
 * 2. AI парсит ВСЕ офферы параллельно (волнами)
 * 3. Сравниваем результаты: AI приоритет если найден
 * 4. Если AI ошибка → используем regex
 * 
 * v9.10.15: Добавлен параметр expectedBrainrot для проверки wrong_brainrot
 * v2.5.0: Глобальный rate limiter через MongoDB
 * 
 * @param {Array} offers - офферы для парсинга
 * @param {Object} eldoradoLists - списки брейнротов/мутаций/рарити
 * @param {string|null} expectedBrainrot - ожидаемое название брейнрота (опционально)
 */
async function hybridParse(offers, eldoradoLists, expectedBrainrot = null) {
    console.log(`🔄 hybridParse: ${offers.length} offers${expectedBrainrot ? ` for "${expectedBrainrot}"` : ''}`);
    
    // Шаг 1: Быстрый Regex парсинг для ВСЕХ офферов
    const regexResults = offers.map((offer, i) => {
        const title = offer.title || offer.offerTitle || '';
        const regex = parseIncomeRegex(title);
        return {
            index: i,
            offer,
            regex,
            // AI нужен для ВСЕХ - чтобы валидировать regex результат
            needsAI: true
        };
    });
    
    console.log(`   Regex: ${regexResults.filter(r => r.regex.income !== null).length}/${offers.length} parsed`);
    
    // Шаг 2: AI парсинг с ГЛОБАЛЬНЫМ rate limiter
    const offersForAI = regexResults.map(r => ({ ...r.offer, originalIndex: r.index }));
    const batches = createTokenAwareBatches(offersForAI, 2000);
    
    console.log(`   AI: ${batches.length} batches (sequential with global rate limit)`);
    
    const aiResultsMap = new Map();
    
    // v2.5.0: Последовательная обработка батчей с глобальным rate limiter
    // v9.11.5: Добавлена логика ожидания вместо пропуска AI
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const estimatedTokens = batch.estimatedTokens || (BASE_PROMPT_TOKENS + batch.offers.length * TOKENS_PER_OFFER);
        
        // Проверяем глобальный rate limit перед каждым батчем
        let rateCheck = await checkGlobalRateLimit(estimatedTokens);
        
        if (!rateCheck.allowed) {
            const waitSec = Math.round(rateCheck.waitMs/1000);
            console.log(`   ⏳ Global rate limit (${rateCheck.reason}): ${rateCheck.currentTokens}/${rateCheck.limit} tokens, waiting ${waitSec}s...`);
            
            // v9.11.5: Если ожидание меньше 8 секунд - подождём и попробуем снова
            if (rateCheck.waitMs <= 8000) {
                console.log(`   ⏳ Waiting ${waitSec}s for rate limit to reset...`);
                await new Promise(r => setTimeout(r, rateCheck.waitMs + 500));
                
                // Проверяем ещё раз после ожидания
                rateCheck = await checkGlobalRateLimit(estimatedTokens);
                if (!rateCheck.allowed) {
                    console.log(`   ⚠️ Still rate limited after wait, skipping AI`);
                    break;
                }
                console.log(`   ✅ Rate limit cleared, proceeding with AI`);
            } else {
                // Если ждать нужно больше 8 секунд - пропускаем AI
                console.log(`   ⚠️ Wait too long (${waitSec}s), skipping AI for this request`);
                break;
            }
        }
        
        try {
            console.log(`   Batch ${batchIndex + 1}/${batches.length}: ${batch.offers.length} offers (~${estimatedTokens} tokens)`);
            
            // v9.10.15: Передаём expectedBrainrot в AI парсер
            const aiResults = await parseIncomeAI(batch.offers, eldoradoLists, expectedBrainrot);
            
            // Записываем использование в глобальный rate limiter
            await recordAIUsage(estimatedTokens, 'hybridParse');
            
            // Сопоставляем результаты с оригинальными индексами
            for (let j = 0; j < aiResults.length; j++) {
                const ai = aiResults[j];
                const offer = batch.offers[ai.i - 1]; // ai.i is 1-based
                if (offer && offer.originalIndex !== undefined) {
                    aiResultsMap.set(offer.originalIndex, {
                        income: ai.m,
                        reason: ai.r,
                        foundBrainrot: ai.b || null, // v9.10.15: AI-детектированный брейнрот
                        source: 'ai'
                    });
                }
            }
            
            // Небольшая пауза между батчами (2 сек)
            if (batchIndex < batches.length - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
            
        } catch (e) {
            console.error(`   Batch ${batchIndex} error:`, e.message);
            // При ошибке - помечаем как failed, будет использован regex
            for (const offer of batch.offers) {
                if (offer.originalIndex !== undefined) {
                    aiResultsMap.set(offer.originalIndex, {
                        income: null,
                        reason: 'ai_error',
                        source: 'ai_failed',
                        error: e.message
                    });
                }
            }
            
            // Если ошибка quota - прерываем обработку
            if (e.message?.includes('quota') || e.message?.includes('exceeded')) {
                console.log(`   ⛔ Quota exceeded, stopping AI processing`);
                break;
            }
        }
    }
    
    // Шаг 3: Объединяем результаты - AI ПРИОРИТЕТ
    const finalResults = regexResults.map(r => {
        const ai = aiResultsMap.get(r.index);
        
        // v9.10.15: Проверка wrong_brainrot от AI
        if (ai && ai.foundBrainrot && expectedBrainrot) {
            const expectedLower = expectedBrainrot.toLowerCase();
            const foundLower = (ai.foundBrainrot || '').toLowerCase();
            
            // Если AI нашёл ДРУГОЙ брейнрот - помечаем как wrong_brainrot
            if (foundLower !== 'unknown' && foundLower !== expectedLower && !expectedLower.includes(foundLower) && !foundLower.includes(expectedLower)) {
                console.log(`   ⚠️ AI detected wrong brainrot: "${r.offer.title?.substring(0, 40)}..." - found: ${ai.foundBrainrot}, expected: ${expectedBrainrot}`);
                return {
                    ...r.offer,
                    income: null,
                    reason: 'wrong_brainrot',
                    foundBrainrot: ai.foundBrainrot,
                    source: 'ai',
                    confidence: 0.9
                };
            }
        }
        
        // Логика по схеме: AI приоритет если нашёл значение
        if (ai && ai.income !== null && ai.source === 'ai') {
            // AI нашёл income - используем AI (даже если regex тоже нашёл)
            const regexIncome = r.regex.income;
            const aiIncome = ai.income;
            
            // Логируем если отличается
            if (regexIncome !== null && regexIncome !== aiIncome) {
                console.log(`   📊 Difference: "${r.offer.title?.substring(0, 40)}..." - Regex: ${regexIncome}, AI: ${aiIncome}`);
            }
            
            return {
                ...r.offer,
                income: aiIncome,
                reason: ai.reason,
                foundBrainrot: ai.foundBrainrot, // v9.10.15: AI-детектированный брейнрот
                source: 'ai',
                regexIncome: regexIncome, // сохраняем для сравнения
                confidence: 0.95
            };
        } else if (ai && ai.source === 'ai_failed') {
            // AI упал - используем regex как fallback
            return {
                ...r.offer,
                income: r.regex.income,
                reason: r.regex.reason,
                source: 'regex',
                aiError: ai.error,
                confidence: 0.7
            };
        } else if (r.regex.income !== null) {
            // AI не нашёл, но Regex нашёл - используем Regex
            return {
                ...r.offer,
                income: r.regex.income,
                reason: r.regex.reason,
                source: 'regex',
                confidence: 0.85
            };
        } else {
            // Никто не нашёл
            return {
                ...r.offer,
                income: null,
                reason: ai?.reason || r.regex.reason || 'no_pattern',
                source: ai ? 'ai' : 'regex',
                confidence: 0.5
            };
        }
    });
    
    // Статистика
    const aiCount = finalResults.filter(r => r.source === 'ai').length;
    const regexCount = finalResults.filter(r => r.source === 'regex').length;
    const nullCount = finalResults.filter(r => r.income === null).length;
    console.log(`   Final: AI=${aiCount}, Regex=${regexCount}, Null=${nullCount}`);
    
    return finalResults;
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
module.exports.updateEldoradoLists = updateEldoradoLists;
module.exports.stripEmojis = stripEmojis;
module.exports.findUpperLower = findUpperLower;
