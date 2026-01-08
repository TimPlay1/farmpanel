const https = require('https');
const fs = require('fs');
const path = require('path');

// v3.0.22: SOCKS5 proxy support
let SocksProxyAgent = null;
let proxyAgent = null;
try {
    SocksProxyAgent = require('socks-proxy-agent').SocksProxyAgent;
    const SOCKS5_PROXY_URL = process.env.SOCKS5_PROXY_URL;
    if (SOCKS5_PROXY_URL) {
        proxyAgent = new SocksProxyAgent(SOCKS5_PROXY_URL);
        console.log('✅ SOCKS5 proxy agent loaded for eldorado-price');
    }
} catch (e) {
    console.warn('⚠️ socks-proxy-agent not available:', e.message);
}

// v3.0.21: User-Agent Rotation Pool (shared with cron-price-scanner)
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
];
let userAgentIndex = 0;

function getRotatingUserAgent() {
    userAgentIndex = (userAgentIndex + 1) % USER_AGENTS.length;
    return USER_AGENTS[userAgentIndex];
}

// v10.3.0: Импортируем подключение к БД для загрузки пользователей панели
let connectToDatabase = null;
try {
    connectToDatabase = require('./_lib/db').connectToDatabase;
    console.log('Database connection module loaded');
} catch (e) {
    console.warn('Database connection not available:', e.message);
}

// Импортируем AI сканер для гибридного парсинга
let aiScanner = null;
try {
    aiScanner = require('./ai-scanner.js');
    console.log('AI Scanner loaded successfully');
} catch (e) {
    console.warn('AI Scanner not available:', e.message);
}

// Серверный кэш для цен (хранится в памяти)
const priceCache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 минуты - чтобы не долбить Eldorado API

// v9.11.4: Кэш для searchBrainrotOffers (краткосрочный - 30 сек)
const searchCache = new Map();
const SEARCH_CACHE_TTL = 30 * 1000; // 30 секунд - предотвращает повторные запросы при AI re-parsing

// v10.3.0: Кэш пользователей панели (shopNames и offer codes)
let panelUsersCache = {
    shopNames: new Set(),      // Все shopName пользователей панели (lowercase)
    offerCodes: new Set(),     // Все активные коды офферов (#XXXXXX)
    lastUpdate: 0
};
const PANEL_USERS_CACHE_TTL = 5 * 60 * 1000; // 5 минут

/**
 * v10.3.0: Загружает всех пользователей панели и их коды офферов
 * Используется для фильтрации "своих" офферов при расчёте цен
 */
async function loadPanelUsersCache() {
    // Проверяем актуальность кэша
    if (Date.now() - panelUsersCache.lastUpdate < PANEL_USERS_CACHE_TTL) {
        return panelUsersCache;
    }
    
    if (!connectToDatabase) {
        console.warn('Cannot load panel users: database not available');
        return panelUsersCache;
    }
    
    try {
        const { db } = await connectToDatabase();
        
        // Загружаем все shopNames из farmers
        const farmers = await db.collection('farmers').find(
            { shopName: { $exists: true, $ne: null, $ne: '' } },
            { projection: { shopName: 1 } }
        ).toArray();
        
        const shopNames = new Set();
        for (const farmer of farmers) {
            if (farmer.shopName) {
                // Добавляем как есть и lowercase версию
                shopNames.add(farmer.shopName.toLowerCase());
                // Также добавляем без эмодзи для надёжного сравнения
                const textOnly = farmer.shopName.replace(/[^\w\s]/g, '').trim().toLowerCase();
                if (textOnly.length >= 3) {
                    shopNames.add(textOnly);
                }
            }
        }
        
        // Загружаем все активные коды офферов
        const codes = await db.collection('offer_codes').find(
            { status: { $ne: 'deleted' } },
            { projection: { code: 1 } }
        ).toArray();
        
        const offerCodes = new Set();
        for (const doc of codes) {
            if (doc.code) {
                offerCodes.add(doc.code.toUpperCase().replace(/^#/, ''));
            }
        }
        
        // Также загружаем коды из offers коллекции
        const offers = await db.collection('offers').find(
            { offerId: { $exists: true, $ne: null, $ne: '' } },
            { projection: { offerId: 1 } }
        ).toArray();
        
        for (const offer of offers) {
            if (offer.offerId) {
                offerCodes.add(offer.offerId.toUpperCase().replace(/^#/, ''));
            }
        }
        
        panelUsersCache = {
            shopNames,
            offerCodes,
            lastUpdate: Date.now()
        };
        
        console.log(`📋 Panel users cache updated: ${shopNames.size} shop names, ${offerCodes.size} offer codes`);
        
    } catch (e) {
        console.error('Failed to load panel users cache:', e.message);
    }
    
    return panelUsersCache;
}

// Steal a Brainrot gameId на Eldorado
const ELDORADO_GAME_ID = '259';

// Алиасы для брейнротов с ошибками в названиях на Eldorado
// Ключ = наше правильное название (lowercase), значение = название в системе Eldorado
const BRAINROT_NAME_ALIASES = {
    'chimnino': 'Chimino'  // Eldorado ошибочно записал как "Chimino" вместо "Chimnino"
};

// Загружаем mapping брейнротов -> ID из Eldorado (статический, для fallback)
let BRAINROT_ID_MAP = new Map();
let BRAINROT_MIN_PRICES = new Map();
try {
    const dataPath = path.join(__dirname, '../data/eldorado-brainrot-ids.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    data.forEach(item => {
        BRAINROT_ID_MAP.set(item.name.toLowerCase(), { id: item.id, name: item.name });
        BRAINROT_MIN_PRICES.set(item.name.toLowerCase(), item.price);
    });
    // Добавляем алиасы в BRAINROT_ID_MAP для правильной фильтрации
    for (const [alias, eldoradoName] of Object.entries(BRAINROT_NAME_ALIASES)) {
        const eldoradoData = BRAINROT_ID_MAP.get(eldoradoName.toLowerCase());
        if (eldoradoData) {
            BRAINROT_ID_MAP.set(alias, { ...eldoradoData, name: eldoradoName });
            console.log(`Added alias: ${alias} -> ${eldoradoName}`);
        }
    }
    console.log('Loaded', BRAINROT_ID_MAP.size, 'Eldorado brainrot IDs (static fallback)');
} catch (e) {
    console.error('Failed to load eldorado-brainrot-ids.json:', e.message);
}

// Динамический кэш брейнротов из API Eldorado
let dynamicBrainrotsCache = new Set();
let dynamicBrainrotsCacheTime = 0;
const DYNAMIC_CACHE_TTL = 30 * 60 * 1000; // 30 минут

/**
 * Вычисляет медиану массива чисел
 * @param {number[]} numbers - массив чисел
 * @returns {number|null} - медианное значение или null если массив пуст
 */
function calculateMedian(numbers) {
    if (!numbers || numbers.length === 0) return null;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

/**
 * Получает актуальный список брейнротов из Eldorado API
 * Использует кэш чтобы не спамить API
 */
async function getAvailableBrainrots() {
    // Проверяем кэш
    if (dynamicBrainrotsCache.size > 0 && Date.now() - dynamicBrainrotsCacheTime < DYNAMIC_CACHE_TTL) {
        return dynamicBrainrotsCache;
    }
    
    // Пробуем получить из AI Scanner (если доступен)
    if (aiScanner && aiScanner.fetchEldoradoDynamicLists) {
        try {
            const lists = await aiScanner.fetchEldoradoDynamicLists();
            if (lists.brainrots && lists.brainrots.length > 0) {
                dynamicBrainrotsCache = new Set(lists.brainrots.map(b => b.toLowerCase()));
                dynamicBrainrotsCacheTime = Date.now();
                console.log(`📋 Updated dynamic brainrots from API: ${dynamicBrainrotsCache.size} items`);
                return dynamicBrainrotsCache;
            }
        } catch (e) {
            console.warn('Could not fetch dynamic brainrots:', e.message);
        }
    }
    
    // Fallback: используем статический mapping
    return new Set(BRAINROT_ID_MAP.keys());
}

/**
 * Проверяет существует ли брейнрот в системе Eldorado
 * Сначала проверяет динамический кэш (API), потом статический файл
 */
async function isBrainrotInEldorado(brainrotName) {
    const nameLower = brainrotName.toLowerCase();
    
    // 0. Проверяем алиасы (для исправления ошибок в названиях Eldorado)
    if (BRAINROT_NAME_ALIASES[nameLower]) {
        return true;
    }
    
    // 1. Проверяем динамический кэш из API
    const dynamicList = await getAvailableBrainrots();
    if (dynamicList.has(nameLower)) {
        return true;
    }
    
    // 2. Проверяем статический mapping
    if (BRAINROT_ID_MAP.has(nameLower)) {
        return true;
    }
    
    // 3. Частичное совпадение (для случаев типа "La Taco" vs "La Taco Combinasion")
    const words = nameLower.split(/\s+/).filter(w => w.length > 2);
    for (const key of dynamicList) {
        if (words.every(w => key.includes(w))) {
            return true;
        }
    }
    for (const key of BRAINROT_ID_MAP.keys()) {
        if (words.every(w => key.includes(w))) {
            return true;
        }
    }
    
    return false;
}

// Загружаем предзаготовленные диапазоны цен
let PRICE_RANGES = {};
try {
    PRICE_RANGES = require('../data/price-ranges.js');
    console.log('Loaded price ranges for', Object.keys(PRICE_RANGES).length, 'brainrots');
} catch (e) {
    console.error('Failed to load price-ranges.js:', e.message);
}

/**
 * Определяет диапазон M/s по income (диапазоны Eldorado)
 */
function getMsRangeForIncome(income) {
    if (income >= 1000) return '1+ B/s';      // 1000+ M/s = 1+ B/s
    if (income >= 750) return '750-999 M/s';
    if (income >= 500) return '500-749 M/s';   // 645 попадает сюда!
    if (income >= 250) return '250-499 M/s';
    if (income >= 100) return '100-249 M/s';
    if (income >= 50) return '50-99 M/s';
    if (income >= 25) return '25-49 M/s';
    if (income > 0) return '0-24 M/s';
    return '0';
}

/**
 * v9.8.12: Получает следующий (более высокий) диапазон M/s
 * Для проверки конкурентов на границе диапазонов
 */
function getNextMsRange(currentRange) {
    const rangeOrder = [
        '0-24 M/s',
        '25-49 M/s', 
        '50-99 M/s',
        '100-249 M/s',
        '250-499 M/s',
        '500-749 M/s',
        '750-999 M/s',
        '1+ B/s'
    ];
    const currentIndex = rangeOrder.indexOf(currentRange);
    if (currentIndex >= 0 && currentIndex < rangeOrder.length - 1) {
        return rangeOrder[currentIndex + 1];
    }
    return null; // Нет следующего диапазона
}

/**
 * v9.8.12: Получает нижнюю границу диапазона в M/s
 */
function getRangeLowerBound(msRange) {
    const bounds = {
        '0-24 M/s': 0,
        '25-49 M/s': 25,
        '50-99 M/s': 50,
        '100-249 M/s': 100,
        '250-499 M/s': 250,
        '500-749 M/s': 500,
        '750-999 M/s': 750,
        '1+ B/s': 1000
    };
    return bounds[msRange] || 0;
}

/**
 * v9.8.12: Получает верхнюю границу диапазона в M/s  
 */
function getRangeUpperBound(msRange) {
    const bounds = {
        '0-24 M/s': 24,
        '25-49 M/s': 49,
        '50-99 M/s': 99,
        '100-249 M/s': 249,
        '250-499 M/s': 499,
        '500-749 M/s': 749,
        '750-999 M/s': 999,
        '1+ B/s': 9999
    };
    return bounds[msRange] || 9999;
}

/**
 * v9.8.12: Проверяет находится ли income близко к верхней границе диапазона
 * Близко = в пределах 10% от верхней границы
 * Например: 96.2 M/s близко к 99 (граница 50-99)
 */
function isNearRangeUpperBound(income, msRange) {
    const upperBound = getRangeUpperBound(msRange);
    const threshold = upperBound * 0.1; // 10% от верхней границы
    return (upperBound - income) <= threshold;
}

/**
 * v9.10.0: Рассчитывает процентное уменьшение цены на основе разницы между competitor и lower
 * Формула: 15% от разницы, минимум $0.10, максимум $1.00
 * 
 * Примеры:
 * - $5 vs $4 (diff=$1) → reduction = $0.15
 * - $12 vs $7 (diff=$5) → reduction = $0.75
 * - $50 vs $28 (diff=$22) → reduction = $1.00 (max)
 * 
 * @param {number} competitorPrice - цена компетитора (upper)
 * @param {number} lowerPrice - цена lower (или 0 если нет lower)
 * @returns {number} - величина уменьшения цены в диапазоне $0.10-$1.00
 */
function calculateReduction(competitorPrice, lowerPrice = 0) {
    // Если нет lower, используем 10% от цены компетитора как разницу
    const diff = lowerPrice > 0 ? (competitorPrice - lowerPrice) : (competitorPrice * 0.1);
    
    // 15% от разницы, минимум $0.10, максимум $1.00
    const reduction = Math.min(1.0, Math.max(0.1, diff * 0.15));
    
    // Округляем до центов
    return Math.round(reduction * 100) / 100;
}

/**
 * v10.3.0: Проверяет является ли оффер от пользователя нашей панели
 * Проверяет по:
 * 1. Кодам офферов (#XXXXXX) в title/description
 * 2. Названиям магазинов (shopName) в title
 * 3. Старые хардкодные проверки для совместимости
 * 
 * @param {Object} offer - оффер с Eldorado
 * @param {Object} panelUsers - кэш пользователей панели {shopNames, offerCodes}
 */
function isOurStoreOffer(offer, panelUsers = null) {
    const title = (offer.offerTitle || '').toLowerCase();
    const description = (offer.offerDescription || offer.description || '').toLowerCase();
    const fullText = title + ' ' + description;
    
    // 1. Проверяем по кодам офферов панели (#XXXXXX)
    // Ищем все коды в формате #XXXXXX (6-8 символов)
    const codeMatches = fullText.match(/#([A-Z0-9]{6,8})/gi) || [];
    if (panelUsers?.offerCodes && codeMatches.length > 0) {
        for (const match of codeMatches) {
            const code = match.replace('#', '').toUpperCase();
            if (panelUsers.offerCodes.has(code)) {
                console.log(`   🚫 Skipping panel user offer (code #${code})`);
                return true;
            }
        }
    }
    
    // 2. Проверяем по названиям магазинов пользователей панели
    if (panelUsers?.shopNames) {
        for (const shopName of panelUsers.shopNames) {
            if (shopName.length >= 5 && title.includes(shopName)) {
                console.log(`   🚫 Skipping panel user offer (shop: ${shopName})`);
                return true;
            }
        }
    }
    
    // 3. Старые хардкодные проверки для совместимости
    // Проверяем по коду #GS (старый уникальный идентификатор)
    if (title.includes('#gs') || description.includes('#gs')) {
        return true;
    }
    
    // Проверяем по названию магазина (старое)
    if (title.includes('glitched store') || (title.includes('glitched') && title.includes('store'))) {
        return true;
    }
    
    return false;
}

/**
 * Находит брейнрота в Eldorado mapping (case-insensitive)
 */
function findEldoradoBrainrot(name) {
    const nameLower = name.toLowerCase();
    
    // Точное совпадение
    if (BRAINROT_ID_MAP.has(nameLower)) {
        return BRAINROT_ID_MAP.get(nameLower);
    }
    
    // Поиск по частичному совпадению (все слова)
    const words = nameLower.split(/\s+/).filter(w => w.length > 2);
    for (const [key, value] of BRAINROT_ID_MAP) {
        if (words.every(w => key.includes(w))) {
            return value;
        }
    }
    
    return null;
}

/**
 * Парсит доходность из title оффера
 * Примеры: "37.5M/s", "37 M/S", "46,8M/S", "37.5 m/s", "1.5B/s", "1B/S", "1b"
 * B/s = Billions per second, конвертируется в M/s (* 1000)
 * 
 * @param {string} title - заголовок оффера
 * @param {string} msRangeAttr - M/s диапазон из атрибутов оффера для валидации (опционально)
 */
function parseIncomeFromTitle(title, msRangeAttr = null) {
    if (!title) return null;
    
    // Получаем границы диапазона из атрибута для валидации
    let rangeMin = 0, rangeMax = 99999;
    if (msRangeAttr) {
        const rangeMatch = msRangeAttr.match(/(\d+)-(\d+)/);
        if (rangeMatch) {
            rangeMin = parseInt(rangeMatch[1]);
            rangeMax = parseInt(rangeMatch[2]);
        } else if (msRangeAttr.includes('1+') || msRangeAttr.includes('1000+')) {
            rangeMin = 1000;
            rangeMax = 99999;
        }
    }
    
    // Убираем $ перед числами M/s и B/s (хитрость недобросовестных продавцов: "$111M/s", "$1.2B/s")
    // Но НЕ убираем в контексте "Unit Price:" - это цена, а не income
    let cleanTitle = title.replace(/Unit\s*Price\s*:?\s*\$?[\d.,]+\s*[BbMm]?/gi, ''); // Удаляем Unit Price полностью
    cleanTitle = cleanTitle.replace(/\$(\d+[.,]?\d*)\s*M/gi, '$1M');
    cleanTitle = cleanTitle.replace(/\$(\d+[.,]?\d*)\s*B/gi, '$1B');
    
    // ПРОВЕРКА НА ДИАПАЗОНЫ: "150m - 500m/s", "100-500M/s", "250m~500m/s", "88M to 220M/s"
    // Такие офферы - это "spin the wheel" или рандомные, их income ненадёжен
    // Паттерны:
    // - "150m - 500m/s" (с дефисом)
    // - "250m~500m/s" (с тильдой)
    // - "88M to 220M/s" (со словом "to")
    // - "100 to 500M/s" (первое число может быть без M)
    // v3.0.23: Added M-B range patterns like "30M-1B/S", "100M-2B/s"
    const rangePatterns = [
        /(\d+)\s*[mM]?\s*[-~]\s*(\d+)\s*[mM]\/[sS]/i,          // 150m - 500m/s, 100-500M/s
        /(\d+)\s*[mM]?\s+to\s+(\d+)\s*[mM]\/[sS]/i,             // 88M to 220M/s, 100 to 500M/s
        /(\d+)\s*[mM]?\s*[-~]\s*(\d+)\s*[mM]\s/i,               // 150m - 500m (без /s, но с пробелом после)
        /(\d+)\s*[mM]?\s+to\s+(\d+)\s*[mM]\s/i,                 // 88M to 220M (без /s)
        // v3.0.23: M-B range patterns (30M-1B/S, 100M-2B/s, 150Ms-1B/S)
        /(\d+)\s*[mM][sS]?\s*[-~]\s*(\d+(?:\.\d+)?)\s*[bB]\/[sS]/i,  // 30M-1B/s, 100M-2B/S, 150Ms-1B/S
        /(\d+)\s*[mM]\s*[-~]\s*(\d+(?:\.\d+)?)\s*[bB]\s/i,           // 30M-1B (with space after)
        // v3.0.23: M/s - M/s range patterns (150M/s - 500M/s)
        /(\d+)\s*[mM]\/[sS]\s*[-~]\s*(\d+)\s*[mM]\/[sS]/i,           // 150M/s - 500M/s
        /(\d+)\s*[mM]\/[sS]\s+to\s+(\d+)\s*[mM]\/[sS]/i,             // 100M/s to 500M/s
    ];
    
    for (const rangePattern of rangePatterns) {
        const rangeMatch = cleanTitle.match(rangePattern);
        if (rangeMatch) {
            // Это диапазон, возвращаем null чтобы не использовать этот оффер как референс
            console.log(`⚠️ Skipping range offer: "${title}" (${rangeMatch[1]}-${rangeMatch[2]} range)`);
            return null;
        }
    }
    
    // v3.0.23: Check for "HIGH VALUE" pattern which is typically random/box offers
    if (/HIGH\s+VALUE.*SECRET/i.test(cleanTitle) && /\d+\s*[mM]\s*[-~]\s*\d+/i.test(cleanTitle)) {
        console.log(`⚠️ Skipping HIGH VALUE range offer: "${title}"`);
        return null;
    }
    
    // Также проверяем паттерны "Spin the Wheel", "Random", "Mystery" - это ненадёжные офферы
    if (/spin\s*(the)?\s*wheel|random|mystery|lucky/i.test(cleanTitle)) {
        console.log(`⚠️ Skipping random/mystery offer: "${title}"`);
        return null;
    }
    
    // Сначала ищем явный M/s паттерн (более надёжный)
    const mPatterns = [
        /(\d+[.,]?\d*)\s*M\/s/i,      // 37.5M/s, 37 M/S
        /(\d+[.,]?\d*)\s*m\/sec/i,    // 37m/sec
        /(\d+[.,]?\d*)\s*mil\/s/i,    // 37mil/s
    ];

    for (const pattern of mPatterns) {
        const match = cleanTitle.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            if (value >= 1 && value <= 9999) {
                return value;
            }
        }
    }
    
    // Проверяем B/s (Billions) - но ТОЛЬКО если это валидно для диапазона
    // Защита от манипуляций типа "2.7B GET 111M/S" в категории 100-249 M/s
    const bPatterns = [
        /(\d+[.,]?\d*)\s*B\/S/i,              // 1.0B/S, 1.5 B/s
        /(\d+[.,]?\d*)B\/s/i,                  // 1.5B/s (без пробела)
        /\[(\d+[.,]?\d*)\s*B\/s\]/i,          // [1.5B/s]
        /(\d+[.,]?\d*)\s*b\/sec/i,            // 1b/sec
        /(\d+[.,]?\d*)\s*bil\/s/i,            // 1bil/s
        /(\d+[.,]?\d*)\s*B(?![a-zA-Z\/])/i,   // 1.2B, 1.5B (без /s, но не BrainRot)
        /(\d+[.,]?\d*)b(?![a-zA-Z\/])/i,      // 1.2b, 1.5b (lowercase, без /s)
    ];
    
    for (const pattern of bPatterns) {
        const match = cleanTitle.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            const msValue = value * 1000; // B/s -> M/s
            
            // Валидация: B/s значение должно быть в диапазоне атрибута
            // Если оффер в категории 100-249 M/s, но парсится как 2700M/s - это манипуляция!
            if (msRangeAttr && (msValue < rangeMin || msValue > rangeMax * 1.5)) {
                console.log(`⚠️ Manipulation detected: "${title}" claims ${msValue}M/s but in range ${msRangeAttr}`);
                // Пробуем найти реальный M/s в title
                const realMsMatch = cleanTitle.match(/GET\s+(\d+[.,]?\d*)\s*M/i) || 
                                   cleanTitle.match(/(\d+[.,]?\d*)\s*M\/S/i);
                if (realMsMatch) {
                    const realValue = parseFloat(realMsMatch[1].replace(',', '.'));
                    if (realValue >= rangeMin && realValue <= rangeMax * 1.5) {
                        console.log(`   → Real income: ${realValue}M/s`);
                        return realValue;
                    }
                }
                continue; // Пропускаем этот B/s паттерн
            }
            
            if (msValue >= 1000 && msValue <= 99999) {
                return msValue;
            }
        }
    }
    
    // Fallback: менее строгие M паттерны
    const fallbackPatterns = [
        /(\d+[.,]?\d*)\s*M\s/i,       // 37M (с пробелом после)
        /(\d+[.,]?\d*)\s*M$/i,        // 37M (в конце строки)
        /(\d+[.,]?\d*)M/i,            // 37.5M (без пробела)
    ];

    for (const pattern of fallbackPatterns) {
        const match = cleanTitle.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            if (value >= 1 && value <= 9999) {
                return value;
            }
        }
    }
    return null;
}

/**
 * Парсит среднее значение из M/s диапазона
 * "25-49 M/s" -> 37, "500+ M/s" -> 500, "0-24 M/s" -> 12
 */
function parseIncomeFromMsRange(msRange) {
    if (!msRange) return null;
    
    const rangeMatch = msRange.match(/(\d+)-(\d+)/);
    if (rangeMatch) {
        const min = parseInt(rangeMatch[1]);
        const max = parseInt(rangeMatch[2]);
        return Math.floor((min + max) / 2); // Среднее значение диапазона
    }
    
    const plusMatch = msRange.match(/(\d+)\+/);
    if (plusMatch) {
        return parseInt(plusMatch[1]); // Для 500+ возвращаем 500
    }
    
    return null;
}

/**
 * Выполняет fetch запрос к Eldorado API с фильтрами
 * Использует официальные параметры из swagger API:
 * - tradeEnvironmentValue0 = "Brainrot" (тип item)
 * - tradeEnvironmentValue2 = имя брейнрота (фильтр по конкретному брейнроту)
 * - offerAttributeIdsCsv = ID атрибутов (M/s range и/или мутация через запятую)
 * @param {number} pageIndex - номер страницы
 * @param {string} msRangeAttrId - ID атрибута M/s range (например "0-8" для 1+ B/s)
 * @param {string} brainrotName - имя брейнрота для фильтрации (опционально, "Other" для неизвестных)
 * @param {string} searchQuery - текстовый поиск в title оффера (для брейнротов не в списке Eldorado)
 * @param {string} mutationAttrId - v9.11.0: ID атрибута мутации (например "1-1" для Gold)
 */
function fetchEldorado(pageIndex = 1, msRangeAttrId = null, brainrotName = null, searchQuery = null, mutationAttrId = null) {
    return new Promise((resolve) => {
        // Используем официальные параметры из swagger
        const params = new URLSearchParams({
            gameId: ELDORADO_GAME_ID,
            category: 'CustomItem',
            tradeEnvironmentValue0: 'Brainrot',
            pageSize: '50',
            pageIndex: String(pageIndex),
            offerSortingCriterion: 'Price',
            isAscending: 'true'
        });
        
        // v9.11.0: Собираем атрибуты для фильтрации (M/s range + мутация)
        const attrIds = [];
        if (msRangeAttrId) attrIds.push(msRangeAttrId);
        if (mutationAttrId) attrIds.push(mutationAttrId);
        
        if (attrIds.length > 0) {
            params.set('offerAttributeIdsCsv', attrIds.join(','));
        }
        
        // Добавляем фильтр по имени брейнрота
        // Если brainrotName = "Other" - это специальный фильтр для неизвестных брейнротов
        if (brainrotName) {
            params.set('tradeEnvironmentValue2', brainrotName);
        }
        
        // Добавляем текстовый поиск (для брейнротов не в списке Eldorado)
        if (searchQuery) {
            params.set('searchQuery', searchQuery);
        }

        // v3.0.21: Use rotating User-Agent
        // v9.12.90: Use SOCKS5 proxy agent if configured
        const options = {
            hostname: 'www.eldorado.gg',
            path: '/api/flexibleOffers?' + params.toString(),
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'User-Agent': getRotatingUserAgent()
            },
            agent: proxyAgent || undefined  // v9.12.90: Use SOCKS5 proxy if available
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // v3.0.20: Detect Cloudflare rate limit (1015)
                if (res.statusCode === 403 || res.statusCode === 429) {
                    if (data.includes('1015') || data.includes('rate limit') || data.includes('Rate limit')) {
                        console.log('🚫 Cloudflare 1015 detected in eldorado-price!');
                        resolve({ error: 'cloudflare_1015', rateLimited: true, results: [] });
                        return;
                    }
                }
                
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.code && parsed.code !== 200) {
                        resolve({ error: parsed.messages, results: [] });
                        return;
                    }
                    resolve({
                        results: parsed.results || parsed.flexibleOffers || [],
                        totalCount: parsed.recordCount || parsed.totalCount || 0,
                        totalPages: parsed.totalPages || 0
                    });
                } catch (e) {
                    // v3.0.20: Parse error might be Cloudflare HTML
                    if (data.includes('1015') || data.includes('Cloudflare')) {
                        console.log('🚫 Cloudflare block detected in eldorado-price!');
                        resolve({ error: 'cloudflare_block', rateLimited: true, results: [] });
                        return;
                    }
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
 * Определяет диапазон M/s для income (диапазоны Eldorado)
 */
function getMsRange(income) {
    if (income >= 1000) return '1+ B/s';      // 1000+ M/s = 1+ B/s
    if (income >= 750) return '750-999 M/s';
    if (income >= 500) return '500-749 M/s';   // 645 попадает сюда!
    if (income >= 250) return '250-499 M/s';
    if (income >= 100) return '100-249 M/s';
    if (income >= 50) return '50-99 M/s';
    if (income >= 25) return '25-49 M/s';
    if (income > 0) return '0-24 M/s';
    return '0';
}

/**
 * Возвращает attr_id для M/s диапазона (для фильтрации на Eldorado)
 * ПРАВИЛЬНЫЙ MAPPING (проверено через API):
 * 0-0 = без M/s атрибута
 * 0-1 = 0-24 M/s
 * 0-2 = 25-49 M/s
 * 0-3 = 50-99 M/s
 * 0-4 = 100-249 M/s
 * 0-5 = 250-499 M/s
 * 0-6 = 500-749 M/s
 * 0-7 = 750-999 M/s
 * 0-8 = 1+ B/s
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
 * v9.11.0: Маппинг атрибутов мутаций для фильтрации на Eldorado
 * Получено через анализ API ответов
 */
const MUTATION_ATTR_IDS = {
    'None': '1-0',
    'Gold': '1-1',
    'Diamond': '1-2',
    'Bloodrot': '1-3',
    'Candy': '1-4',
    'Lava': '1-5',
    'Galaxy': '1-6',
    'Yin-Yang': '1-7',
    'YinYang': '1-7',   // альтернативное написание
    'Radioactive': '1-8',
    'Rainbow': '1-9',
    'Cursed': '1-10'    // v9.12.87: Added Cursed mutation
};

/**
 * v9.11.0: Возвращает attr_id для мутации (для фильтрации на Eldorado)
 * @param {string} mutation - название мутации (Gold, Diamond, etc.)
 * @returns {string|null} - ID атрибута или null если не найден
 */
function getMutationAttrId(mutation) {
    if (!mutation || mutation === 'None' || mutation === 'Default' || mutation === '') {
        return null; // Для дефолтных брейнротов не фильтруем по мутации
    }
    // v9.12.87: Case-insensitive lookup - normalize to Title Case
    const normalizedMutation = mutation.charAt(0).toUpperCase() + mutation.slice(1).toLowerCase();
    // Also check for exact match (like 'Yin-Yang', 'YinYang')
    return MUTATION_ATTR_IDS[normalizedMutation] || MUTATION_ATTR_IDS[mutation] || null;
}

/**
 * Генерирует варианты поискового запроса для брейнрота
 * Например "Tictac Sahur" -> ["Tictac Sahur", "Tic tac Sahur", "tictac sahur"]
 */
function generateSearchVariants(name) {
    const variants = new Set();
    variants.add(name);
    variants.add(name.toLowerCase());
    
    // Разбиваем CamelCase/слитные слова
    // "Tictac" -> "Tic tac"
    const withSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
                          .replace(/([A-Za-z])(\d)/g, '$1 $2');
    variants.add(withSpaces);
    variants.add(withSpaces.toLowerCase());
    
    // Добавляем вариант с пробелами между всеми "словами"
    // "Tictac" можно разбить на "Tic tac"
    const parts = name.split(/\s+/);
    for (const part of parts) {
        // Пробуем разбить длинные слова
        if (part.length > 5) {
            // Ищем позицию где можно разбить (между согласной и гласной)
            for (let i = 2; i < part.length - 2; i++) {
                const split = part.slice(0, i) + ' ' + part.slice(i);
                const newName = name.replace(part, split);
                variants.add(newName);
                variants.add(newName.toLowerCase());
            }
        }
    }
    
    return [...variants].slice(0, 6); // Максимум 6 вариантов
}

/**
 * Ищет офферы брейнрота в конкретном M/s диапазоне Eldorado
 * 
 * ЛОГИКА:
 * 1. Проверяем есть ли брейнрот в системе Eldorado (динамически через API)
 * 2. Устанавливаем offerAttributeIdsCsv фильтр для M/s диапазона
 * 3. Устанавливаем tradeEnvironmentValue2 фильтр для брейнрота
 * 4. Если брейнрота нет в системе Eldorado → используем фильтр "Other" + поиск по title
 * 5. Сортировка ascending (low to high по цене)
 * 6. Ищем upper (income >= наш) на ВСЕХ страницах
 * 7. Lower ищем на ТОЙ ЖЕ странице что и upper
 * 8. v10.3.0: Пропускаем офферы других пользователей панели
 * 
 * @param {string} brainrotName - имя брейнрота
 * @param {number} targetIncome - целевой income
 * @param {number} maxPages - максимум страниц для поиска
 * @param {Object} options - опции (disableAI: boolean, mutation: string)
 * @returns {Object} - upper оффер, lower оффер, все офферы страницы
 */
async function searchBrainrotOffers(brainrotName, targetIncome = 0, maxPages = 50, options = {}) {
    const { disableAI = false, mutation = null } = options;
    
    // v9.11.4: Ключ кэша для searchBrainrotOffers
    const targetMsRange = getMsRange(targetIncome);
    const mutationKey = mutation && mutation !== 'None' && mutation !== 'Default' ? `_${mutation}` : '';
    const searchCacheKey = `${brainrotName.toLowerCase()}_${targetMsRange}_${Math.round(targetIncome / 5) * 5}${mutationKey}`;
    
    // Проверяем краткосрочный кэш (30 сек) - предотвращает повторные запросы
    const cachedSearch = searchCache.get(searchCacheKey);
    if (cachedSearch && Date.now() - cachedSearch.timestamp < SEARCH_CACHE_TTL) {
        console.log('🗄️ Using cached search result for', brainrotName, '(age:', Math.round((Date.now() - cachedSearch.timestamp) / 1000) + 's)');
        return cachedSearch.data;
    }
    
    const eldoradoInfo = findEldoradoBrainrot(brainrotName);
    // Используем точное имя из mapping или оригинальное имя
    const eldoradoName = eldoradoInfo?.name || brainrotName;
    const msRangeAttrId = getMsRangeAttrId(targetMsRange);
    
    // v9.11.0: Получаем ID атрибута мутации для фильтрации
    const mutationAttrId = getMutationAttrId(mutation);
    
    // Проверяем динамически есть ли брейнрот в системе Eldorado
    const isInEldoradoList = await isBrainrotInEldorado(brainrotName);
    
    // v10.3.0: Загружаем кэш пользователей панели для фильтрации
    const panelUsers = await loadPanelUsersCache();
    const panelOffersSkipped = { count: 0 }; // Счётчик пропущенных офферов панели
    
    console.log('Searching:', brainrotName, '| Eldorado name:', eldoradoName, '| Target M/s:', targetMsRange, '| attr_id:', msRangeAttrId, mutation ? '| Mutation: ' + mutation + ' (' + mutationAttrId + ')' : '', '| Target income:', targetIncome, '| In Eldorado:', isInEldoradoList, '| Panel users cached:', panelUsers.shopNames.size, 'shops,', panelUsers.offerCodes.size, 'codes');
    
    let upperOffer = null;
    let lowerOffer = null;
    let nextCompetitor = null; // v9.9.0: Следующий компетитор после upper
    let upperPage = 0;
    const offersByPage = new Map(); // v9.9.0: Офферы по страницам для расчёта медианы
    const allPageOffers = []; // Все офферы со страницы где найден upper
    const seenIds = new Set();
    let totalPages = 0;
    let filterMode = 'name'; // 'name' | 'other' | 'search' | 'none'
    let currentFilter = eldoradoName; // Имя для фильтра
    let useSearchQuery = null; // searchQuery для текстового поиска
    
    for (let page = 1; page <= maxPages; page++) {
        // Определяем какой фильтр использовать
        let filterName = null;
        if (filterMode === 'name') {
            filterName = eldoradoName;
        } else if (filterMode === 'other' || filterMode === 'search') {
            filterName = 'Other';  // Специальный фильтр для неизвестных брейнротов
        }
        // filterMode === 'none' → filterName = null
        
        // v9.11.0: Передаём mutationAttrId для фильтрации по мутации
        let response = await fetchEldorado(page, msRangeAttrId, filterName, useSearchQuery, mutationAttrId);
        
        if (page === 1) {
            totalPages = response.totalPages || 0;
            console.log('Total pages in range:', totalPages, '| Filter mode:', filterMode, '| Filter:', filterName, useSearchQuery ? '| Search: ' + useSearchQuery : '', mutationAttrId ? '| Mutation filter: ' + mutationAttrId : '');
            
            // Если с фильтром по имени 0 результатов - пробуем "Other" + searchQuery
            if (totalPages === 0 && filterMode === 'name') {
                console.log('No results with name filter "' + eldoradoName + '", trying "Other" + searchQuery...');
                filterMode = 'search';
                useSearchQuery = brainrotName; // Используем оригинальное имя для поиска
                response = await fetchEldorado(page, msRangeAttrId, 'Other', useSearchQuery, mutationAttrId);
                totalPages = response.totalPages || 0;
                console.log('With "Other" + searchQuery - total pages:', totalPages);
                
                // Если searchQuery не дал результатов - пробуем просто "Other" без searchQuery
                if (totalPages === 0) {
                    console.log('No results with searchQuery, trying just "Other" category...');
                    filterMode = 'other';
                    useSearchQuery = null;
                    response = await fetchEldorado(page, msRangeAttrId, 'Other', null, mutationAttrId);
                    totalPages = response.totalPages || 0;
                    console.log('With "Other" filter only - total pages:', totalPages);
                }
                
                // Если и "Other" не дал результатов - пробуем без фильтра
                if (totalPages === 0) {
                    console.log('No results in "Other" category, trying without name filter...');
                    filterMode = 'none';
                    response = await fetchEldorado(page, msRangeAttrId, null, null, mutationAttrId);
                    totalPages = response.totalPages || 0;
                    console.log('Without name filter - total pages:', totalPages);
                }
            }
        }
        
        if (response.error || !response.results?.length) {
            console.log('No more results at page', page, response.error || '');
            break;
        }
        
        // Останавливаемся если вышли за пределы страниц
        if (page > totalPages && totalPages > 0) {
            console.log('Reached end of pages:', totalPages);
            break;
        }
        
        // Небольшая задержка между страницами
        if (page > 1) {
            await new Promise(r => setTimeout(r, 100));
        }
        
        // Парсим офферы страницы
        const pageOffers = [];
        
        for (const item of response.results) {
            const offer = item.offer || item;
            const brainrotEnv = offer.tradeEnvironmentValues?.find(e => e.name === 'Brainrot');
            const envValue = (brainrotEnv?.value || '').toLowerCase();
            const offerTitle = offer.offerTitle || '';
            
            // Получаем M/s диапазон из атрибутов оффера для валидации парсинга
            const msAttr = offer.offerAttributeIdValues?.find(a => a.name === 'M/s');
            const offerMsRange = msAttr?.value || targetMsRange; // "100-249 M/s", "500-749 M/s", etc
            
            // ВСЕГДА проверяем соответствие названия брейнрота в title
            // Eldorado API иногда возвращает офферы других брейнротов (продавцы пишут чужие названия в title)
            // ЭТО ОСОБЕННО ВАЖНО для фильтра "Other" - там смешаны все неизвестные брейнроты!
            const titleLower = offerTitle.toLowerCase();
            const nameLower = brainrotName.toLowerCase();
            
            // v9.10.15: Улучшенная функция проверки соответствия названия
            // 
            // ЛОГИКА:
            // 1. СНАЧАЛА проверяем - содержит ли title наш целевой брейнрот
            //    Если да - это наш оффер, пропускаем проверку на другие брейнроты
            // 2. Если НЕТ нашего брейнрота - проверяем есть ли ДРУГОЙ известный брейнрот
            //    Это защита от офферов типа "Los 67 100M/s" в фильтре "Los 25"
            // 3. Офферы с похожими названиями (опечатки) передаются на AI перепроверку
            //    вместо жёсткого отклонения
            const checkBrainrotMatch = () => {
                // === ШАГИ 1: Проверяем содержит ли title наш брейнрот ===
                const containsOurBrainrot = () => {
                    // 1a. Точное совпадение полного имени
                    if (titleLower.includes(nameLower)) return true;
                    
                    // 1b. Проверяем tradeEnvironmentValue (брейнрот из атрибутов Eldorado)
                    if (envValue && (envValue.includes(nameLower) || nameLower.includes(envValue))) return true;
                    
                    // 1c. Для комбинированных имён проверяем ключевые слова
                    // "Garama and Madundung" → ["garama", "madundung"]
                    // "La Taco Combinasion" → ["taco", "combinasion"]
                    // НО: для "Los XX" типа "Los 25" требуем точное совпадение числа!
                    const isLosPattern = /^los\s+\d+$/i.test(nameLower);
                    const isLaPattern = /^la\s+/i.test(nameLower);
                    
                    if (isLosPattern) {
                        // Для "Los 25", "Los 67" и т.д. - требуем точное совпадение
                        // "Los 25" должен матчить только "Los 25", не "Los 67"
                        const numberMatch = nameLower.match(/\d+/);
                        if (numberMatch) {
                            // Ищем паттерн "Los XX" где XX = наш номер
                            const pattern = new RegExp(`los\\s+${numberMatch[0]}(?!\\d)`, 'i');
                            return pattern.test(titleLower);
                        }
                    }
                    
                    // Для остальных брейнротов - проверяем ключевые слова
                    const nameWords = nameLower
                        .replace(/\s+(and|the|of)\s+/gi, ' ')
                        .split(/\s+/)
                        .filter(w => w.length >= 4 && !['los', 'las', 'la'].includes(w));
                    
                    if (nameWords.length >= 2) {
                        // Требуем минимум 2 совпадения из значимых слов
                        const matchCount = nameWords.filter(w => titleLower.includes(w)).length;
                        if (matchCount >= 2) return true;
                    } else if (nameWords.length === 1 && nameWords[0].length >= 5) {
                        // Для коротких имён требуем точное слово (минимум 5 символов)
                        if (titleLower.includes(nameWords[0])) return true;
                    }
                    
                    return false;
                };
                
                // Если title содержит наш брейнрот - это наш оффер, разрешаем!
                if (containsOurBrainrot()) {
                    return true;
                }
                
                // === ШАГ 2: Title НЕ содержит наш брейнрот ===
                // Проверяем есть ли там ДРУГОЙ известный брейнрот из динамического списка
                
                // Пропускаем проверку на другие брейнроты если список пуст
                if (dynamicBrainrotsCache.size === 0) {
                    // Нет списка - не можем проверить, разрешаем оффер
                    return true;
                }
                
                // Получаем Eldorado имя из алиаса (если есть)
                // Например: nameLower="chimnino" → eldoradoNameLower="chimino"
                const eldoradoAlias = BRAINROT_NAME_ALIASES[nameLower];
                const eldoradoNameLower = eldoradoAlias ? eldoradoAlias.toLowerCase() : nameLower;
                
                // Проверяем только брейнроты достаточной длины для надёжного матчинга
                for (const otherBrainrot of dynamicBrainrotsCache) {
                    // Пропускаем слишком короткие названия (могут давать ложные срабатывания)
                    if (otherBrainrot.length < 5) continue;
                    
                    // Пропускаем если это наш брейнрот или его часть (учитываем алиас)
                    if (nameLower === otherBrainrot) continue;
                    if (eldoradoNameLower === otherBrainrot) continue; // Алиас совпадает с otherBrainrot
                    if (nameLower.includes(otherBrainrot) || otherBrainrot.includes(nameLower)) continue;
                    if (eldoradoNameLower.includes(otherBrainrot) || otherBrainrot.includes(eldoradoNameLower)) continue;
                    
                    // Специальная обработка для паттерна "Los XX"
                    // "Los 25" не должен конфликтовать с "Los 67", "Los Mobilis" и т.д.
                    const isOtherLosPattern = /^los\s+\d+$/i.test(otherBrainrot);
                    const isOurLosPattern = /^los\s+\d+$/i.test(nameLower);
                    
                    if (isOtherLosPattern && isOurLosPattern) {
                        // Оба "Los XX" - проверяем точное совпадение номера
                        const otherNumber = otherBrainrot.match(/\d+/)?.[0];
                        const ourNumber = nameLower.match(/\d+/)?.[0];
                        if (otherNumber && ourNumber && otherNumber !== ourNumber) {
                            // Разные номера - проверяем есть ли ДРУГОЙ Los XX в title
                            const pattern = new RegExp(`los\\s+${otherNumber}(?!\\d)`, 'i');
                            if (pattern.test(titleLower)) {
                                console.log(`⚠️ Skipping offer with wrong brainrot: "${offerTitle.substring(0, 50)}..." (found: ${otherBrainrot}, expected: ${brainrotName})`);
                                return false;
                            }
                        }
                        continue; // Не проверяем полное совпадение для Los XX vs Los YY
                    }
                    
                    // Проверяем полное имя брейнрота в title
                    if (titleLower.includes(otherBrainrot)) {
                        console.log(`⚠️ Skipping offer with wrong brainrot: "${offerTitle.substring(0, 50)}..." (found: ${otherBrainrot}, expected: ${brainrotName})`);
                        return false;
                    }
                    
                    // Для многословных брейнротов (например "La Extinct Grande") проверяем ключевые слова
                    // Минимум 5 символов чтобы избежать false positives на коротких словах
                    const brainrotWords = otherBrainrot.split(/\s+/).filter(w => w.length >= 5);
                    if (brainrotWords.length >= 2) {
                        // Уникальные слова брейнрота найденные в title
                        const matchedWords = [...new Set(brainrotWords.filter(w => titleLower.includes(w)))];
                        // Если 2+ УНИКАЛЬНЫХ ключевых слова найдены - это другой брейнрот
                        if (matchedWords.length >= 2) {
                            console.log(`⚠️ Skipping offer with wrong brainrot: "${offerTitle.substring(0, 50)}..." (found words: ${matchedWords.join(', ')} → ${otherBrainrot}, expected: ${brainrotName})`);
                            return false;
                        }
                    }
                }
                
                // ШАГ 3: В title нет ни нашего брейнрота, ни других известных
                // Это может быть валидный оффер с опечаткой или кастомным описанием
                // РАЗРЕШАЕМ - AI парсер сможет перепроверить при необходимости
                return true;
            };
            
            if (!checkBrainrotMatch()) continue;
            
            // v9.12.84: Validate mutation attribute from offer
            // Eldorado API may not filter correctly - offers with wrong mutations can slip through
            // v9.12.86: CRITICAL FIX - When searching for a specific mutation (e.g. radioactive),
            // we must REQUIRE that the offer has that mutation, not just skip offers with DIFFERENT mutations.
            // Otherwise default/none offers slip through (like $1111 Swaggy Bros without radioactive)
            let skipDueToMutation = false;
            if (mutation && mutation !== 'None' && mutation !== 'Default') {
                const mutationAttr = offer.offerAttributeIdValues?.find(a => a.name === 'Mutation');
                const offerMutation = mutationAttr?.value?.toLowerCase() || '';
                const targetMutation = mutation.toLowerCase();
                
                // All known mutations (for checking title)
                const mutationPatterns = {
                    'gold': /\bgold\b/i,
                    'diamond': /\bdiamond\b/i,
                    'bloodrot': /\bbloodrot\b/i,
                    'candy': /\bcandy\b/i,
                    'lava': /\blava\b/i,
                    'galaxy': /\bgalaxy\b/i,
                    'yin-yang': /\byin[-\s]?yang\b/i,
                    'yinyang': /\byin[-\s]?yang\b/i,
                    'radioactive': /\bradioactive\b/i,
                    'rainbow': /\brainbow\b/i,
                    'cursed': /\bcursed\b/i
                };
                
                // Normalize target mutation pattern key
                let targetPatternKey = targetMutation.replace('-', '');
                if (targetPatternKey === 'yinyang') targetPatternKey = 'yin-yang';
                const targetPattern = mutationPatterns[targetMutation] || mutationPatterns[targetPatternKey];
                
                // Check if offer has target mutation in attribute
                const hasTargetMutationAttr = offerMutation === targetMutation || 
                    offerMutation === targetMutation.replace('-', '') ||
                    offerMutation.replace('-', '') === targetMutation.replace('-', '');
                
                // Check if offer has target mutation in title
                const hasTargetMutationInTitle = targetPattern ? targetPattern.test(offerTitle) : false;
                
                // v9.12.88: Check for multi-mutation offers ("x2 mutations", "double mutation", "2x mutation")
                // These offers have MULTIPLE mutations and may include our target - don't skip them
                const isMultiMutationOffer = /\b(x2|2x|double|multi|dual)\s*mutation/i.test(offerTitle) ||
                                             /\bmutation(s)?\s*(x2|2x)/i.test(offerTitle);
                
                // v9.12.86: REQUIRE target mutation - offer must have it either in attr or title
                // v9.12.88: EXCEPT for multi-mutation offers which we can't determine from title alone
                if (!hasTargetMutationAttr && !hasTargetMutationInTitle && !isMultiMutationOffer) {
                    // Offer doesn't have the target mutation at all - skip it
                    // This catches default/none mutation offers like "$1111 Swaggy Bros 700M/S"
                    skipDueToMutation = true;
                }
                
                // Also check for explicit WRONG mutations (extra safety)
                // v9.12.88: Skip this check for multi-mutation offers
                if (!skipDueToMutation && !isMultiMutationOffer) {
                    for (const [mutName, pattern] of Object.entries(mutationPatterns)) {
                        // Skip if this is the target mutation
                        if (mutName === targetMutation || mutName === targetPatternKey) continue;
                        // If offer mentions a DIFFERENT mutation in title, skip
                        if (pattern.test(offerTitle)) {
                            skipDueToMutation = true;
                            break;
                        }
                    }
                }
            }
            if (skipDueToMutation) continue;
            
            // v10.3.0: Пропускаем офферы от пользователей нашей панели
            if (isOurStoreOffer(offer, panelUsers)) {
                panelOffersSkipped.count++;
                continue;
            }
            
            const offerId = offer.id;
            if (seenIds.has(offerId)) continue;
            seenIds.add(offerId);
            
            // Парсим income из title С ВАЛИДАЦИЕЙ по M/s диапазону
            // Это защищает от манипуляций типа "2.7B GET 111M/S" в категории 100-249 M/s
            const parsedIncome = parseIncomeFromTitle(offerTitle, offerMsRange);
            const price = offer.pricePerUnitInUSD?.amount || 0;
            
            if (price <= 0) continue;
            
            const offerData = {
                id: offerId, // v9.12.89: Store offerId for nextCompetitor comparison
                title: offerTitle,
                income: parsedIncome || 0,
                price: price,
                msRange: offerMsRange,
                incomeFromTitle: !!parsedIncome,
                page: page
            };
            
            pageOffers.push(offerData);
            
            // Собираем ВСЕ офферы для поиска lower
            allPageOffers.push(offerData);
            
            // Ищем upper: первый оффер с income >= targetIncome
            // (страницы отсортированы по цене ASC, так что первый найденный = минимальная цена)
            if (!upperOffer && parsedIncome && parsedIncome >= targetIncome) {
                upperOffer = offerData;
                upperPage = page;
                console.log('Found UPPER at page', page, ':', parsedIncome, 'M/s @', price.toFixed(2));
            }
            // v9.12.89: Ищем nextCompetitor (после upper с income >= target И цена >= upper.price, но ДРУГОЙ оффер)
            // Изменено: price >= upperOffer.price (было >) чтобы учитывать офферы с той же ценой от других продавцов
            else if (upperOffer && !nextCompetitor && parsedIncome && parsedIncome >= targetIncome && 
                     price >= upperOffer.price && offerId !== upperOffer.id) {
                nextCompetitor = offerData;
                console.log('Found NEXT COMPETITOR at page', page, ':', parsedIncome, 'M/s @', price.toFixed(2));
            }
        }
        
        // v9.9.0: Сохраняем офферы по страницам для расчёта медианы
        if (pageOffers.length > 0) {
            offersByPage.set(page, [...pageOffers]);
        }
        
        // Если нашли upper - ищем lower среди ВСЕХ собранных офферов
        if (upperOffer && upperPage === page) {
            // Lower = оффер с income < targetIncome, цена <= upper
            // Берём с МАКСИМАЛЬНЫМ INCOME (ближайший к нашему по доходности)
            const lowerCandidates = allPageOffers.filter(o => 
                o.income > 0 && 
                o.income < targetIncome && 
                o.price <= upperOffer.price
            );
            
            if (lowerCandidates.length > 0) {
                // Сортируем по INCOME DESC - берём с максимальным income (ближе к нашему)
                lowerCandidates.sort((a, b) => b.income - a.income);
                lowerOffer = lowerCandidates[0];
                console.log('Found LOWER:', lowerOffer.income, 'M/s @', lowerOffer.price.toFixed(2), '(page', lowerOffer.page + ')');
            }
            
            // v9.9.0: Продолжаем ещё 1 страницу для поиска nextCompetitor
            if (!nextCompetitor && page < maxPages) {
                console.log('Upper found at page', page, ', continuing 1 more page for nextCompetitor...');
                continue;
            }
            
            // Нашли upper и nextCompetitor (или прошли ещё 1 страницу) - останавливаемся
            console.log('Upper found at page', upperPage, (nextCompetitor ? ', nextCompetitor found' : ', no nextCompetitor'), '. Total offers collected:', allPageOffers.length);
            break;
        }
        
        // v9.9.0: Если upper уже найден на предыдущей странице - останавливаемся после текущей
        if (upperOffer && page > upperPage) {
            console.log('Searched 1 page after upper, stopping. Total offers collected:', allPageOffers.length);
            break;
        }
        
        // Если прошли много страниц без upper - выходим
        if (page >= maxPages) {
            console.log('Reached max pages', maxPages, 'without finding upper');
            break;
        }
    }
    
    // Если upper не найден - берём оффер с максимальным income как "above market"
    if (!upperOffer && allPageOffers.length === 0) {
        console.log('No upper found, will use above-market logic');
    }
    
    // ВАЖНО: если использовали фильтр "Other" или без фильтра - результаты менее надёжные
    // т.к. приходится полагаться на фильтрацию по title (которая может пропустить релевантные офферы)
    const searchWasReliable = filterMode === 'name' || allPageOffers.length > 0;
    const usedNameFilter = filterMode === 'name' ? eldoradoName : (filterMode === 'other' ? 'Other' : null);
    
    // v10.3.0: Добавляем информацию о пропущенных офферах панели
    console.log('Search complete. Upper:', upperOffer ? `${upperOffer.income}M/s @ $${upperOffer.price.toFixed(2)}` : 'none', '| Lower:', lowerOffer ? `${lowerOffer.income}M/s @ $${lowerOffer.price.toFixed(2)}` : 'none', '| NextCompetitor:', nextCompetitor ? `${nextCompetitor.income}M/s @ $${nextCompetitor.price.toFixed(2)}` : 'none', '| Filter mode:', filterMode, '| Reliable:', searchWasReliable, '| Panel offers skipped:', panelOffersSkipped.count);
    
    // AI RE-PARSING: для офферов где regex не справился - пробуем AI
    // НО! Если disableAI=true (вызов из cron) - пропускаем AI чтобы не тратить квоту
    const unparsedOffers = allPageOffers.filter(o => !o.incomeFromTitle || o.income === 0);
    let aiParsedCount = 0;
    
    if (!disableAI && unparsedOffers.length > 0 && aiScanner && process.env.GEMINI_API_KEY) {
        console.log(`🤖 AI re-parsing ${unparsedOffers.length} unparsed offers for "${brainrotName}"...`);
        try {
            const eldoradoLists = await aiScanner.fetchEldoradoDynamicLists();
            // v9.10.15: Передаём название брейнрота для проверки wrong_brainrot в AI
            const aiResults = await aiScanner.hybridParse(unparsedOffers, eldoradoLists, brainrotName);
            
            // Обновляем income в allPageOffers на основе AI результатов
            for (const aiResult of aiResults) {
                // v9.10.15: Пропускаем офферы которые AI определил как wrong_brainrot
                if (aiResult.reason === 'wrong_brainrot') {
                    console.log(`   ⚠️ AI skipped wrong brainrot: "${aiResult.title?.substring(0, 40)}..." (found: ${aiResult.foundBrainrot})`);
                    continue;
                }
                
                if (aiResult.income !== null && aiResult.source === 'ai') {
                    const originalOffer = allPageOffers.find(o => o.title === aiResult.title);
                    if (originalOffer) {
                        console.log(`   AI parsed: "${aiResult.title.substring(0, 40)}..." → ${aiResult.income}M/s`);
                        originalOffer.income = aiResult.income;
                        originalOffer.incomeFromTitle = true;
                        originalOffer.parsingSource = 'ai';
                        aiParsedCount++;
                        
                        // Пересчитываем upper/lower если AI нашёл лучшие значения
                        if (!upperOffer && aiResult.income >= targetIncome) {
                            upperOffer = originalOffer;
                            console.log(`   → New UPPER from AI: ${aiResult.income}M/s @ $${originalOffer.price.toFixed(2)}`);
                        }
                    }
                }
            }
            console.log(`🤖 AI parsed ${aiParsedCount} additional offers`);
        } catch (aiError) {
            console.warn('AI parsing failed:', aiError.message);
        }
    }
    
    // v9.11.4: Сохраняем результат в краткосрочный кэш
    const result = {
        upperOffer,
        lowerOffer,
        nextCompetitor,      // v9.9.0: Следующий компетитор после upper
        upperPage,           // v9.9.0: Страница где найден upper (для медианы)
        offersByPage,        // v9.9.0: Офферы по страницам (Map)
        allPageOffers,
        targetMsRange,
        isInEldoradoList,
        usedNameFilter,
        searchWasReliable,
        aiParsedCount,
        mutation             // v9.11.0: Мутация для которой искали (или null для Default)
    };
    
    searchCache.set(searchCacheKey, { data: result, timestamp: Date.now() });
    
    return result;
}

/**
 * Рассчитывает оптимальную цену для брейнрота
 * 
 * ЛОГИКА:
 * 1. Ищем upper (income >= наш) на всех страницах диапазона M/s
 * 2. Lower ищем на той же странице что и upper
 * 3. Если diff (upper - lower) >= $1 → рекомендуем upper - $1
 * 4. Если diff < $1 или нет lower → рекомендуем upper - $0.50
 * 5. Если upper не найден (мы выше рынка) → используем max price среди max income - $0.50
 * @param {Object} options - опции (disableAI: boolean, mutation: string)
 */
async function calculateOptimalPrice(brainrotName, ourIncome, options = {}) {
    const { disableAI = false, mutation = null } = options;
    // Парсим income если передан как строка ("80M/s" -> 80)
    let numericIncome = ourIncome;
    if (typeof ourIncome === 'string') {
        const match = ourIncome.match(/(\d+(?:[.,]\d+)?)\s*([MmBb])?/);
        if (match) {
            numericIncome = parseFloat(match[1].replace(',', '.'));
            if (match[2] && match[2].toLowerCase() === 'b') {
                numericIncome *= 1000; // B/s -> M/s
            }
        } else {
            numericIncome = 0;
        }
    }
    
    // v9.11.0: Кэш по M/s диапазону + точному income (округлённому до 5) + мутация
    const targetMsRange = getMsRangeForIncome(numericIncome);
    const mutationKey = mutation && mutation !== 'None' && mutation !== 'Default' ? `_${mutation}` : '';
    const cacheKey = `${brainrotName.toLowerCase()}_${targetMsRange}_${Math.round(numericIncome / 5) * 5}${mutationKey}`;
    
    // Проверяем кэш
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        // Ищем офферы брейнрота в нужном M/s диапазоне
        // v9.11.0: Передаём mutation для фильтрации по мутации
        const searchResult = await searchBrainrotOffers(brainrotName, numericIncome, 50, { disableAI, mutation });
        const { 
            upperOffer, lowerOffer, nextCompetitor, upperPage, offersByPage,
            allPageOffers, targetMsRange: msRange, isInEldoradoList, searchWasReliable, aiParsedCount 
        } = searchResult;
        
        let suggestedPrice;
        let priceSource;
        let competitorPrice = null;
        let competitorIncome = null;
        let lowerPrice = null;
        let lowerIncome = null;
        
        // v9.9.0: Новые цены
        let medianPrice = null;
        let medianData = null;
        let nextCompetitorPrice = null;
        let nextCompetitorData = null;

        if (upperOffer) {
            // Нашли upper (income >= наш)
            competitorPrice = upperOffer.price;
            competitorIncome = upperOffer.income;
            
            if (lowerOffer) {
                // Есть и lower (income < наш, на той же странице)
                lowerPrice = lowerOffer.price;
                lowerIncome = lowerOffer.income;
                
                // v9.10.0: Процентное уменьшение на основе разницы (15% от diff, мин $0.10, макс $1.00)
                const reduction = calculateReduction(competitorPrice, lowerPrice);
                suggestedPrice = Math.round((competitorPrice - reduction) * 100) / 100;
                priceSource = `upper ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}, lower ${lowerIncome}M/s @ $${lowerPrice.toFixed(2)}, diff $${(competitorPrice - lowerPrice).toFixed(2)} → -$${reduction.toFixed(2)}`;
            } else {
                // Нет lower - используем 10% от цены компетитора
                const reduction = calculateReduction(competitorPrice, 0);
                suggestedPrice = Math.round((competitorPrice - reduction) * 100) / 100;
                priceSource = `upper ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}, no lower → -$${reduction.toFixed(2)}`;
            }
            
            // ==================== v9.9.0: МЕДИАННАЯ ЦЕНА ====================
            // Вычисляем медиану цен среди первых 24 офферов на странице где найден компетитор
            if (upperPage > 0 && offersByPage) {
                const pageOffers = offersByPage.get(upperPage) || [];
                // Берём только первые 24 оффера для расчёта медианы (как просил пользователь)
                const first24Offers = pageOffers.slice(0, 24);
                const validPrices = first24Offers.filter(o => o.price > 0).map(o => o.price);
                
                if (validPrices.length >= 3) {
                    const median = calculateMedian(validPrices);
                    // v9.10.0: Для медианы используем reduction с lower = minPrice
                    const medianReduction = calculateReduction(median, Math.min(...validPrices));
                    medianPrice = Math.round((median - medianReduction) * 100) / 100;
                    medianData = {
                        pageNumber: upperPage,
                        offersUsed: validPrices.length,
                        offersOnPage: pageOffers.length,
                        medianValue: median,
                        minPrice: Math.min(...validPrices),
                        maxPrice: Math.max(...validPrices)
                    };
                    console.log(`📊 Median: $${median.toFixed(2)} (page ${upperPage}, ${validPrices.length}/24 offers) → -$${medianReduction.toFixed(2)} → $${medianPrice.toFixed(2)}`);
                }
            }
            
            // ==================== v9.9.0: ЦЕНА СЛЕДУЮЩЕГО КОМПЕТИТОРА ====================
            // Расчёт аналогичен suggestedPrice: ищем lower для nextCompetitor
            // Lower для nextCompetitor = upperOffer (как нижняя граница по цене)
            if (nextCompetitor) {
                // Upper является lower-ом для nextCompetitor (меньшая цена)
                const nextCompLower = upperOffer;
                // v9.10.0: Процентное уменьшение
                const nextReduction = calculateReduction(nextCompetitor.price, nextCompLower.price);
                nextCompetitorPrice = Math.round((nextCompetitor.price - nextReduction) * 100) / 100;
                
                nextCompetitorData = {
                    income: nextCompetitor.income,
                    price: nextCompetitor.price,
                    lowerPrice: nextCompLower.price,
                    lowerIncome: nextCompLower.income,
                    priceDiff: nextCompetitor.price - nextCompLower.price,
                    title: nextCompetitor.title?.substring(0, 50),
                    page: nextCompetitor.page
                };
                console.log(`📈 Next competitor: ${nextCompetitor.income}M/s @ $${nextCompetitor.price.toFixed(2)}, lower: $${nextCompLower.price.toFixed(2)}, diff: $${(nextCompetitor.price - nextCompLower.price).toFixed(2)} → -$${nextReduction.toFixed(2)} → $${nextCompetitorPrice.toFixed(2)}`);
            }
            
        } else if (allPageOffers.length > 0) {
            // Upper не найден - мы выше рынка
            // Но сначала проверяем - если у ВСЕХ офферов income = 0, значит парсинг сломался!
            const offersWithIncome = allPageOffers.filter(o => o.income > 0);
            
            if (offersWithIncome.length === 0) {
                // SANITY CHECK: парсинг income не сработал ни для одного оффера!
                // Это ненормальная ситуация - не даём неправильную цену
                console.error(`⚠️ SANITY CHECK FAILED: All ${allPageOffers.length} offers have income=0! Parsing broken?`);
                
                // Берём минимальную цену из первых 5 офферов как fallback
                const minPriceOffer = allPageOffers.slice(0, 5).reduce((min, o) => o.price < min.price ? o : min);
                const fallbackReduction = calculateReduction(minPriceOffer.price, 0);
                suggestedPrice = Math.round((minPriceOffer.price - fallbackReduction) * 100) / 100;
                priceSource = `FALLBACK: income parsing failed, using min price: $${minPriceOffer.price.toFixed(2)} → -$${fallbackReduction.toFixed(2)}`;
                competitorPrice = minPriceOffer.price;
                competitorIncome = 0;
            } else {
                // Нормальная ситуация - берём оффер с максимальным income
                const maxIncomeOffer = offersWithIncome.reduce((max, o) => o.income > max.income ? o : max);
                const sameIncomeOffers = offersWithIncome.filter(o => o.income === maxIncomeOffer.income);
                const maxPriceOffer = sameIncomeOffers.reduce((max, o) => o.price > max.price ? o : max);
                
                competitorPrice = maxPriceOffer.price;
                competitorIncome = maxIncomeOffer.income;
                
                // v9.8.11: Removed bad sanity check that was comparing max income price with min price on page
                // The old check (maxPrice > minPrice * 3) caused issues because low income offers 
                // naturally have much lower prices than high income offers
                
                // v9.10.0: Выше рынка - используем процентное уменьшение
                const aboveMarketReduction = calculateReduction(maxPriceOffer.price, 0);
                suggestedPrice = Math.round((maxPriceOffer.price - aboveMarketReduction) * 100) / 100;
                priceSource = `above market (max: $${maxPriceOffer.price.toFixed(2)} @ ${maxPriceOffer.income}M/s, our: ${numericIncome}M/s) → -$${aboveMarketReduction.toFixed(2)}`;
            }
            
            // v9.9.8: Рассчитываем медиану даже когда нет upper (above market case)
            // Берём первую страницу если есть офферы
            if (!medianData && offersByPage && offersByPage.size > 0) {
                const firstPage = Math.min(...offersByPage.keys());
                const pageOffers = offersByPage.get(firstPage) || [];
                const first24Offers = pageOffers.slice(0, 24);
                const validPrices = first24Offers.filter(o => o.price > 0).map(o => o.price);
                
                if (validPrices.length >= 3) {
                    const median = calculateMedian(validPrices);
                    const medianReduction = calculateReduction(median, Math.min(...validPrices));
                    medianPrice = Math.round((median - medianReduction) * 100) / 100;
                    medianData = {
                        pageNumber: firstPage,
                        offersUsed: validPrices.length,
                        offersOnPage: pageOffers.length,
                        medianValue: median,
                        minPrice: Math.min(...validPrices),
                        maxPrice: Math.max(...validPrices)
                    };
                    console.log(`📊 Median (no upper): $${median.toFixed(2)} (page ${firstPage}, ${validPrices.length}/24 offers) → -$${medianReduction.toFixed(2)} → $${medianPrice.toFixed(2)}`);
                }
            }
        } else {
            // Нет офферов вообще - берём минимальную цену из mapping
            const minPrice = BRAINROT_MIN_PRICES.get(brainrotName.toLowerCase());
            if (minPrice) {
                suggestedPrice = Math.round(minPrice * 100) / 100;
                priceSource = 'no offers found, using cached min price';
                competitorPrice = minPrice;
            } else {
                return {
                    error: 'No offers found and no cached price',
                    suggestedPrice: null,
                    brainrotName,
                    targetMsRange: msRange
                };
            }
        }

        // ==================== v9.8.12: ПРОВЕРКА СЛЕДУЮЩЕГО ДИАПАЗОНА ====================
        // Для brainrot'ов близких к верхней границе диапазона, проверяем конкурентов в следующем диапазоне
        // Например: 96.2 M/s близок к 99 (граница 50-99), смотрим также в 100-249
        // Если там есть более дешёвый конкурент с income чуть выше нашего - используем его
        
        let nextRangeChecked = false;
        let nextRangeCompetitor = null;
        // v9.9.9: Запоминаем был ли upper в текущем диапазоне
        const hadUpperInCurrentRange = !!upperOffer;
        
        if (competitorPrice && suggestedPrice && isNearRangeUpperBound(numericIncome, msRange)) {
            const nextRange = getNextMsRange(msRange);
            
            if (nextRange) {
                console.log(`🔍 ${brainrotName} @ ${numericIncome}M/s: near upper bound of ${msRange}, checking ${nextRange}...` + (mutation ? ` (mutation: ${mutation})` : ''));
                
                try {
                    // Ищем офферы в следующем диапазоне
                    const nextRangeLowerBound = getRangeLowerBound(nextRange);
                    // Ищем с income чуть выше границы (начало следующего диапазона)
                    const searchIncomeForNextRange = nextRangeLowerBound + 5; // например 105 для диапазона 100-249
                    
                    // v9.11.9: Передаём mutation при проверке следующего диапазона!
                    const nextRangeResult = await searchBrainrotOffers(brainrotName, searchIncomeForNextRange, 50, { disableAI, mutation });
                    
                    if (nextRangeResult.allPageOffers && nextRangeResult.allPageOffers.length > 0) {
                        // v9.10.5: Ищем ЛЮБОЙ оффер в следующем диапазоне с ценой ниже текущего конкурента
                        // Покупатель получит больше income за меньшую цену - это всегда выгоднее!
                        // Убрано ограничение по income (раньше было <= nextRangeLowerBound * 1.3)
                        const cheaperOffers = nextRangeResult.allPageOffers.filter(o => 
                            o.income > numericIncome && // Должен быть больше нашего income
                            o.price < competitorPrice   // И дешевле нашего конкурента
                        );
                        
                        if (cheaperOffers.length > 0) {
                            // Берём самый дешёвый
                            const cheapestOffer = cheaperOffers.reduce((min, o) => 
                                o.price < min.price ? o : min
                            );
                            
                            console.log(`   Found ${cheaperOffers.length} cheaper offers in ${nextRange}`);
                            console.log(`   Cheapest: ${cheapestOffer.income}M/s @ $${cheapestOffer.price.toFixed(2)}`);
                            console.log(`   Current competitor: ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}`);
                            
                            // v9.10.5: Условие уже проверено в фильтре выше - cheapestOffer.price < competitorPrice
                            nextRangeChecked = true;
                            nextRangeCompetitor = cheapestOffer;
                            
                            const oldCompetitorPrice = competitorPrice;
                            const oldSuggestedPrice = suggestedPrice;
                            
                            // Обновляем конкурента
                            competitorPrice = cheapestOffer.price;
                            competitorIncome = cheapestOffer.income;
                            
                            // v9.10.0: Пересчитываем suggestedPrice с процентным уменьшением
                            // Для next range у нас нет lower, используем 10% от цены
                            const nextRangeReduction = calculateReduction(competitorPrice, 0);
                            suggestedPrice = Math.round((competitorPrice - nextRangeReduction) * 100) / 100;
                            
                            priceSource = `NEXT RANGE CHECK: ${nextRange} has cheaper competitor ` +
                                `(${cheapestOffer.income}M/s @ $${cheapestOffer.price.toFixed(2)}) ` +
                                `vs current (${msRange}: $${oldCompetitorPrice.toFixed(2)}) → using next range → -$${nextRangeReduction.toFixed(2)}`;
                            
                            console.log(`   ✅ Switching to next range competitor! $${oldSuggestedPrice.toFixed(2)} → $${suggestedPrice.toFixed(2)}`);
                            
                            // v9.9.9: Если в текущем диапазоне НЕ БЫЛ найден upper (above market case),
                            // то пересчитываем медиану из следующего диапазона
                            if (!hadUpperInCurrentRange && nextRangeResult.offersByPage && nextRangeResult.offersByPage.size > 0) {
                                const nextRangeUpperPage = nextRangeResult.upperPage || 1;
                                const nextRangePageOffers = nextRangeResult.offersByPage.get(nextRangeUpperPage) || 
                                                           nextRangeResult.offersByPage.get(1) || [];
                                const first24NextRange = nextRangePageOffers.slice(0, 24);
                                const nextRangePrices = first24NextRange.filter(o => o.price > 0).map(o => o.price);
                                
                                if (nextRangePrices.length >= 3) {
                                    const nextMedian = calculateMedian(nextRangePrices);
                                    const nextMedianReduction = calculateReduction(nextMedian, Math.min(...nextRangePrices));
                                    medianPrice = Math.round((nextMedian - nextMedianReduction) * 100) / 100;
                                    medianData = {
                                        pageNumber: nextRangeUpperPage,
                                        offersUsed: nextRangePrices.length,
                                        offersOnPage: nextRangePageOffers.length,
                                        medianValue: nextMedian,
                                        minPrice: Math.min(...nextRangePrices),
                                        maxPrice: Math.max(...nextRangePrices),
                                        fromNextRange: true,
                                        nextRange: nextRange
                                    };
                                    console.log(`   📊 Median recalculated from next range ${nextRange}: $${nextMedian.toFixed(2)} → -$${nextMedianReduction.toFixed(2)} → $${medianPrice.toFixed(2)}`);
                                }
                            }
                            
                            // v9.12.89: Когда переключаемся на next range, обновляем nextCompetitorPrice
                            // из результатов ТЕКУЩЕГО (исходного) диапазона - это следующий конкурент после нашего upper
                            // Если в текущем диапазоне были офферы с income >= наш и price > nextRangeCompetitor.price
                            // то они становятся нашим nextCompetitor
                            if (nextCompetitor && nextCompetitor.price > competitorPrice) {
                                // NextCompetitor из текущего диапазона ещё актуален
                                // Пересчитываем с новым lower (= cheapestOffer из nextRange)
                                const ncReduction = calculateReduction(nextCompetitor.price, competitorPrice);
                                nextCompetitorPrice = Math.round((nextCompetitor.price - ncReduction) * 100) / 100;
                                nextCompetitorData = {
                                    income: nextCompetitor.income,
                                    price: nextCompetitor.price,
                                    lowerPrice: competitorPrice,
                                    lowerIncome: competitorIncome,
                                    priceDiff: nextCompetitor.price - competitorPrice,
                                    recalculatedFromNextRange: true
                                };
                                console.log(`   📈 NextCompetitor recalculated: ${nextCompetitor.income}M/s @ $${nextCompetitor.price.toFixed(2)}, lower: $${competitorPrice.toFixed(2)} → $${nextCompetitorPrice.toFixed(2)}`);
                            } else {
                                // Нет актуального nextCompetitor из текущего диапазона
                                // Используем nextCompetitor из следующего диапазона если есть
                                if (nextRangeResult.nextCompetitor) {
                                    const nrc = nextRangeResult.nextCompetitor;
                                    const nrcReduction = calculateReduction(nrc.price, competitorPrice);
                                    nextCompetitorPrice = Math.round((nrc.price - nrcReduction) * 100) / 100;
                                    nextCompetitorData = {
                                        income: nrc.income,
                                        price: nrc.price,
                                        lowerPrice: competitorPrice,
                                        lowerIncome: competitorIncome,
                                        priceDiff: nrc.price - competitorPrice,
                                        fromNextRange: true,
                                        nextRange: nextRange
                                    };
                                    console.log(`   📈 NextCompetitor from next range: ${nrc.income}M/s @ $${nrc.price.toFixed(2)} → $${nextCompetitorPrice.toFixed(2)}`);
                                } else {
                                    // Сбрасываем nextCompetitor - нет подходящего
                                    nextCompetitorPrice = null;
                                    nextCompetitorData = null;
                                    console.log(`   📈 No valid nextCompetitor after switching to next range`);
                                }
                            }
                        } else {
                            // Ищем минимальную цену для лога, даже если она дороже
                            const allOffersAboveOurIncome = nextRangeResult.allPageOffers.filter(o => o.income > numericIncome);
                            if (allOffersAboveOurIncome.length > 0) {
                                const cheapestInNextRange = allOffersAboveOurIncome.reduce((min, o) => o.price < min.price ? o : min);
                                console.log(`   ❌ Cheapest in ${nextRange}: ${cheapestInNextRange.income}M/s @ $${cheapestInNextRange.price.toFixed(2)} - more expensive than $${competitorPrice.toFixed(2)}`);
                            } else {
                                console.log(`   No offers in ${nextRange} with income > ${numericIncome}M/s`);
                            }
                        }
                    }
                } catch (nextRangeError) {
                    console.warn(`   Failed to check next range ${nextRange}:`, nextRangeError.message);
                }
            }
        }

        // ДИНАМИЧЕСКИЙ ЛИМИТ: вычисляем максимальную разумную цену на основе реального рынка
        // ВАЖНО: учитываем только офферы с ПОХОЖИМ income (±50%), чтобы не блокировать высокий income
        let dynamicMaxPrice = null;
        let dynamicLimitSource = '';
        
        if (allPageOffers.length > 0) {
            // Фильтруем офферы с похожим income (±50% от нашего)
            const similarIncomeOffers = allPageOffers.filter(o => {
                if (o.income <= 0) return false;
                const ratio = o.income / ourIncome;
                return ratio >= 0.5 && ratio <= 1.5; // ±50%
            });
            
            // Если есть офферы с похожим income - используем их для лимита
            const offersForLimit = similarIncomeOffers.length >= 3 ? similarIncomeOffers : allPageOffers;
            const usingSimilar = similarIncomeOffers.length >= 3;
            
            // Метод 1: средняя цена × 2.5 (более мягкий множитель)
            const first10 = offersForLimit.slice(0, 10);
            const avgPrice = first10.reduce((sum, o) => sum + o.price, 0) / first10.length;
            const limitFromAvg = Math.round(avgPrice * 2.5 * 100) / 100;
            
            // Метод 2: максимальная цена среди офферов × 1.5
            const offersWithIncome = offersForLimit.filter(o => o.income > 0);
            let limitFromMax = limitFromAvg; // fallback
            if (offersWithIncome.length > 0) {
                const maxPriceWithIncome = Math.max(...offersWithIncome.map(o => o.price));
                limitFromMax = Math.round(maxPriceWithIncome * 1.5 * 100) / 100;
            }
            
            // Берём БОЛЬШИЙ из двух лимитов (менее строгий) - чтобы не блокировать легитимные высокие цены
            dynamicMaxPrice = Math.max(limitFromAvg, limitFromMax);
            
            // Минимальный лимит $5 (чтобы не заблокировать дешёвые офферы)
            dynamicMaxPrice = Math.max(dynamicMaxPrice, 5);
            
            dynamicLimitSource = `dynamic (${usingSimilar ? 'similar income' : 'all offers'}): avg×2.5=$${limitFromAvg.toFixed(2)}, max×1.5=$${limitFromMax.toFixed(2)} → limit=$${dynamicMaxPrice.toFixed(2)}`;
            console.log(`📊 ${brainrotName} @ ${msRange}: ${dynamicLimitSource}`);
        }
        
        // Fallback статические лимиты (если нет офферов для расчёта динамического)
        const staticMaxPriceLimits = {
            '0-24 M/s': 5,
            '25-49 M/s': 8,
            '50-99 M/s': 12,
            '100-249 M/s': 15,
            '250-499 M/s': 25,
            '500-749 M/s': 40,
            '750-999 M/s': 60,
            '1+ B/s': 150
        };
        
        // Используем динамический лимит если он есть, иначе статический
        const maxAllowedPrice = dynamicMaxPrice || staticMaxPriceLimits[msRange] || 50;

        // Определяем источник парсинга (regex, ai, или hybrid)
        const hasAiParsed = aiParsedCount > 0;
        const totalParsedOffers = allPageOffers.filter(o => o.income > 0).length;
        let parsingSource = 'regex';
        if (hasAiParsed && aiParsedCount === totalParsedOffers) {
            parsingSource = 'ai';
        } else if (hasAiParsed) {
            parsingSource = 'hybrid';
        }
        
        // Проверяем источник парсинга для upper/lower
        const upperParsingSource = upperOffer?.parsingSource || 'regex';
        const lowerParsingSource = lowerOffer?.parsingSource || 'regex';

        const result = {
            suggestedPrice,
            marketPrice: upperOffer?.price || competitorPrice,
            offersFound: allPageOffers.length,
            targetMsRange: msRange,
            priceSource,
            parsingSource,
            upperParsingSource,
            lowerParsingSource,
            aiParsedCount: aiParsedCount || 0,
            brainrotName,
            mutation: mutation || null,  // v9.11.0: Мутация для которой рассчитана цена
            competitorPrice,
            competitorIncome,
            lowerPrice,
            lowerIncome,
            isInEldoradoList,
            dynamicMaxPrice,
            dynamicLimitSource,
            // v9.8.12: Next range check info
            nextRangeChecked,
            nextRangeCompetitor: nextRangeCompetitor ? {
                income: nextRangeCompetitor.income,
                price: nextRangeCompetitor.price,
                range: getNextMsRange(msRange)
            } : null,
            // v9.9.0: Новые варианты цен
            medianPrice,
            medianData,
            nextCompetitorPrice,
            nextCompetitorData,
            samples: allPageOffers.slice(0, 5).map(o => ({
                income: o.income,
                price: o.price,
                title: o.title?.substring(0, 60),
                source: o.parsingSource || 'regex'
            }))
        };

        // FINAL SANITY CHECK: проверяем цену против динамического лимита
        if (result.suggestedPrice > maxAllowedPrice) {
            console.error(`🚨 SANITY CHECK FAILED: suggestedPrice $${result.suggestedPrice} exceeds dynamic limit $${maxAllowedPrice} for ${msRange}`);
            console.error(`   Original source: ${result.priceSource}`);
            console.error(`   Limit source: ${dynamicLimitSource || 'static fallback'}`);
            
            // Возвращаем ошибку вместо неправильной цены
            result.originalSuggestedPrice = result.suggestedPrice;
            result.suggestedPrice = null;
            result.error = `Price $${result.originalSuggestedPrice} exceeds dynamic limit $${maxAllowedPrice} for ${msRange}`;
            result.priceSource = `BLOCKED: ${result.priceSource}`;
        }

        priceCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;

    } catch (err) {
        console.error('calculateOptimalPrice error:', err.message);
        return { 
            error: err.message, 
            suggestedPrice: null,
            brainrotName 
        };
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

    const brainrotName = req.query.name || req.query.brainrot;
    const income = parseFloat(req.query.income) || 0;
    // v9.11.0: Поддержка мутации для фильтрации
    const mutation = req.query.mutation || null;

    if (!brainrotName) {
        return res.status(400).json({ error: 'Missing brainrot name' });
    }

    try {
        const result = await calculateOptimalPrice(brainrotName, income, { mutation });
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Очистка кэша цен
function clearPriceCache() {
    const size = priceCache.size;
    priceCache.clear();
    console.log(`🗑️ Cleared ${size} entries from price cache`);
    return size;
}

// Экспорт для тестирования
module.exports.calculateOptimalPrice = calculateOptimalPrice;
module.exports.searchBrainrotOffers = searchBrainrotOffers;
module.exports.findEldoradoBrainrot = findEldoradoBrainrot;
module.exports.parseIncomeFromTitle = parseIncomeFromTitle;
module.exports.clearPriceCache = clearPriceCache;
