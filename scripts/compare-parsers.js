/**
 * Сравнение Regex и AI парсеров на реальных данных
 * Проверяем правильность определения upper/lower офферов
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Глобальный error handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('\n❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('\n❌ Uncaught Exception:', error.message);
    console.error(error.stack);
});

// Gemma-3-27b лимиты: 20 RPM, 15K TPM
// ДИНАМИЧЕСКИЙ расчёт токенов для оптимальной загрузки
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemma-3-27b-it';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Eldorado API
const ELDORADO_GAME_ID = '259';

// Лимиты API
const MAX_TOKENS_PER_MINUTE = 14000;  // 14K безопасный лимит (из 15K)
const MAX_REQUESTS_PER_MINUTE = 7;    // 7 батчей за волну (меньше офферов = стабильный JSON)

// Базовый промпт (без офферов) - подсчитываем токены один раз
const BASE_PROMPT_TOKENS = 1200;  // Примерно 1200 токенов в базовом промпте
const TOKENS_PER_OFFER = 25;       // ~25 токенов на оффер (title ~60 символов / 4 + overhead)

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Оценивает количество токенов в тексте
 * Примерно 1 токен = 4 символа для английского текста
 */
function estimateTokens(text) {
    if (!text) return 0;
    // Для более точного подсчёта учитываем:
    // - Обычный текст: ~4 символа = 1 токен
    // - Числа и знаки: ~2 символа = 1 токен
    const baseTokens = Math.ceil(text.length / 4);
    // Добавляем ~20% за разделители и спец.символы
    return Math.ceil(baseTokens * 1.2);
}

/**
 * Рассчитывает токены для батча офферов
 */
function calculateBatchTokens(offers) {
    // Суммируем токены всех заголовков
    let titleTokens = 0;
    for (const offer of offers) {
        titleTokens += estimateTokens(offer.title || '');
    }
    // Добавляем: базовый промпт + нумерация + JSON структура
    const overhead = offers.length * 5; // "1. " и переносы строк
    return BASE_PROMPT_TOKENS + titleTokens + overhead;
}

let activeAIRequests = 0;
const aiRequestQueue = [];

// Вспомогательная функция для задержки
const delay = ms => new Promise(r => setTimeout(r, ms));

// Динамический размер батча - будет вычисляться на основе токенов
const DEFAULT_BATCH_SIZE = 30;  // Начальный размер батча для разбиения

/**
 * Разбивает офферы на батчи с учётом токенов
 * Каждый батч не должен превышать maxTokens
 */
function createTokenAwareBatches(offers, brainrotName, maxTokensPerBatch = 2000) {
    const batches = [];
    let currentBatch = [];
    let currentTokens = BASE_PROMPT_TOKENS;  // Начинаем с токенов базового промпта
    
    for (let i = 0; i < offers.length; i++) {
        const offer = offers[i];
        const offerTokens = estimateTokens(offer.title || '') + 5; // +5 за нумерацию
        
        // Если добавление оффера превысит лимит - создаём новый батч
        if (currentBatch.length > 0 && currentTokens + offerTokens > maxTokensPerBatch) {
            batches.push({
                brainrot: brainrotName,
                startIndex: i - currentBatch.length,
                offers: currentBatch,
                estimatedTokens: currentTokens
            });
            currentBatch = [];
            currentTokens = BASE_PROMPT_TOKENS;
        }
        
        currentBatch.push(offer);
        currentTokens += offerTokens;
    }
    
    // Добавляем последний батч
    if (currentBatch.length > 0) {
        batches.push({
            brainrot: brainrotName,
            startIndex: offers.length - currentBatch.length,
            offers: currentBatch,
            estimatedTokens: currentTokens
        });
    }
    
    return batches;
}

/**
 * Группирует батчи в волны так, чтобы сумма токенов ≤ maxTokens
 * и количество запросов ≤ maxRequests
 */
function createWaves(batches, maxTokens = MAX_TOKENS_PER_MINUTE, maxRequests = MAX_REQUESTS_PER_MINUTE) {
    const waves = [];
    let currentWave = [];
    let currentTokens = 0;
    
    for (const batch of batches) {
        const batchTokens = batch.estimatedTokens || calculateBatchTokens(batch.offers);
        
        // Если добавление батча превысит лимит токенов или запросов - создаём новую волну
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
    
    // Добавляем последнюю волну
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
 * Ставит AI запрос в очередь с лимитом параллельных запросов и retry
 */
async function queueAIRequest(fn, retries = 3) {
    return new Promise((resolve, reject) => {
        const execute = async () => {
            activeAIRequests++;
            let lastError;
            
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    // Задержка между батчами
                    if (attempt > 0 || aiRequestQueue.length > 0) {
                        await delay(DELAY_BETWEEN_BATCHES * (attempt + 1));
                    }
                    
                    const result = await fn();
                    resolve(result);
                    return;
                } catch (e) {
                    lastError = e;
                    // Если rate limit - ждём дольше
                    if (e.message && e.message.includes('quota')) {
                        console.log(`\n   ⏳ Rate limit, waiting ${(attempt + 1) * 30}s...`);
                        await delay((attempt + 1) * 30000);
                    } else {
                        // Другая ошибка - короткая пауза
                        await delay(2000);
                    }
                }
            }
            
            reject(lastError);
        };

        const executeWithCleanup = async () => {
            try {
                await execute();
            } finally {
                activeAIRequests--;
                processQueue();
            }
        };
        
        if (activeAIRequests < MAX_CONCURRENT_AI) {
            executeWithCleanup();
        } else {
            aiRequestQueue.push(executeWithCleanup);
        }
    });
}

function processQueue() {
    while (aiRequestQueue.length > 0 && activeAIRequests < MAX_CONCURRENT_AI) {
        const next = aiRequestQueue.shift();
        next();
    }
}

/**
 * Возвращает attr_id для M/s диапазона (для фильтрации на Eldorado)
 */
function getMsRangeAttrId(msRange) {
    const mapping = {
        '0-24 M/s': '0-1',
        '25-49 M/s': '0-2',
        '50-99 M/s': '0-3',
        '100-249 M/s': '0-4',
        '250-499 M/s': '0-5',
        '500-749 M/s': '0-6',
        '750-999 M/s': '0-7',
        '1+ B/s': '0-8'
    };
    return mapping[msRange] || null;
}

/**
 * Загружает одну страницу офферов с Eldorado
 */
function fetchEldoradoPage(brainrotName, pageIndex, pageSize, msRange) {
    return new Promise((resolve) => {
        const params = new URLSearchParams({
            gameId: ELDORADO_GAME_ID,
            category: 'CustomItem',
            tradeEnvironmentValue0: 'Brainrot',
            tradeEnvironmentValue2: brainrotName,
            pageSize: String(pageSize),
            pageIndex: String(pageIndex),
            offerSortingCriterion: 'Price',
            isAscending: 'true'
        });
        
        // Добавляем фильтр по M/s диапазону
        if (msRange) {
            const attrId = getMsRangeAttrId(msRange);
            if (attrId) {
                params.set('offerAttributeIdsCsv', attrId);
            }
        }

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
                    
                    const offers = results.map(r => ({
                        title: r.offer?.offerTitle || '',
                        price: r.offer?.pricePerUnitInUSD?.amount || 0,
                        seller: r.user?.username || 'unknown',
                        msRangeAttr: r.offer?.offerAttributeIdValues?.find(a => a.name === 'M/s')?.value || ''
                    })).filter(o => o.title && o.price > 0);
                    
                    resolve({ 
                        offers, 
                        totalCount: parsed.recordCount || 0,
                        totalPages: parsed.totalPages || 0
                    });
                } catch (e) {
                    resolve({ offers: [], totalCount: 0, totalPages: 0, error: e.message });
                }
            });
        });

        req.on('error', (e) => resolve({ offers: [], totalCount: 0, totalPages: 0, error: e.message }));
        req.setTimeout(15000, () => {
            req.destroy();
            resolve({ offers: [], totalCount: 0, totalPages: 0, error: 'timeout' });
        });
        req.end();
    });
}

/**
 * Загружает ВСЕ офферы с Eldorado для брейнрота в указанном M/s диапазоне
 * Использует пагинацию для загрузки всех страниц
 */
async function fetchAllEldoradoOffers(brainrotName, msRange = null, maxPages = 20) {
    const PAGE_SIZE = 50; // Максимум на Eldorado
    const allOffers = [];
    
    // Загружаем первую страницу чтобы узнать общее количество
    const firstPage = await fetchEldoradoPage(brainrotName, 1, PAGE_SIZE, msRange);
    
    if (firstPage.error) {
        return { brainrot: brainrotName, offers: [], total: 0, msRange, error: firstPage.error };
    }
    
    allOffers.push(...firstPage.offers);
    
    const totalPages = Math.min(firstPage.totalPages || 1, maxPages);
    const totalCount = firstPage.totalCount || 0;
    
    // Загружаем остальные страницы
    for (let page = 2; page <= totalPages; page++) {
        await sleep(100); // Небольшая задержка между запросами
        
        const pageData = await fetchEldoradoPage(brainrotName, page, PAGE_SIZE, msRange);
        if (pageData.offers.length > 0) {
            allOffers.push(...pageData.offers);
        }
        
        // Прогресс
        process.stdout.write(`\r   Loading page ${page}/${totalPages}...`);
    }
    
    if (totalPages > 1) {
        process.stdout.write('\r' + ' '.repeat(40) + '\r'); // Очистка строки прогресса
    }
    
    return { 
        brainrot: brainrotName, 
        offers: allOffers, 
        total: totalCount, 
        msRange,
        pagesLoaded: totalPages
    };
}

/**
 * REGEX парсер (УЛУЧШЕННАЯ версия)
 * @param {string} title - заголовок оффера
 * @param {string} expectedBrainrot - название брейнрота, который ищем (для проверки wrong_brainrot)
 */
function parseIncomeRegex(title, expectedBrainrot = null) {
    if (!title) return { income: null, reason: 'empty' };
    
    // Нормализуем текст
    const normalized = title
        .replace(/,/g, '.')           // Запятая -> точка (европейский формат)
        .replace(/\s+/g, ' ')         // Множественные пробелы -> один
        .replace(/\s*\.\s*/g, '.')    // Убираем пробелы вокруг точек "18 .5" -> "18.5"
        .trim();
    
    const titleLower = normalized.toLowerCase();
    
    // Мутации - НЕ брейнроты! (из Eldorado dropdown)
    const MUTATIONS = ['none', 'gold', 'diamond', 'bloodrot', 'candy', 'lava', 'galaxy', 'yin-yang', 'radioactive', 'rainbow'];
    
    // Рарити - НЕ брейнроты! (из Eldorado dropdown)
    const RARITIES = ['common', 'rare', 'festive', 'epic', 'legendary', 'mythical', 'brainrot god', 'secret', 'og', 'admin', 'taco'];
    
    // ПОЛНЫЙ список брейнротов из Eldorado dropdown (136 шт, декабрь 2025)
    const KNOWN_BRAINROTS = [
        // Lucky Blocks (исключаем из wrong_brainrot проверки - слишком общие)
        'festive lucky block', 'brainrot god lucky block', 'secret lucky block', 
        'admin lucky block', 'los lucky block', 'taco lucky block',
        // A-B
        'agarrini la palini', 'alessio', 'ballerino lololo', 'bisonte giuppitere',
        'blackhole goat', 'boatito auratito', 'bombardini tortini', 'bombardiro crocodilo',
        'bombombini gusini', 'buho de noelo', 'bulbito bandito traktorito', 
        'burguro and fryuro', 'burrito bandito',
        // C
        'capitano moby', 'chicleteira bicicleteira', 'chicleteira noelteira', 
        'chillin chili', 'chimino', 'chimpanzini spiderini', 'chipso and queso',
        'chrismasmamat', 'cocoa assassino', 'cocofanto elefanto', 'cooki and milki',
        'cuadramat and pakrahmatmamat',
        // D-E
        'dragon cannelloni', 'dul dul dul', 'esok sekolah', 'espresso signora',
        'eviledon', 'extinct matteo',
        // F-G
        'festive 67', 'fishino clownino', 'fragrama and chocrama', 'frigo camelo',
        'garama and madundung', 'gingerat gerat', 'girafa celestre', 'gobblino uniciclino',
        'graipuss medussi', 'guerriro digitale', 'guest 666',
        // H-K
        'ho ho ho sahur', 'job job job sahur', 'karkerkar kurkur', 
        'ketchuru and musturu', 'ketupat kepat',
        // L (La/Las/Los/List)
        'la casa boo', 'la extinct grande', 'la ginger sekolah', 'la grande combinasion',
        'la jolly grande', 'la karkerkar combinasion', 'la sahur combinasion', 
        'la secret combinasion', 'la spooky grande', 'la supreme combinasion',
        'la vacca prese presente', 'la vacca saturno saturnita',
        'las sis', 'las tralaleritas', 'las vaquitas saturnitas',
        'lavadorito spinito', 'list list list sahur',
        'los 25', 'los 67', 'los bombinitos', 'los bros', 'los candies',
        'los chicleteiras', 'los combinasionas', 'los crocodillitos', 
        'los hotspotsitos', 'los matteos', 'los mobilis', 'los orcalitos',
        'los planitos', 'los primos', 'los puggies', 'los spaghettis',
        'los spyderinis', 'los tacoritas', 'los tralaleritos', 'los tungtungtungcitos',
        // M-N
        'mariachi corazoni', 'matteo', 'meowl', 'mieteteira bicicleteira',
        'money money puggy', 'naughty naughty', 'noo my present', 'nooo my hotspot',
        'nuclearo dinossauro',
        // O-P
        'odin din din dun', 'orangutini ananassini', 'orcaledon', 'orcalero orcala',
        'pakrahmatmamat', 'pandanini frostini', 'piccione macchina', 
        'pirulitoita bicicletera', 'pot hotspot',
        // R-S
        'reinito sleighito', 'sammyni spyderini', 'santa hotspot', 
        'spaghetti tualetti', 'spooky and pumpky', 'statutino libertino',
        'strawberry elephant', 'swag soda',
        // T
        'tacorita bicicleta', 'tang tang keletang', 'tartaruga cisterna',
        'te te te sahur', 'tictac sahur', 'tigroligre frutonni', 'tipi topi taco',
        'to to to sahur', 'torrtuginni dragonfrutini', 'tralaledon', 
        'tralalero tralala', 'tralalita tralala', 'trenostruzzo turbo 3000',
        'triplito tralaleritos', 'trippi troppi troppa trippa',
        // U-W
        'urubini flamenguini', 'w or l',
        // Numbers
        '1x1x1x1', '67'
    ];
    
    // Проверка на wrong_brainrot - если в title написан ДРУГОЙ брейнрот
    if (expectedBrainrot) {
        const expectedLower = expectedBrainrot.toLowerCase();
        // Извлекаем ключевые слова из ожидаемого брейнрота (слова > 3 букв)
        const expectedKeywords = expectedLower.split(' ').filter(word => word.length > 2);
        
        const titleContainsExpected = titleLower.includes(expectedLower) ||
            // Проверяем частичные совпадения (например "planitos" для "Los Planitos")
            expectedKeywords.some(word => titleLower.includes(word));
        
        if (!titleContainsExpected) {
            // Title не содержит ожидаемый брейнрот - проверяем, есть ли там другой
            for (const knownBrainrot of KNOWN_BRAINROTS) {
                // Пропускаем если это тот же брейнрот или его часть
                if (knownBrainrot === expectedLower || 
                    expectedLower.includes(knownBrainrot) || 
                    knownBrainrot.includes(expectedLower)) {
                    continue;
                }
                
                // Пропускаем короткие названия (могут быть частью слов)
                if (knownBrainrot.length < 5) continue;
                
                if (titleLower.includes(knownBrainrot)) {
                    // Убедимся что это не мутация или рарити
                    if (!MUTATIONS.includes(knownBrainrot) && !RARITIES.includes(knownBrainrot)) {
                        return { income: null, reason: 'wrong_brainrot', found: knownBrainrot };
                    }
                }
            }
        }
    }
    
    // Проверка на диапазоны (10m/s - 13m/s, 150m~500m/s, etc.)
    const rangePatterns = [
        /(\d+)\s*[mMkKbB]\/?[sS]?\s*[-~–—]\s*(\d+)\s*[mMkKbB]\/?[sS]?/i, // 10m/s - 13m/s
        /(\d+)\s*[-~–—]\s*(\d+)\s*[mMkKbB]\/?[sS]/i,                      // 10-13m/s
    ];
    
    for (const pattern of rangePatterns) {
        if (pattern.test(normalized)) {
            return { income: null, reason: 'range' };
        }
    }
    
    // Проверка на рандомные офферы
    if (/spin\s*(the)?\s*wheel|random|mystery|lucky/i.test(normalized)) {
        return { income: null, reason: 'random' };
    }
    
    // M/s паттерны (приоритет - более точные сначала)
    const mPatterns = [
        /\$?([\d.]+)\s*M\s*\/\s*[1]?\s*[sS]/i,    // $135M/s, 135 M / s, 30M/1S
        /\$?([\d.]+)\s*[mM]\/[sS](?:ec)?/i,       // 135m/s, 135m/sec
        /\$?([\d.]+)\s*mil\/s/i,                   // 135mil/s
        /\$?([\d.]+)\s*mil\b/i,                    // 18.5 mil
        /\$?([\d.]+)\s*[mM]\b(?!\w)/,              // 125m (в конце, без других букв после)
    ];

    for (const pattern of mPatterns) {
        const match = normalized.match(pattern);
        if (match) {
            const value = parseFloat(match[1]);
            if (!isNaN(value) && value >= 1 && value <= 99999) {
                return { income: value, reason: null };
            }
        }
    }
    
    // K/s паттерны (тысячи = 0.XXX M/s)
    const kPatterns = [
        /\$?([\d.]+)\s*[kK]\s*\/\s*[sS]/i,        // 531.2K/s
        /\$?([\d.]+)\s*[kK]\b(?!\w)/,              // 500k (в конце)
    ];
    
    for (const pattern of kPatterns) {
        const match = normalized.match(pattern);
        if (match) {
            const value = parseFloat(match[1]);
            const mValue = value / 1000; // Конвертируем в M/s
            if (!isNaN(mValue) && mValue >= 0.001 && mValue <= 999) {
                return { income: mValue, reason: null };
            }
        }
    }
    
    // B/s паттерны (миллиарды)
    const bPatterns = [
        /\$?([\d.]+)\s*[bB]\s*\/\s*[sS]/i,        // 1.5B/s
        /\$?([\d.]+)\s*bil\/s/i,                   // 1.5bil/s
    ];
    
    for (const pattern of bPatterns) {
        const match = normalized.match(pattern);
        if (match) {
            const value = parseFloat(match[1]);
            const msValue = value * 1000; // B -> M
            if (!isNaN(msValue) && msValue >= 1000 && msValue <= 999999) {
                return { income: msValue, reason: null };
            }
        }
    }
    
    return { income: null, reason: 'no_pattern' };
}

/**
 * Убирает все emoji из строки (включая emoji-цифры)
 */
function stripEmojis(str) {
    // Убираем emoji-цифры и другие emoji
    return str
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')  // Emoticons
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')  // Misc Symbols and Pictographs
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')  // Transport and Map
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')  // Flags
        .replace(/[\u{2600}-\u{26FF}]/gu, '')    // Misc symbols
        .replace(/[\u{2700}-\u{27BF}]/gu, '')    // Dingbats
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')    // Variation Selectors
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')  // Supplemental Symbols
        .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')  // Chess Symbols
        .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')  // Symbols and Pictographs Extended-A
        .replace(/[\u{231A}\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}]/gu, '') // Watch, hourglass
        .replace(/[\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}]/gu, '') // Geometric
        .replace(/[\u{2614}\u{2615}]/gu, '')     // Umbrella, coffee
        .replace(/[\u{2648}-\u{2653}]/gu, '')    // Zodiac
        .replace(/[\u{267F}]/gu, '')             // Wheelchair
        .replace(/[\u{2693}]/gu, '')             // Anchor
        .replace(/[\u{26A1}]/gu, '')             // Lightning
        .replace(/[\u{26AA}\u{26AB}]/gu, '')     // Circles
        .replace(/[\u{26BD}\u{26BE}]/gu, '')     // Soccer, baseball
        .replace(/[\u{26C4}\u{26C5}]/gu, '')     // Snowman, sun
        .replace(/[\u{26CE}]/gu, '')             // Ophiuchus
        .replace(/[\u{26D4}]/gu, '')             // No entry
        .replace(/[\u{26EA}]/gu, '')             // Church
        .replace(/[\u{26F2}\u{26F3}]/gu, '')     // Fountain, golf
        .replace(/[\u{26F5}]/gu, '')             // Sailboat
        .replace(/[\u{26FA}]/gu, '')             // Tent
        .replace(/[\u{26FD}]/gu, '')             // Fuel pump
        .replace(/[\u{2702}]/gu, '')             // Scissors
        .replace(/[\u{2705}]/gu, '')             // Check mark
        .replace(/[\u{2708}-\u{270D}]/gu, '')    // Airplane to writing hand
        .replace(/[\u{270F}]/gu, '')             // Pencil
        .replace(/[\u{2712}]/gu, '')             // Black nib
        .replace(/[\u{2714}]/gu, '')             // Check mark
        .replace(/[\u{2716}]/gu, '')             // X mark
        .replace(/[\u{271D}]/gu, '')             // Latin cross
        .replace(/[\u{2721}]/gu, '')             // Star of David
        .replace(/[\u{2728}]/gu, '')             // Sparkles
        .replace(/[\u{2733}\u{2734}]/gu, '')     // Eight spoked asterisk
        .replace(/[\u{2744}]/gu, '')             // Snowflake
        .replace(/[\u{2747}]/gu, '')             // Sparkle
        .replace(/[\u{274C}]/gu, '')             // Cross mark
        .replace(/[\u{274E}]/gu, '')             // Cross mark
        .replace(/[\u{2753}-\u{2755}]/gu, '')    // Question marks
        .replace(/[\u{2757}]/gu, '')             // Exclamation mark
        .replace(/[\u{2763}\u{2764}]/gu, '')     // Heart
        .replace(/[\u{2795}-\u{2797}]/gu, '')    // Math symbols
        .replace(/[\u{27A1}]/gu, '')             // Arrow
        .replace(/[\u{27B0}]/gu, '')             // Curly loop
        .replace(/[\u{27BF}]/gu, '')             // Double curly loop
        .replace(/[\u{2934}\u{2935}]/gu, '')     // Arrows
        .replace(/[\u{2B05}-\u{2B07}]/gu, '')    // Arrows
        .replace(/[\u{2B1B}\u{2B1C}]/gu, '')     // Squares
        .replace(/[\u{2B50}]/gu, '')             // Star
        .replace(/[\u{2B55}]/gu, '')             // Circle
        .replace(/[\u{3030}]/gu, '')             // Wavy dash
        .replace(/[\u{303D}]/gu, '')             // Part alternation mark
        .replace(/[\u{3297}]/gu, '')             // Circled Ideograph Congratulation
        .replace(/[\u{3299}]/gu, '')             // Circled Ideograph Secret
        .replace(/[\u{20E3}]/gu, '')             // Combining Enclosing Keycap
        .replace(/[0-9]\uFE0F?\u20E3/gu, '')     // Keycap digits (0️⃣-9️⃣)
        .replace(/[#*]\uFE0F?\u20E3/gu, '')      // Keycap # and *
        .replace(/\s+/g, ' ')                     // Multiple spaces to single
        .trim();
}

/**
 * AI парсер (Gemini) - SMART версия
 */
async function parseIncomeAI(offers, brainrotName) {
    // Убираем emoji из titles перед отправкой в AI
    const cleanedOffers = offers.map(o => ({
        ...o,
        cleanTitle: stripEmojis(o.title)
    }));
    
    const prompt = `TASK: Extract income values from Roblox "Steal a Brainrot" marketplace titles.

OFFERS:
${cleanedOffers.map((o, i) => `${i + 1}. "${o.cleanTitle}"`).join('\n')}

EXTRACT for each offer:
- "m" (income): Income in M/s (millions/second), or null
- "r" (reason): If m=null: "range", "random", or "no_value"

INCOME FORMATS - ALWAYS EXTRACT THE NUMBER:
- "135M/s", "135m/s", "135 M/s" → 135
- "270M/s Los 67" → 270 (number BEFORE brainrot name!)
- "350 m", "350m", "350M" → 350 (number + m/M = millions)
- "125m/s" anywhere in text → 125
- "18,5M/s", "18.5 mil" → 18.5 (comma = decimal point)
- "531K/s" → 0.531 (K=thousands, divide by 1000)
- "1.5B/s" → 1500 (B=billions, multiply by 1000)
- "300M DIAMOND" → 300 (DIAMOND is mutation, ignore it!)

CRITICAL: Look for ANY number followed by M, m, M/s, m/s, mil, K/s, B/s
Even if it appears at START, MIDDLE or END of title - EXTRACT IT!

RANGE/RANDOM = null (NOT a single value!):
- "0-24M/s", "10m-13m/s", "100->150m/s" → null, r="range"  
- "10~50M/s", "50-100m" → null, r="range"
- "Random", "random ms", "spin wheel" → null, r="random"
- "50M+" with no exact value → null, r="range"

IGNORE (these are NOT income):
- Prices: "$4.50", "4$", "only 7$", "$34.00"
- Traits count: "2 traits", "3 mutations"
- Percentages: "-14.3%"

EXAMPLES:
1. "270M/s Los 67 Fast Delivery" → {"i":1,"m":270}
2. "Las sis diamond 350 m and RARE" → {"i":2,"m":350}
3. "125m/s LA SECRET VERY RARE" → {"i":3,"m":125}
4. "La Jolly Grande 100->150m/s" → {"i":4,"m":null,"r":"range"}
5. "Eviledon 300M DIAMOND" → {"i":5,"m":300}
6. "150M/s $4.5 La Jolly Grande" → {"i":6,"m":150}
7. "Los Mobilis 0-24M/s" → {"i":7,"m":null,"r":"range"}
8. "RANDOM MS offer" → {"i":8,"m":null,"r":"random"}
9. "Gold Los 67 270m/s" → {"i":9,"m":270}
10. "547.5M/s Gold Esok Sekolah" → {"i":10,"m":547.5}

OUTPUT STRICT JSON (no markdown):
{"results":[{"i":1,"m":350},{"i":2,"m":null,"r":"range"}]}`;

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
 * Находит upper и lower офферы
 * Upper: income >= target, минимальная цена
 * Lower: income < target, дешевле upper, ближайший к target
 */
function findUpperLower(offers, targetIncome) {
    let upper = null;  // income >= target, минимальная цена
    
    // Сначала ищем upper
    for (const offer of offers) {
        if (offer.income === null) continue;
        
        if (offer.income >= targetIncome) {
            if (!upper || offer.price < upper.price) {
                upper = offer;
            }
        }
    }
    
    // Lower должен быть: income < target И цена < upper.price (если upper найден)
    // Ищем ближайший к target по income
    let lower = null;
    const maxPrice = upper ? upper.price : Infinity;
    
    for (const offer of offers) {
        if (offer.income === null) continue;
        
        if (offer.income < targetIncome && offer.price < maxPrice) {
            // Выбираем ближайший к target (максимальный income из тех что < target)
            if (!lower || offer.income > lower.income) {
                lower = offer;
            } else if (offer.income === lower.income && offer.price < lower.price) {
                // При равном income выбираем дешевле
                lower = offer;
            }
        }
    }
    
    return { upper, lower };
}

/**
 * Парсит один батч офферов через AI (простой последовательный вызов)
 */
async function parseAIBatch(batchOffers, brainrotName, batchId) {
    const aiData = await parseIncomeAI(batchOffers, brainrotName);
    const expectedLower = brainrotName.toLowerCase();
    
    // Мутации и рарити - НЕ брейнроты!
    const MUTATIONS = ['none', 'gold', 'diamond', 'bloodrot', 'candy', 'lava', 'galaxy', 'yin-yang', 'radioactive', 'rainbow'];
    const RARITIES = ['common', 'rare', 'festive', 'epic', 'legendary', 'mythical', 'brainrot god', 'secret', 'og', 'admin', 'taco', 'normal'];
    const IGNORE_WORDS = [...MUTATIONS, ...RARITIES, 'fast', 'delivery', 'cheap', 'instant', 'store', 'best', 'price'];
    
    return aiData.map((r) => {
        let income = r.m;
        let reason = r.r || null;
        
        if (r.b && r.b !== 'unknown') {
            const foundBrainrot = r.b.toLowerCase();
            
            if (IGNORE_WORDS.some(w => foundBrainrot === w || foundBrainrot.includes(w))) {
                // AI перепутал мутацию/рарити за брейнрот - игнорим
            } else {
                const expectedKeywords = expectedLower.split(' ').filter(w => w.length > 2);
                const foundKeywords = foundBrainrot.split(' ').filter(w => w.length > 2);
                
                const isMatch = expectedLower.includes(foundBrainrot) || 
                               foundBrainrot.includes(expectedLower) ||
                               expectedKeywords.some(w => foundBrainrot.includes(w)) ||
                               foundKeywords.some(w => expectedLower.includes(w));
                
                if (!isMatch) {
                    income = null;
                    reason = 'wrong_brainrot';
                }
            }
        }
        
        return {
            localIndex: r.i,
            price: r.p || batchOffers[r.i - 1]?.price,
            income,
            reason,
            foundBrainrot: r.b,
            batchId
        };
    });
}

/**
 * Загружает и обрабатывает все офферы для одного брейнрота
 * Возвращает объект с офферами, регекс результатами и батчами для AI
 */
async function loadBrainrotData(brainrotName, expectedIncome) {
    const msRange = getMsRange(expectedIncome);
    
    // Загружаем офферы
    const data = await fetchAllEldoradoOffers(brainrotName, msRange);
    
    if (data.offers.length === 0) {
        return { brainrot: brainrotName, expectedIncome, msRange, offers: [], regexResults: [], aiBatches: [] };
    }
    
    // Парсим Regex сразу
    const regexResults = data.offers.map((offer, i) => {
        const result = parseIncomeRegex(offer.title, brainrotName);
        return {
            index: i,
            price: offer.price,
            income: result.income,
            reason: result.reason
        };
    });
    
    // Разбиваем на батчи для AI с учётом токенов (динамически!)
    // Каждый батч ≤ 2000 токенов для стабильного JSON ответа
    const aiBatches = createTokenAwareBatches(data.offers, brainrotName, 2000);
    
    return {
        brainrot: brainrotName,
        expectedIncome,
        msRange,
        offers: data.offers,
        total: data.total,
        regexResults,
        aiBatches
    };
}

/**
 * Обрабатывает результаты для одного брейнрота и выводит сравнение
 */
function processResults(brainrotData, aiResults) {
    const { brainrot, expectedIncome, msRange, offers, regexResults } = brainrotData;
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📦 ${brainrot} (${expectedIncome}M/s) [${msRange}]`);
    console.log('='.repeat(70));
    console.log(`📋 Total offers: ${offers.length}`);
    
    if (offers.length === 0) {
        console.log('❌ No offers found');
        return null;
    }
    
    // Выводим первые 15 офферов для примера
    const displayCount = Math.min(15, offers.length);
    
    console.log('');
    console.log('┌─────┬────────┬──────────────────────────────────────────────────────────┬──────────────┬──────────────┐');
    console.log('│ #   │ Price  │ Title                                                    │ Regex        │ AI           │');
    console.log('├─────┼────────┼──────────────────────────────────────────────────────────┼──────────────┼──────────────┤');
    
    let matchCount = 0;
    
    for (let i = 0; i < offers.length; i++) {
        const offer = offers[i];
        const regex = regexResults[i];
        const ai = aiResults[i] || { income: null, reason: 'no_data' };
        
        const match = regex.income === ai.income;
        if (match) matchCount++;
        
        if (i < displayCount) {
            const regexStr = regex.income !== null ? `${regex.income}M/s` : `(${regex.reason})`;
            const aiStr = ai.income !== null ? `${ai.income}M/s` : `(${ai.reason || 'null'})`;
            const title = offer.title.substring(0, 56).padEnd(56);
            console.log(`│ ${String(i + 1).padStart(3)} │ $${offer.price.toFixed(2).padStart(5)} │ ${title} │ ${regexStr.padEnd(12)} │ ${aiStr.padEnd(12)} │ ${match ? '✓' : '✗'}`);
        }
    }
    
    if (offers.length > displayCount) {
        console.log(`│ ... │  ...   │ ... (${offers.length - displayCount} more)                                       │     ...      │     ...      │`);
    }
    console.log('└─────┴────────┴──────────────────────────────────────────────────────────┴──────────────┴──────────────┘');
    
    console.log(`\n📊 Parser match: ${matchCount}/${offers.length} (${(matchCount/offers.length*100).toFixed(1)}%)`);
    
    // Upper/Lower
    const regexValidOffers = regexResults.filter(r => r.income !== null);
    const aiValidOffers = aiResults.filter(r => r && r.income !== null);
    
    const regexUL = findUpperLower(regexValidOffers, expectedIncome);
    const aiUL = findUpperLower(aiValidOffers, expectedIncome);
    
    console.log(`\n📊 UPPER/LOWER для target ${expectedIncome}M/s:`);
    console.log(`   (Regex valid: ${regexValidOffers.length}, AI valid: ${aiValidOffers.length})`);
    
    console.log('\n   REGEX:');
    console.log(regexUL.upper ? `   📈 Upper: ${regexUL.upper.income}M/s @ $${regexUL.upper.price.toFixed(2)}` : '   📈 Upper: NOT FOUND');
    console.log(regexUL.lower ? `   📉 Lower: ${regexUL.lower.income}M/s @ $${regexUL.lower.price.toFixed(2)}` : '   📉 Lower: NOT FOUND');
    
    console.log('\n   AI:');
    console.log(aiUL.upper ? `   📈 Upper: ${aiUL.upper.income}M/s @ $${aiUL.upper.price.toFixed(2)}` : '   📈 Upper: NOT FOUND');
    console.log(aiUL.lower ? `   📉 Lower: ${aiUL.lower.income}M/s @ $${aiUL.lower.price.toFixed(2)}` : '   📉 Lower: NOT FOUND');
    
    const upperMatch = regexUL.upper?.income === aiUL.upper?.income && regexUL.upper?.price === aiUL.upper?.price;
    const lowerMatch = regexUL.lower?.income === aiUL.lower?.income && regexUL.lower?.price === aiUL.lower?.price;
    
    console.log(`\n   Upper: ${upperMatch ? '✅' : '❌'} | Lower: ${lowerMatch ? '✅' : '❌'}`);
    
    return {
        brainrot,
        expectedIncome,
        offersCount: offers.length,
        regex: { valid: regexValidOffers.length, upper: regexUL.upper, lower: regexUL.lower },
        ai: { valid: aiValidOffers.length, upper: aiUL.upper, lower: aiUL.lower },
        upperMatch,
        lowerMatch
    };
}

/**
 * Определяет M/s диапазон Eldorado для income
 */
function getMsRange(income) {
    if (income >= 1000) return '1+ B/s';
    if (income >= 750) return '750-999 M/s';
    if (income >= 500) return '500-749 M/s';
    if (income >= 250) return '250-499 M/s';
    if (income >= 100) return '100-249 M/s';
    if (income >= 50) return '50-99 M/s';
    if (income >= 25) return '25-49 M/s';
    if (income > 0) return '0-24 M/s';
    return '0';
}

// УНИКАЛЬНЫЕ брейнроты со скриншота для тестирования (декабрь 2025)
// Каждый брейнрот тестируется в своём диапазоне M/s
const ALL_TEST_BRAINROTS = [
    // 500-749 M/s диапазон
    { name: 'Esok Sekolah', income: 645 },
    { name: 'La Ginger Sekolah', income: 618.7 },
    
    // 250-499 M/s диапазон
    { name: 'Mietateira Bicicleteira', income: 429 },
    { name: 'Tictac Sahur', income: 375 },
    { name: 'Los Mobilis', income: 363 },
    { name: 'Los 67', income: 337.5 },
    { name: 'Eviledon', income: 283.5 },
    { name: 'Las Sis', income: 280 },
    { name: 'Chimnino', income: 266 },
    
    // 100-249 M/s диапазон  
    { name: 'Los Planitos', income: 240.5 },
    { name: 'La Jolly Grande', income: 240 },
    { name: 'Ketupat Kepat', income: 218.7 },
    { name: 'La Taco Combinasion', income: 218.7 },
    { name: 'Chicleteira Noelteira', income: 202.5 },
    { name: 'La Secret Combinasion', income: 187.5 },
    { name: 'Los Burritos', income: 150.8 },
    { name: 'Los Combinasionas', income: 127.5 },
    { name: 'W or L', income: 120 },
    { name: 'La Grande Combinasion', income: 120 },
    
    // 50-99 M/s диапазон
    { name: 'Los Nooo My Hotspotsitos', income: 96.2 },
    { name: 'Los 25', income: 90 },
];

// QUICK TEST - 3 случайных брейнрота для быстрого теста
const shuffled = [...ALL_TEST_BRAINROTS].sort(() => Math.random() - 0.5);
const TEST_BRAINROTS = shuffled.slice(0, 3);

/**
 * ПАРАЛЛЕЛЬНАЯ ОБРАБОТКА ВСЕХ БРЕЙНРОТОВ
 * - Загружает офферы для всех брейнротов
 * - Создаёт единую очередь AI-батчей  
 * - Обрабатывает до 15 батчей одновременно
 */
async function main() {
    console.log('╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║   REGEX vs AI PARSER - Gemma-3-27b (20 RPM, 15K TPM)                       ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝');
    
    const startTime = Date.now();
    
    // 1. Загружаем данные для всех брейнротов параллельно (по 5 за раз - Eldorado rate limit)
    console.log('\n📥 Loading offers for all brainrots...\n');
    
    const brainrotDataArray = [];
    for (let i = 0; i < TEST_BRAINROTS.length; i += 5) {
        const batch = TEST_BRAINROTS.slice(i, i + 5);
        const promises = batch.map(b => loadBrainrotData(b.name, b.income));
        const results = await Promise.all(promises);
        brainrotDataArray.push(...results);
        
        for (const data of results) {
            console.log(`   ✓ ${data.brainrot}: ${data.offers.length} offers (${data.aiBatches.length} AI batches)`);
        }
        
        if (i + 5 < TEST_BRAINROTS.length) {
            await sleep(300);
        }
    }
    
    // 2. Собираем все AI-батчи
    const allAIBatches = [];
    for (const data of brainrotDataArray) {
        for (const batch of data.aiBatches) {
            allAIBatches.push({
                ...batch,
                expectedIncome: data.expectedIncome
            });
        }
    }
    
    // 3. Группируем батчи в волны ДИНАМИЧЕСКИ по токенам!
    const waves = createWaves(allAIBatches, MAX_TOKENS_PER_MINUTE, MAX_REQUESTS_PER_MINUTE);
    
    const totalOffers = brainrotDataArray.reduce((sum, d) => sum + d.offers.length, 0);
    const totalTokens = allAIBatches.reduce((sum, b) => sum + (b.estimatedTokens || 0), 0);
    
    console.log(`\n📊 Total: ${totalOffers} offers, ${allAIBatches.length} AI batches`);
    console.log(`🔢 Total estimated tokens: ${totalTokens} (~${Math.ceil(totalTokens / MAX_TOKENS_PER_MINUTE)} minutes worth)`);
    console.log(`🚀 Strategy: ${waves.length} dynamic waves (grouped by tokens ≤ ${MAX_TOKENS_PER_MINUTE})`);
    
    // Детализация волн
    console.log(`\n📋 Wave breakdown:`);
    for (let i = 0; i < Math.min(waves.length, 10); i++) {
        const w = waves[i];
        console.log(`   Wave ${i+1}: ${w.requestCount} batches, ~${w.totalTokens} tokens`);
    }
    if (waves.length > 10) {
        console.log(`   ... and ${waves.length - 10} more waves`);
    }
    
    console.log(`\n⏱️  Estimated time: ~${waves.length} minutes (1 wave per minute)\n`);
    
    // 4. Обрабатываем ДИНАМИЧЕСКИЕ волны
    const aiResultsByBrainrot = {};
    const retryBatches = [];  // Батчи для повторной обработки (overloaded)
    let processedBatches = 0;
    
    for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
        const waveStart = Date.now();
        const wave = waves[waveIdx];
        const waveBatches = wave.batches;
        
        console.log(`\n🌊 Wave ${waveIdx + 1}/${waves.length} (${waveBatches.length} batches, ~${wave.totalTokens} tokens)...`);
        
        // Запускаем все батчи волны ОДНОВРЕМЕННО
        const wavePromises = waveBatches.map(async (batch, localIdx) => {
            try {
                const results = await parseAIBatch(batch.offers, batch.brainrot, waveIdx * 100 + localIdx);
                
                if (!aiResultsByBrainrot[batch.brainrot]) {
                    aiResultsByBrainrot[batch.brainrot] = [];
                }
                
                for (const r of results) {
                    aiResultsByBrainrot[batch.brainrot].push({
                        ...r,
                        index: batch.startIndex + r.localIndex - 1
                    });
                }
                
                return { success: true, brainrot: batch.brainrot, tokens: batch.estimatedTokens, batch };
            } catch (e) {
                // Возвращаем batch для retry если модель перегружена
                const isOverloaded = e.message && e.message.includes('overloaded');
                return { success: false, error: e.message, brainrot: batch.brainrot, tokens: batch.estimatedTokens, batch, isOverloaded };
            }
        });
        
        // Ждём завершения ВСЕХ батчей волны
        const waveResults = await Promise.all(wavePromises);
        
        const successCount = waveResults.filter(r => r.success).length;
        const failCount = waveResults.filter(r => !r.success).length;
        const usedTokens = waveResults.filter(r => r.success).reduce((s, r) => s + (r.tokens || 0), 0);
        processedBatches += waveBatches.length;
        
        // Собираем батчи для retry (только overloaded ошибки)
        const overloadedBatches = waveResults.filter(r => !r.success && r.isOverloaded).map(r => r.batch);
        retryBatches.push(...overloadedBatches);
        
        const waveTime = Date.now() - waveStart;
        console.log(`   ✅ Wave done in ${(waveTime/1000).toFixed(1)}s (${successCount} ok, ${failCount} failed, ~${usedTokens} tokens used)`);
        console.log(`   📊 Progress: ${processedBatches}/${allAIBatches.length} batches (${Math.round(processedBatches/allAIBatches.length*100)}%)`);
        
        // Логируем ошибки
        for (const r of waveResults) {
            if (!r.success) {
                const retryMark = r.isOverloaded ? ' [will retry]' : '';
                console.log(`   ⚠️ ${r.brainrot}: ${r.error}${retryMark}`);
            }
        }
        
        // Ждём до конца минуты (если есть ещё волны)
        if (waveIdx < waves.length - 1) {
            const elapsed = Date.now() - waveStart;
            const waitTime = Math.max(0, 60000 - elapsed); // остаток минуты
            console.log(`   ⏳ Waiting ${(waitTime/1000).toFixed(0)}s for rate limit...`);
            await sleep(waitTime);
        }
    }
    
    console.log(`\n✅ All ${allAIBatches.length} batches processed!`);
    
    // 5. Retry волны для overloaded батчей
    if (retryBatches.length > 0) {
        console.log(`\n🔄 Retrying ${retryBatches.length} overloaded batches...`);
        
        // Создаём retry волны
        const retryWaves = createWaves(retryBatches, MAX_TOKENS_PER_MINUTE, MAX_REQUESTS_PER_MINUTE);
        
        console.log(`📋 Retry waves: ${retryWaves.length}`);
        
        // Ждём остаток минуты от последней волны
        const lastWaveEnd = Date.now();
        const timeSinceLastWave = lastWaveEnd % 60000;
        const waitBeforeRetry = Math.max(0, 60000 - timeSinceLastWave);
        if (waitBeforeRetry > 0) {
            console.log(`   ⏳ Waiting ${(waitBeforeRetry/1000).toFixed(0)}s before retry...`);
            await sleep(waitBeforeRetry);
        }
        
        for (let retryWaveIdx = 0; retryWaveIdx < retryWaves.length; retryWaveIdx++) {
            const waveStart = Date.now();
            const wave = retryWaves[retryWaveIdx];
            const waveBatches = wave.batches;
            
            console.log(`\n🔄 Retry Wave ${retryWaveIdx + 1}/${retryWaves.length} (${waveBatches.length} batches, ~${wave.totalTokens} tokens)...`);
            
            // Запускаем все батчи волны ОДНОВРЕМЕННО
            const wavePromises = waveBatches.map(async (batch, localIdx) => {
                try {
                    const results = await parseAIBatch(batch.offers, batch.brainrot, 1000 + retryWaveIdx * 100 + localIdx);
                    
                    if (!aiResultsByBrainrot[batch.brainrot]) {
                        aiResultsByBrainrot[batch.brainrot] = [];
                    }
                    
                    for (const r of results) {
                        aiResultsByBrainrot[batch.brainrot].push({
                            ...r,
                            index: batch.startIndex + r.localIndex - 1
                        });
                    }
                    
                    return { success: true, brainrot: batch.brainrot, tokens: batch.estimatedTokens };
                } catch (e) {
                    return { success: false, error: e.message, brainrot: batch.brainrot, tokens: batch.estimatedTokens };
                }
            });
            
            // Ждём завершения ВСЕХ батчей волны
            const waveResults = await Promise.all(wavePromises);
            
            const successCount = waveResults.filter(r => r.success).length;
            const failCount = waveResults.filter(r => !r.success).length;
            const usedTokens = waveResults.filter(r => r.success).reduce((s, r) => s + (r.tokens || 0), 0);
            
            const waveTime = Date.now() - waveStart;
            console.log(`   ✅ Retry wave done in ${(waveTime/1000).toFixed(1)}s (${successCount} ok, ${failCount} failed, ~${usedTokens} tokens used)`);
            
            // Логируем ошибки
            for (const r of waveResults) {
                if (!r.success) {
                    console.log(`   ⚠️ ${r.brainrot}: ${r.error}`);
                }
            }
            
            // Ждём до конца минуты (если есть ещё волны)
            if (retryWaveIdx < retryWaves.length - 1) {
                const elapsed = Date.now() - waveStart;
                const waitTime = Math.max(0, 60000 - elapsed);
                console.log(`   ⏳ Waiting ${(waitTime/1000).toFixed(0)}s for rate limit...`);
                await sleep(waitTime);
            }
        }
        
        console.log(`\n✅ Retry complete!`);
    }
    
    // 6. Обрабатываем результаты для каждого брейнрота
    const finalResults = [];
    
    for (const data of brainrotDataArray) {
        // Собираем AI результаты для этого брейнрота
        const aiResults = aiResultsByBrainrot[data.brainrot] || [];
        
        // Сортируем по индексу
        const sortedAI = new Array(data.offers.length).fill(null);
        for (const r of aiResults) {
            if (r.index >= 0 && r.index < sortedAI.length) {
                sortedAI[r.index] = r;
            }
        }
        
        const result = processResults(data, sortedAI);
        if (result) finalResults.push(result);
    }
    
    // 7. Итоговая статистика
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                           SUMMARY                                          ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    let upperMatches = 0;
    let lowerMatches = 0;
    
    for (const r of finalResults) {
        const uMark = r.upperMatch ? '✅' : '❌';
        const lMark = r.lowerMatch ? '✅' : '❌';
        console.log(`${r.brainrot.padEnd(30)} offers:${String(r.offersCount).padStart(4)} | Upper:${uMark} Lower:${lMark}`);
        
        if (r.upperMatch) upperMatches++;
        if (r.lowerMatch) lowerMatches++;
    }
    
    console.log('');
    console.log('─'.repeat(70));
    console.log(`Brainrots tested: ${finalResults.length}`);
    console.log(`Total offers processed: ${totalOffers}`);
    console.log(`Upper matches: ${upperMatches}/${finalResults.length} (${(upperMatches/finalResults.length*100).toFixed(0)}%)`);
    console.log(`Lower matches: ${lowerMatches}/${finalResults.length} (${(lowerMatches/finalResults.length*100).toFixed(0)}%)`);
    console.log(`Time elapsed: ${elapsed}s`);
}

main().catch(console.error);
