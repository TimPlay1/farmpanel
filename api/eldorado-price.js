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
 * - offerAttributeIdsCsv = ID атрибута M/s range
 * @param {number} pageIndex - номер страницы
 * @param {string} msRangeAttrId - ID атрибута M/s range (например "0-8" для 1+ B/s)
 * @param {string} brainrotName - имя брейнрота для фильтрации (опционально)
 */
function fetchEldorado(pageIndex = 1, msRangeAttrId = null, brainrotName = null) {
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
        
        // Добавляем фильтр по M/s диапазону
        if (msRangeAttrId) {
            params.set('offerAttributeIdsCsv', msRangeAttrId);
        }
        
        // Добавляем фильтр по имени брейнрота
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
                'swagger': 'Swager request'  // Обязательный header из swagger
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
 * 1. Устанавливаем offerAttributeIdsCsv фильтр для M/s диапазона
 * 2. Устанавливаем tradeEnvironmentValue2 фильтр для брейнрота
 * 3. Сортировка ascending (low to high по цене)
 * 4. Ищем upper (income >= наш) на ВСЕХ страницах
 * 5. Lower ищем на ТОЙ ЖЕ странице что и upper
 * 
 * @param {string} brainrotName - имя брейнрота
 * @param {number} targetIncome - целевой income
 * @param {number} maxPages - максимум страниц для поиска
 * @returns {Object} - upper оффер, lower оффер, все офферы страницы
 */
async function searchBrainrotOffers(brainrotName, targetIncome = 0, maxPages = 50) {
    const eldoradoInfo = findEldoradoBrainrot(brainrotName);
    // Используем точное имя из mapping или оригинальное имя (Eldorado API сам разберётся)
    const eldoradoName = eldoradoInfo?.name || brainrotName;
    const targetMsRange = getMsRange(targetIncome);
    const msRangeAttrId = getMsRangeAttrId(targetMsRange);
    
    // ВСЕГДА пробуем использовать имя брейнрота как фильтр
    // Eldorado API сам вернёт результаты если брейнрот существует в их системе
    // Это позволяет работать с новыми брейнротами без обновления mapping
    const isInEldoradoList = !!eldoradoInfo;
    
    console.log('Searching:', brainrotName, '| Eldorado name:', eldoradoName, '| Target M/s:', targetMsRange, '| attr_id:', msRangeAttrId, '| Target income:', targetIncome, '| In mapping:', isInEldoradoList);
    
    let upperOffer = null;
    let lowerOffer = null;
    let upperPage = 0;
    const allPageOffers = []; // Все офферы со страницы где найден upper
    const seenIds = new Set();
    let totalPages = 0;
    let usedNameFilter = true; // Флаг использования фильтра по имени
    
    for (let page = 1; page <= maxPages; page++) {
        // ВСЕГДА передаём имя брейнрота как фильтр - Eldorado API автоматически 
        // найдёт совпадение если брейнрот существует в их системе
        let response = await fetchEldorado(page, msRangeAttrId, usedNameFilter ? eldoradoName : null);
        
        if (page === 1) {
            totalPages = response.totalPages || 0;
            console.log('Total pages in range:', totalPages, '| Name filter:', usedNameFilter);
            
            // Если с фильтром по имени 0 результатов - пробуем без него (fallback для новых брейнротов)
            if (totalPages === 0 && usedNameFilter) {
                console.log('No results with name filter, trying without...');
                usedNameFilter = false;
                response = await fetchEldorado(page, msRangeAttrId, null);
                totalPages = response.totalPages || 0;
                console.log('Without name filter - total pages:', totalPages);
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
            
            // Если использовали фильтр по имени - API уже отфильтровал, доверяем результатам
            // Если НЕ использовали фильтр - нужно проверить title (fallback режим)
            let matches = true;
            
            if (!usedNameFilter) {
                // Fallback: фильтруем по title вручную
                const titleContainsName = offerTitle.toLowerCase().includes(brainrotName.toLowerCase());
                matches = titleContainsName;
            }
            
            if (!matches) continue;
            
            // НЕ проверяем M/s атрибут - API уже отфильтровал по offerAttributeIdsCsv
            
            // Пропускаем офферы от нашего магазина
            if (isOurStoreOffer(offer)) continue;
            
            const offerId = offer.id;
            if (seenIds.has(offerId)) continue;
            seenIds.add(offerId);
            
            // Парсим income из title С ВАЛИДАЦИЕЙ по M/s диапазону
            // Это защищает от манипуляций типа "2.7B GET 111M/S" в категории 100-249 M/s
            const parsedIncome = parseIncomeFromTitle(offerTitle, offerMsRange);
            const price = offer.pricePerUnitInUSD?.amount || 0;
            
            if (price <= 0) continue;
            
            const offerData = {
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
            
            // Нашли upper (и возможно lower) - можно остановиться
            console.log('Upper found at page', page, ', stopping search. Total offers collected:', allPageOffers.length);
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
    
    console.log('Search complete. Upper:', upperOffer ? `${upperOffer.income}M/s @ $${upperOffer.price.toFixed(2)}` : 'none', '| Lower:', lowerOffer ? `${lowerOffer.income}M/s @ $${lowerOffer.price.toFixed(2)}` : 'none');
    
    return {
        upperOffer,
        lowerOffer,
        allPageOffers,
        targetMsRange,
        isInEldoradoList
    };
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
        // Ищем офферы брейнрота в нужном M/s диапазоне
        const searchResult = await searchBrainrotOffers(brainrotName, ourIncome);
        const { upperOffer, lowerOffer, allPageOffers, targetMsRange: msRange, isInEldoradoList } = searchResult;
        
        let suggestedPrice;
        let priceSource;
        let competitorPrice = null;
        let competitorIncome = null;
        let lowerPrice = null;
        let lowerIncome = null;

        if (upperOffer) {
            // Нашли upper (income >= наш)
            competitorPrice = upperOffer.price;
            competitorIncome = upperOffer.income;
            
            if (lowerOffer) {
                // Есть и lower (income < наш, на той же странице)
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
                // Нет lower - ставим на $0.50 меньше upper
                suggestedPrice = Math.round((competitorPrice - 0.5) * 100) / 100;
                priceSource = `upper ${competitorIncome}M/s @ $${competitorPrice.toFixed(2)}, no lower on same page → -$0.50`;
            }
        } else if (allPageOffers.length > 0) {
            // Upper не найден - мы выше рынка
            // Берём оффер с максимальным income, среди них - с максимальной ценой
            const maxIncomeOffer = allPageOffers.reduce((max, o) => o.income > max.income ? o : max);
            const sameIncomeOffers = allPageOffers.filter(o => o.income === maxIncomeOffer.income);
            const maxPriceOffer = sameIncomeOffers.reduce((max, o) => o.price > max.price ? o : max);
            
            competitorPrice = maxPriceOffer.price;
            competitorIncome = maxIncomeOffer.income;
            
            // Выше рынка - ставим на $0.50 ниже max price
            suggestedPrice = Math.round((maxPriceOffer.price - 0.5) * 100) / 100;
            priceSource = `above market (max: $${maxPriceOffer.price.toFixed(2)} @ ${maxPriceOffer.income}M/s, our: ${ourIncome}M/s) → -$0.50`;
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

        const result = {
            suggestedPrice,
            marketPrice: upperOffer?.price || competitorPrice,
            offersFound: allPageOffers.length,
            targetMsRange: msRange,
            priceSource,
            brainrotName,
            competitorPrice,
            competitorIncome,
            lowerPrice,
            lowerIncome,
            isInEldoradoList,
            samples: allPageOffers.slice(0, 5).map(o => ({
                income: o.income,
                price: o.price,
                title: o.title?.substring(0, 60)
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
module.exports.parseIncomeFromTitle = parseIncomeFromTitle;
