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
 * Примеры: "37.5M/s", "37 M/S", "46,8M/S", "37.5 m/s", "1.5B/s", "1B/S", "1b"
 * B/s = Billions per second, конвертируется в M/s (* 1000)
 */
function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    // Сначала проверяем B/s (Billions) - они должны конвертироваться в M/s
    const bPatterns = [
        /\[?\$?(\d+[.,]?\d*)\s*B\/s\]?/i,      // 1.5B/s, [1B/S], [$1B/s]
        /(\d+[.,]?\d*)\s*b\/sec/i,              // 1b/sec
        /(\d+[.,]?\d*)\s*bil\/s/i,              // 1bil/s
        /(\d+[.,]?\d*)\s*billion/i,             // 1.5 billion
        /(\d+[.,]?\d*)B\s/i,                    // 1B (с пробелом после)
        /(\d+[.,]?\d*)B$/i,                     // 1b (в конце строки)
        /\[(\d+[.,]?\d*)B\]/i,                  // [1B]
    ];
    
    for (const pattern of bPatterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            // B/s -> M/s: умножаем на 1000
            const msValue = value * 1000;
            if (msValue >= 1000 && msValue <= 99999) {
                return msValue;
            }
        }
    }
    
    // Затем проверяем M/s паттерны
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
 * Рассчитывает оптимальную цену для брейнрота
 */
async function calculateOptimalPrice(brainrotName, ourIncome) {
    // Кэш по M/s диапазону + точному income (округлённому до 5)
    const targetMsRange = getMsRangeForIncome(ourIncome);
    const cacheKey = `${brainrotName.toLowerCase()}_${targetMsRange}_${Math.round(ourIncome / 5) * 5}`;
    
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

        // Парсим офферы из нужного M/s диапазона
        const offersToProcess = matchingRangeOffers.length > 0 ? matchingRangeOffers : allOffers;
        const parsedOffers = [];
        
        for (const item of offersToProcess) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            // ВАЖНО: используем только ТОЧНЫЙ income из title для upper/lower расчётов
            // НЕ используем среднее значение диапазона - это создаёт ложные совпадения
            let income = parseIncomeFromTitle(title);
            const price = offer.pricePerUnitInUSD?.amount || 0;
            const msAttr = offer.offerAttributeIdValues?.find(a => a.name === 'M/s');
            
            // Если income не указан в title - помечаем как "fromRange" для отдельной обработки
            const incomeFromTitle = !!income;
            if (!income && msAttr?.value) {
                // Используем МИНИМУМ диапазона (а не среднее) как fallback
                // Это консервативнее - оффер точно не хуже этого значения
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
                    incomeFromTitle // true если income точно из title
                });
            }
        }

        parsedOffers.sort((a, b) => a.price - b.price);

        if (parsedOffers.length === 0) {
            const result = { 
                error: 'No offers with price', 
                suggestedPrice: null,
                brainrotName 
            };
            priceCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        }

        // ЛОГИКА РАСЧЁТА ЦЕНЫ:
        // 1. Ищем "верхний" оффер - первый с income >= наш (минимальная цена среди них)
        //    ВАЖНО: приоритет офферам с точным income из title (incomeFromTitle=true)
        // 2. Ищем "нижний" оффер - оффер с income < наш, но с МАКСИМАЛЬНОЙ ценой
        //    (это показывает "потолок" цен для брейнротов хуже нашего)
        // 3. Если разница цен (верхний - нижний) >= $1 → ставим верхний.price - $1
        // 4. Если разница < $1 или нижнего нет → ставим верхний.price - $0.50
        
        // Фильтруем офферы: сначала только с точным income из title
        const offersWithExactIncome = parsedOffers.filter(o => o.income > 0 && o.incomeFromTitle);
        // Fallback на все офферы с income (включая из диапазона)
        const offersWithAnyIncome = parsedOffers.filter(o => o.income > 0);
        
        // Используем точные данные если есть, иначе fallback
        const offersWithIncome = offersWithExactIncome.length >= 3 ? offersWithExactIncome : offersWithAnyIncome;
        const usingExactIncome = offersWithExactIncome.length >= 3;
        
        const upperOffers = offersWithIncome.filter(o => o.income >= ourIncome);
        const lowerOffers = offersWithIncome.filter(o => o.income < ourIncome);
        
        let suggestedPrice;
        let priceSource;
        let competitorPrice = null;
        let competitorIncome = null;
        let lowerPrice = null;
        let lowerIncome = null;

        if (upperOffers.length > 0) {
            // Нашли офферы с доходностью >= нашей
            // Берём минимальную цену среди них (уже отсортировано по цене)
            const upperOffer = upperOffers[0];
            competitorPrice = upperOffer.price;
            competitorIncome = upperOffer.income;
            
            // Ищем нижний оффер:
            // - income < наш (хуже по доходности)
            // - price < upper.price (дешевле чем upper)
            // Среди таких берём с МАКСИМАЛЬНЫМ income (ближайший к нашему по доходности)
            if (lowerOffers.length > 0) {
                // Фильтруем только те что дешевле upper
                const validLower = lowerOffers.filter(o => o.price < competitorPrice);
                
                if (validLower.length > 0) {
                    // Сортируем по income desc (ближайший к нашему = самый высокий)
                    // При одинаковом income берём с максимальной ценой
                    const sortedLower = [...validLower].sort((a, b) => {
                        if (b.income !== a.income) return b.income - a.income;
                        return b.price - a.price;
                    });
                    const lowerOffer = sortedLower[0];
                    lowerPrice = lowerOffer.price;
                    lowerIncome = lowerOffer.income;
                    
                    const priceDiff = competitorPrice - lowerPrice;
                    
                    if (priceDiff >= 1) {
                        // Разница >= $1 - ставим на $1 меньше upper
                        suggestedPrice = Math.round((competitorPrice - 1) * 100) / 100;
                        priceSource = `upper ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}, lower ${lowerIncome}M/s @ $${lowerPrice.toFixed(2)}, diff $${priceDiff.toFixed(2)} >= $1 → -$1`;
                    } else {
                        // Разница < $1 - ставим на $0.50 меньше upper
                        suggestedPrice = Math.round((competitorPrice - 0.5) * 100) / 100;
                        priceSource = `upper ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}, lower ${lowerIncome}M/s @ $${lowerPrice.toFixed(2)}, diff $${priceDiff.toFixed(2)} < $1 → -$0.50`;
                    }
                } else {
                    // Нет valid lower (все lower дороже upper) - ставим -$0.50
                    suggestedPrice = Math.round((competitorPrice - 0.5) * 100) / 100;
                    priceSource = `upper ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}, no valid lower (all lower >= upper price) → -$0.50`;
                }
            } else {
                // Нижнего оффера нет - ставим на $0.50 меньше верхнего
                suggestedPrice = Math.round((competitorPrice - 0.5) * 100) / 100;
                priceSource = `upper ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}, no lower offer → -$0.50`;
            }
        } else if (offersWithIncome.length > 0) {
            // Нет офферов с income >= нашему
            // Наш income выше всех на рынке - берём максимальную цену и добавляем немного
            // Сортируем по цене desc чтобы найти максимальную цену на рынке
            const sortedByPrice = [...offersWithIncome].sort((a, b) => b.price - a.price);
            const maxPriceOffer = sortedByPrice[0];
            
            // Также находим оффер с максимальным income для сравнения
            const maxIncomeOffer = offersWithIncome.reduce((max, o) => o.income > max.income ? o : max);
            
            competitorPrice = maxPriceOffer.price;
            competitorIncome = maxIncomeOffer.income;
            
            // Наш income выше рынка - ставим на $1-2 выше максимальной цены на рынке
            // Не завышаем пропорционально, просто немного выше
            const incomeDiff = ourIncome - maxIncomeOffer.income;
            const extraPrice = Math.min(incomeDiff * 0.01, 5); // Максимум +$5
            suggestedPrice = Math.round((maxPriceOffer.price + 1 + extraPrice) * 100) / 100;
            priceSource = `above market (max price: $${maxPriceOffer.price.toFixed(2)}, max income: ${competitorIncome}M/s)`;
        } else {
            // Никто не указывает income - берём минимальную цену - $0.50
            const minPrice = parsedOffers[0].price;
            suggestedPrice = Math.round((minPrice - 0.5) * 100) / 100;
            priceSource = 'min price - $0.50 (no income data in offers)';
        }

        const result = {
            suggestedPrice,
            marketPrice: parsedOffers[0].price,
            offersFound: parsedOffers.length,
            matchingRangeCount: matchingRangeOffers.length,
            targetMsRange,
            priceSource,
            brainrotName,
            competitorPrice,
            competitorIncome,
            samples: parsedOffers.slice(0, 5).map(o => ({
                income: o.income,
                price: o.price,
                title: o.title
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
