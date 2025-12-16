const https = require('https');
const fs = require('fs');
const path = require('path');

// Кэш для цен (хранится в памяти)
const priceCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 минут

// Steal a Brainrot gameId на Eldorado
const ELDORADO_GAME_ID = '259';

// Загружаем mapping брейнротов -> ID из Eldorado
let BRAINROT_ID_MAP = new Map();
let BRAINROT_MIN_PRICES = new Map();
try {
    const dataPath = path.join(__dirname, '../data/eldorado-brainrot-ids.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    data.forEach(item => {
        BRAINROT_ID_MAP.set(item.name.toLowerCase(), { id: item.id, name: item.name });
        BRAINROT_MIN_PRICES.set(item.name.toLowerCase(), item.price);
    });
    console.log('Loaded', BRAINROT_ID_MAP.size, 'Eldorado brainrot IDs');
} catch (e) {
    console.error('Failed to load eldorado-brainrot-ids.json:', e.message);
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
 * Все диапазоны M/s в порядке возрастания
 */
const MS_RANGES = [
    { range: '0-24 M/s', min: 0, max: 24, center: 12 },
    { range: '25-49 M/s', min: 25, max: 49, center: 37 },
    { range: '50-99 M/s', min: 50, max: 99, center: 74.5 },
    { range: '100-249 M/s', min: 100, max: 249, center: 174.5 },
    { range: '250-499 M/s', min: 250, max: 499, center: 374.5 },
    { range: '500-749 M/s', min: 500, max: 749, center: 624.5 },
    { range: '750-999 M/s', min: 750, max: 999, center: 874.5 },
    { range: '1+ B/s', min: 1000, max: 99999, center: 1500 }
];

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
 * Получает информацию о диапазоне по его названию
 */
function getRangeInfo(rangeName) {
    return MS_RANGES.find(r => r.range === rangeName);
}

/**
 * Получает соседний диапазон (вверх или вниз)
 * @param {string} currentRange - текущий диапазон
 * @param {string} direction - 'up' или 'down'
 * @returns {Object|null} - информация о соседнем диапазоне или null
 */
function getAdjacentRange(currentRange, direction) {
    const currentIndex = MS_RANGES.findIndex(r => r.range === currentRange);
    if (currentIndex === -1) return null;
    
    if (direction === 'up' && currentIndex < MS_RANGES.length - 1) {
        return MS_RANGES[currentIndex + 1];
    }
    if (direction === 'down' && currentIndex > 0) {
        return MS_RANGES[currentIndex - 1];
    }
    return null;
}

/**
 * Определяет нужно ли проверять соседний диапазон
 * Проверяем если income находится в верхних или нижних 30% диапазона
 * @returns {Object} { checkUp: boolean, checkDown: boolean }
 */
function shouldCheckAdjacentRanges(income, currentRange) {
    const rangeInfo = getRangeInfo(currentRange);
    if (!rangeInfo) return { checkUp: false, checkDown: false };
    
    const { min, max } = rangeInfo;
    const rangeSize = max - min;
    
    // Проверяем если income в верхних 30% или нижних 30% диапазона
    const upperThreshold = min + rangeSize * 0.7; // 70% от начала = верхние 30%
    const lowerThreshold = min + rangeSize * 0.3; // 30% от начала = нижние 30%
    
    console.log(`Adjacent check: income=${income}, range=${currentRange}, upperThreshold=${upperThreshold}, lowerThreshold=${lowerThreshold}`);
    
    return {
        checkUp: income >= upperThreshold,
        checkDown: income <= lowerThreshold
    };
}

/**
 * Проверяет является ли оффер от нашего магазина Glitched Store
 * По коду #GS или по названию магазина в title
 */
function isOurStoreOffer(offer) {
    const title = (offer.offerTitle || '').toLowerCase();
    const description = (offer.description || '').toLowerCase();
    
    // Проверяем по коду #GS (наш уникальный идентификатор)
    if (title.includes('#gs') || description.includes('#gs')) {
        return true;
    }
    
    // Проверяем по названию магазина
    if (title.includes('glitched store') || title.includes('glitched') && title.includes('store')) {
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
 * Примеры: "37.5M/s", "37 M/S", "46,8M/S", "37.5 m/s"
 */
function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    // Паттерны от более специфичных к общим
    const patterns = [
        /(\d+[.,]?\d*)\s*M\/s/i,      // 37.5M/s, 37 M/S
        /(\d+[.,]?\d*)\s*m\/sec/i,    // 37m/sec
        /(\d+[.,]?\d*)\s*mil\/s/i,    // 37mil/s
        /(\d+[.,]?\d*)\s*M\s/i,       // 37M (с пробелом после)
        /(\d+[.,]?\d*)\s*M$/i,        // 37M (в конце строки)
        /(\d+[.,]?\d*)M/i,            // 37.5M (без пробела)
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            // Проверяем что это разумное значение M/s (не цена и не ID)
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
 * Выполняет fetch запрос к Eldorado API с поиском по брейнроту
 * Использует te_v0=Brainrot для указания типа + searchQuery для имени
 * Сортировка по цене (Price ascending) для нахождения самых дешёвых офферов
 */
function fetchEldorado(searchQuery = '', pageIndex = 1) {
    return new Promise((resolve) => {
        // API с сортировкой по цене (ascending) для получения самых дешёвых первыми
        let queryPath = `/api/flexibleOffers?gameId=${ELDORADO_GAME_ID}&category=CustomItem&te_v0=Brainrot&pageSize=50&pageIndex=${pageIndex}&offerSortingCriterion=Price&isAscending=true`;
        
        if (searchQuery) {
            queryPath += `&searchQuery=${encodeURIComponent(searchQuery)}`;
        }

        const options = {
            hostname: 'www.eldorado.gg',
            path: queryPath,
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.code && parsed.code !== 200) {
                        resolve({ error: parsed.messages, results: [] });
                        return;
                    }
                    // С te_v0=Brainrot API возвращает results вместо flexibleOffers
                    resolve({
                        results: parsed.results || parsed.flexibleOffers || [],
                        totalCount: parsed.recordCount || parsed.totalCount || 0,
                        totalPages: parsed.totalPages || 0
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
 * Ищет офферы конкретного брейнрота через searchQuery API
 * @param {string} brainrotName - имя брейнрота
 * @param {number} targetIncome - целевой income для фильтрации по M/s range
 * @param {number} maxPages - максимум страниц для поиска
 * @returns {Object} - офферы и статистика
 */
async function searchBrainrotOffers(brainrotName, targetIncome = 0, maxPages = 60) {
    const eldoradoInfo = findEldoradoBrainrot(brainrotName);
    const nameLower = brainrotName.toLowerCase();
    const targetMsRange = getMsRange(targetIncome);
    
    // Проверяем есть ли брейнрот в списке Eldorado
    const isInEldoradoList = !!eldoradoInfo;
    
    // Генерируем варианты поиска
    const searchTerms = generateSearchVariants(eldoradoInfo?.name || brainrotName);
    console.log('Searching:', brainrotName, '| In Eldorado list:', isInEldoradoList, '| Variants:', searchTerms.length, '| Target M/s:', targetMsRange, '| Target income:', targetIncome);
    
    const relevantOffers = [];
    const matchingRangeOffers = []; // Офферы с совпадающим M/s range
    const seenIds = new Set();
    
    // Ищем только по первому варианту (основному имени) но на большем кол-ве страниц
    // Офферы с высоким M/s дороже и находятся на поздних страницах при сортировке по цене
    const mainSearchTerm = searchTerms[0];
    const minMatchingOffers = 10; // Минимум офферов в нужном M/s range
    let pagesWithoutMatch = 0; // Счётчик страниц без находок в нужном диапазоне
    let foundUpperOffer = false; // Нашли ли оффер с income >= targetIncome
    
    for (let page = 1; page <= maxPages; page++) {
        const response = await fetchEldorado(mainSearchTerm, page);
        
        if (response.error || !response.results?.length) break;
        
        // Небольшая задержка между страницами чтобы не перегружать API
        if (page > 1) {
            await new Promise(r => setTimeout(r, 100));
        }
        
        // Фильтруем результаты
        for (const item of response.results) {
            const offer = item.offer || item;
            const brainrotEnv = offer.tradeEnvironmentValues?.find(e => e.name === 'Brainrot');
            const envValue = brainrotEnv?.value?.toLowerCase() || '';
            const envId = brainrotEnv?.id || '';
            const msAttr = offer.offerAttributeIdValues?.find(a => a.name === 'M/s');
            const offerTitle = (offer.offerTitle || '').toLowerCase();
            
            let matches = false;
            
            if (isInEldoradoList && eldoradoInfo) {
                // Брейнрот есть в списке Eldorado - ищем ТОЧНОЕ совпадение по ID!
                // Это самый надёжный способ фильтрации
                const idMatches = envId === eldoradoInfo.id;
                const nameMatches = envValue === nameLower || envValue === eldoradoInfo.name.toLowerCase();
                matches = idMatches || nameMatches;
            } else {
                // Брейнрот НЕТ в списке Eldorado (категория "Other")
                // Ищем по названию в title оффера + проверяем что это "Other" категория
                const isOtherCategory = envValue === 'other' || envValue === '';
                const titleContainsName = offerTitle.includes(nameLower) || 
                                          searchTerms.some(term => offerTitle.includes(term.toLowerCase()));
                matches = titleContainsName && (isOtherCategory || !isInEldoradoList);
            }
        
            if (matches) {
                // Пропускаем офферы от нашего магазина Glitched Store
                if (isOurStoreOffer(offer)) {
                    continue;
                }
                
                const offerId = offer.id;
                if (!seenIds.has(offerId)) {
                    seenIds.add(offerId);
                    relevantOffers.push(item);
                    
                    // Отдельно собираем офферы с совпадающим M/s range
                    if (msAttr?.value === targetMsRange) {
                        matchingRangeOffers.push(item);
                        pagesWithoutMatch = 0; // Сброс счётчика
                        
                        // Проверяем нашли ли upper оффер (income >= targetIncome)
                        const title = offer.offerTitle || '';
                        const parsedIncome = parseIncomeFromTitle(title);
                        if (parsedIncome && parsedIncome >= targetIncome) {
                            foundUpperOffer = true;
                        }
                    }
                }
            }
        }
        
        // Логика остановки поиска:
        // 1. Если нашли upper оффер (income >= наш) И достаточно офферов - стоп
        // 2. Если не нашли upper оффер - продолжаем искать до maxPages
        // 3. Если прошло много страниц без находок - стоп
        
        if (foundUpperOffer && matchingRangeOffers.length >= minMatchingOffers) {
            console.log('Found upper offer and enough samples, stopping search at page', page);
            break;
        }
        
        // Если уже нашли много офферов но нет upper - всё равно продолжаем немного
        if (matchingRangeOffers.length >= minMatchingOffers * 2 && !foundUpperOffer) {
            // Даём ещё 10 страниц чтобы найти upper
            if (pagesWithoutMatch >= 10) {
                console.log('Many offers found but no upper, stopping after 10 empty pages at page', page);
                break;
            }
        }
        
        // Если прошло 15 страниц без ЛЮБЫХ находок в нужном диапазоне - стоп
        if (matchingRangeOffers.length > 0 && pagesWithoutMatch >= 15) {
            console.log('No more offers found in target range for 15 pages, stopping at page', page);
            break;
        }
        pagesWithoutMatch++;
    }
    
    console.log('Found', relevantOffers.length, 'offers for', brainrotName, '| In target range:', matchingRangeOffers.length, '| Upper found:', foundUpperOffer, '| Eldorado ID:', eldoradoInfo?.id || 'N/A');
    
    return {
        allOffers: relevantOffers,
        matchingRangeOffers: matchingRangeOffers,
        targetMsRange: targetMsRange
    };
}

/**
 * Извлекает офферы из определённого M/s диапазона из списка allOffers
 * @param {Array} allOffers - все найденные офферы
 * @param {string} msRange - диапазон M/s для фильтрации
 * @returns {Array} - офферы в указанном диапазоне
 */
function filterOffersByRange(allOffers, msRange) {
    return allOffers.filter(item => {
        const offer = item.offer || item;
        const msAttr = offer.offerAttributeIdValues?.find(a => a.name === 'M/s');
        return msAttr?.value === msRange;
    });
}

/**
 * Парсит офферы в унифицированный формат для расчёта цены
 */
function parseOffersForPricing(offers, ourIncome) {
    const parsedOffers = [];
    
    for (const item of offers) {
        const offer = item.offer || item;
        
        // Пропускаем офферы от нашего магазина
        if (isOurStoreOffer(offer)) {
            continue;
        }
        
        const title = offer.offerTitle || '';
        let income = parseIncomeFromTitle(title);
        const price = offer.pricePerUnitInUSD?.amount || 0;
        const msAttr = offer.offerAttributeIdValues?.find(a => a.name === 'M/s');
        
        const incomeFromTitle = !!income;
        if (!income && msAttr?.value) {
            const rangeMatch = msAttr.value.match(/(\d+)-(\d+)/);
            if (rangeMatch) {
                income = parseInt(rangeMatch[1]); // Минимум диапазона
            }
        }
        
        if (price > 0) {
            parsedOffers.push({
                title,
                income: income || 0,
                price,
                msRange: msAttr?.value,
                incomeFromTitle
            });
        }
    }
    
    parsedOffers.sort((a, b) => a.price - b.price);
    return parsedOffers;
}

/**
 * Рассчитывает оптимальную цену для брейнрота
 * С проверкой соседних диапазонов когда income близок к границе
 */
async function calculateOptimalPrice(brainrotName, ourIncome) {
    // Кэш по M/s диапазону + точному income (округлённому до 5)
    const targetMsRange = getMsRangeForIncome(ourIncome);
    const cacheKey = `${brainrotName.toLowerCase()}_${targetMsRange}_${Math.round(ourIncome / 5) * 5}_v2`;
    
    // Проверяем кэш
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        // Сначала проверяем предзаготовленные данные о ценах
        const brainrotPriceRanges = PRICE_RANGES[brainrotName];
        
        if (brainrotPriceRanges && brainrotPriceRanges[targetMsRange]) {
            const rangeData = brainrotPriceRanges[targetMsRange];
            // Рекомендуем чуть ниже средней для быстрой продажи
            const suggestedPrice = Math.round((rangeData.avgPrice - 1) * 100) / 100;
            
            const result = {
                suggestedPrice: Math.max(suggestedPrice, rangeData.minPrice),
                marketPrice: rangeData.minPrice,
                avgPrice: rangeData.avgPrice,
                maxPrice: rangeData.maxPrice,
                offersFound: rangeData.sampleCount,
                targetMsRange,
                priceSource: 'pre-collected data',
                brainrotName
            };
            priceCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        }
        
        // Если нет предзаготовленных данных - ищем офферы брейнрота
        const searchResult = await searchBrainrotOffers(brainrotName, ourIncome);
        const { allOffers, matchingRangeOffers } = searchResult;
        
        if (!allOffers || allOffers.length === 0) {
            // Если офферов нет - берём минимальную цену из mapping
            const minPrice = BRAINROT_MIN_PRICES.get(brainrotName.toLowerCase());
            const result = {
                suggestedPrice: minPrice ? Math.round(minPrice * 100) / 100 : null,
                marketPrice: minPrice,
                offersFound: 0,
                source: 'cached_min',
                brainrotName
            };
            priceCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        }

        // === НОВАЯ ЛОГИКА: Проверяем нужно ли смотреть соседние диапазоны ===
        const adjacentCheck = shouldCheckAdjacentRanges(ourIncome, targetMsRange);
        let adjacentRangeOffers = [];
        let adjacentRangeName = null;
        
        if (adjacentCheck.checkUp) {
            const upperRange = getAdjacentRange(targetMsRange, 'up');
            if (upperRange) {
                adjacentRangeName = upperRange.range;
                // Фильтруем из ВСЕХ найденных офферов (не только matchingRange)
                adjacentRangeOffers = filterOffersByRange(allOffers, upperRange.range);
                console.log(`Income ${ourIncome} close to upper bound, checking ${upperRange.range}: ${adjacentRangeOffers.length} offers from allOffers`);
                
                // Если в allOffers нет офферов из соседнего диапазона - делаем отдельный поиск
                if (adjacentRangeOffers.length === 0) {
                    console.log(`No adjacent offers in allOffers, doing separate search for ${upperRange.range}`);
                    const adjacentSearch = await searchBrainrotOffers(brainrotName, upperRange.center, 20);
                    adjacentRangeOffers = adjacentSearch.matchingRangeOffers || [];
                    console.log(`Separate search found ${adjacentRangeOffers.length} offers in ${upperRange.range}`);
                }
            }
        } else if (adjacentCheck.checkDown) {
            const lowerRange = getAdjacentRange(targetMsRange, 'down');
            if (lowerRange) {
                adjacentRangeName = lowerRange.range;
                adjacentRangeOffers = filterOffersByRange(allOffers, lowerRange.range);
                console.log(`Income ${ourIncome} close to lower bound, checking ${lowerRange.range}: ${adjacentRangeOffers.length} offers from allOffers`);
                
                // Если в allOffers нет офферов из соседнего диапазона - делаем отдельный поиск
                if (adjacentRangeOffers.length === 0) {
                    console.log(`No adjacent offers in allOffers, doing separate search for ${lowerRange.range}`);
                    const adjacentSearch = await searchBrainrotOffers(brainrotName, lowerRange.center, 20);
                    adjacentRangeOffers = adjacentSearch.matchingRangeOffers || [];
                    console.log(`Separate search found ${adjacentRangeOffers.length} offers in ${lowerRange.range}`);
                }
            }
        }

        // Парсим офферы из основного диапазона
        const mainParsed = parseOffersForPricing(matchingRangeOffers.length > 0 ? matchingRangeOffers : allOffers, ourIncome);
        
        // Парсим офферы из соседнего диапазона если есть
        const adjacentParsed = adjacentRangeOffers.length > 0 ? parseOffersForPricing(adjacentRangeOffers, ourIncome) : [];
        
        // Объединяем все офферы для анализа
        const allParsedOffers = [...mainParsed, ...adjacentParsed];
        allParsedOffers.sort((a, b) => a.price - b.price);

        if (allParsedOffers.length === 0) {
            const result = { 
                error: 'No offers with price', 
                suggestedPrice: null,
                brainrotName 
            };
            priceCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        }

        // ЛОГИКА РАСЧЁТА ЦЕНЫ (с учётом соседнего диапазона):
        // Фильтруем офферы: сначала только с точным income из title
        const offersWithExactIncome = allParsedOffers.filter(o => o.income > 0 && o.incomeFromTitle);
        const offersWithAnyIncome = allParsedOffers.filter(o => o.income > 0);
        
        // Используем точные данные если есть, иначе fallback
        const offersWithIncome = offersWithExactIncome.length >= 3 ? offersWithExactIncome : offersWithAnyIncome;
        
        // Разделяем на upper и lower относительно НАШЕГО income
        const upperOffers = offersWithIncome.filter(o => o.income >= ourIncome);
        const lowerOffers = offersWithIncome.filter(o => o.income < ourIncome);
        
        let suggestedPrice;
        let priceSource;
        let competitorPrice = null;
        let competitorIncome = null;
        let lowerPrice = null;
        let lowerIncome = null;

        // Логируем для отладки
        console.log(`Analyzing ${brainrotName} @ ${ourIncome}M/s:`);
        console.log(`  Main range: ${targetMsRange} (${mainParsed.length} offers)`);
        if (adjacentRangeName) {
            console.log(`  Adjacent range: ${adjacentRangeName} (${adjacentParsed.length} offers)`);
        }
        console.log(`  Upper offers (income >= ${ourIncome}): ${upperOffers.length}`);
        console.log(`  Lower offers (income < ${ourIncome}): ${lowerOffers.length}`);

        if (upperOffers.length > 0) {
            // Нашли офферы с доходностью >= нашей
            // Берём минимальную цену среди них
            const upperOffer = upperOffers[0];
            competitorPrice = upperOffer.price;
            competitorIncome = upperOffer.income;
            
            // Ищем нижний оффер
            if (lowerOffers.length > 0) {
                const validLower = lowerOffers.filter(o => o.price < competitorPrice);
                
                if (validLower.length > 0) {
                    // ГИБРИДНАЯ ЛОГИКА: ищем два варианта lower
                    const sortedByIncome = [...validLower].sort((a, b) => {
                        if (b.income !== a.income) return b.income - a.income;
                        return b.price - a.price;
                    });
                    const lowerByIncome = sortedByIncome[0];
                    
                    const sortedByPrice = [...validLower].sort((a, b) => b.price - a.price);
                    const lowerByPrice = sortedByPrice[0];
                    
                    // Определяем является ли lowerByIncome "сливом"
                    const isLowerDump = lowerByIncome.price < lowerByPrice.price * 0.8;
                    
                    let effectiveLower;
                    let dumpWarning = '';
                    
                    if (isLowerDump && lowerByPrice.price !== lowerByIncome.price) {
                        effectiveLower = lowerByPrice;
                        dumpWarning = ` [dump detected: ${lowerByIncome.income}M/s @ $${lowerByIncome.price.toFixed(2)}]`;
                    } else {
                        effectiveLower = lowerByIncome;
                    }
                    
                    lowerPrice = effectiveLower.price;
                    lowerIncome = effectiveLower.income;
                    
                    const priceDiff = competitorPrice - lowerPrice;
                    const rangeNote = adjacentRangeName ? ` [+${adjacentRangeName}]` : '';
                    
                    if (isLowerDump) {
                        suggestedPrice = Math.round((competitorPrice - 0.5) * 100) / 100;
                        priceSource = `upper ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}, lower ${lowerIncome}M/s @ $${lowerPrice.toFixed(2)}, diff $${priceDiff.toFixed(2)}${dumpWarning} → -$0.50${rangeNote}`;
                    } else if (priceDiff >= 1) {
                        suggestedPrice = Math.round((competitorPrice - 1) * 100) / 100;
                        priceSource = `upper ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}, lower ${lowerIncome}M/s @ $${lowerPrice.toFixed(2)}, diff $${priceDiff.toFixed(2)} >= $1 → -$1${rangeNote}`;
                    } else {
                        suggestedPrice = Math.round((competitorPrice - 0.5) * 100) / 100;
                        priceSource = `upper ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}, lower ${lowerIncome}M/s @ $${lowerPrice.toFixed(2)}, diff $${priceDiff.toFixed(2)} < $1 → -$0.50${rangeNote}`;
                    }
                } else {
                    suggestedPrice = Math.round((competitorPrice - 0.5) * 100) / 100;
                    priceSource = `upper ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}, no valid lower → -$0.50`;
                }
            } else {
                suggestedPrice = Math.round((competitorPrice - 0.5) * 100) / 100;
                priceSource = `upper ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}, no lower offer → -$0.50`;
            }
        } else if (offersWithIncome.length > 0) {
            // Нет офферов с income >= нашему - наш income выше всех
            const sortedByPrice = [...offersWithIncome].sort((a, b) => b.price - a.price);
            const maxPriceOffer = sortedByPrice[0];
            const maxIncomeOffer = offersWithIncome.reduce((max, o) => o.income > max.income ? o : max);
            
            competitorPrice = maxPriceOffer.price;
            competitorIncome = maxIncomeOffer.income;
            
            const incomeDiff = ourIncome - maxIncomeOffer.income;
            const extraPrice = Math.min(incomeDiff * 0.01, 5);
            suggestedPrice = Math.round((maxPriceOffer.price + 1 + extraPrice) * 100) / 100;
            priceSource = `above market (max price: $${maxPriceOffer.price.toFixed(2)}, max income: ${competitorIncome}M/s)`;
        } else {
            const minPrice = allParsedOffers[0].price;
            suggestedPrice = Math.round((minPrice - 0.5) * 100) / 100;
            priceSource = 'min price - $0.50 (no income data in offers)';
        }

        const result = {
            suggestedPrice,
            marketPrice: allParsedOffers[0].price,
            offersFound: allParsedOffers.length,
            matchingRangeCount: matchingRangeOffers.length,
            adjacentRangeCount: adjacentRangeOffers.length,
            targetMsRange,
            adjacentRange: adjacentRangeName,
            priceSource,
            brainrotName,
            competitorPrice,
            competitorIncome,
            samples: allParsedOffers.slice(0, 5).map(o => ({
                income: o.income,
                price: o.price,
                title: o.title,
                msRange: o.msRange
            }))
        };

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

    if (!brainrotName) {
        return res.status(400).json({ error: 'Missing brainrot name' });
    }

    try {
        const result = await calculateOptimalPrice(brainrotName, income);
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Экспорт для тестирования
module.exports.calculateOptimalPrice = calculateOptimalPrice;
module.exports.searchBrainrotOffers = searchBrainrotOffers;
module.exports.findEldoradoBrainrot = findEldoradoBrainrot;
