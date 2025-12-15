const https = require('https');

// Кэш для цен (хранится в памяти)
const priceCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 минут

// Steal a Brainrot gameId на Eldorado
const ELDORADO_GAME_ID = '259';

/**
 * Парсит доходность из title оффера
 */
function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    const patterns = [
        /([\d.,]+)\s*M\/s/i,
        /([\d.,]+)\s*m\/sec/i,
        /([\d.,]+)\s*mil\/s/i,
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            return parseFloat(match[1].replace(',', '.'));
        }
    }
    return null;
}

/**
 * Получить ключ кэша
 */
function getCacheKey(brainrotName, income) {
    const normalizedName = brainrotName.toLowerCase().replace(/\s+/g, '-');
    return `${normalizedName}_${Math.floor(income / 50) * 50}`;
}

/**
 * Загружает офферы с Eldorado API
 */
function fetchOffers(pageIndex = 1, pageSize = 50) {
    return new Promise((resolve) => {
        const queryParams = new URLSearchParams({
            gameId: ELDORADO_GAME_ID,
            category: 'CustomItem',
            pageSize: pageSize.toString(),
            pageIndex: pageIndex.toString(),
            offerSortingCriterion: 'Price',
            isAscending: 'true'
        });

        const options = {
            hostname: 'www.eldorado.gg',
            path: `/api/flexibleOffers?${queryParams.toString()}`,
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
                    if (parsed.code && parsed.code !== 200) {
                        resolve({ results: [], error: parsed.messages });
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    resolve({ results: [], error: e.message });
                }
            });
        });

        req.on('error', (e) => resolve({ results: [], error: e.message }));
        req.setTimeout(10000, () => { req.destroy(); resolve({ results: [], error: 'timeout' }); });
        req.end();
    });
}

/**
 * Ищет офферы по имени брейнрота, загружая несколько страниц
 */
async function searchOffersByName(brainrotName) {
    const nameLower = brainrotName.toLowerCase();
    const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2);
    
    if (nameWords.length === 0) {
        return [];
    }
    
    const matching = [];
    const pagesToCheck = 20; // Проверяем 20 страниц (1000 офферов)
    
    // Загружаем страницы последовательно с паузами для избежания rate limiting
    for (let page = 1; page <= pagesToCheck; page++) {
        const response = await fetchOffers(page, 50);
        
        if (response.error) {
            console.log(`Page ${page} error:`, response.error);
            // Если rate limited - выходим
            if (response.error.includes && response.error.includes('1015')) {
                break;
            }
            continue;
        }
        
        if (!response.results || response.results.length === 0) {
            break;
        }
        
        // Ищем совпадения
        for (const item of response.results) {
            const title = (item.offer?.offerTitle || '').toLowerCase();
            const hasMatch = nameWords.some(word => title.includes(word));
            if (hasMatch) {
                matching.push(item);
            }
        }
        
        // Пауза между запросами для избежания rate limiting
        if (page < pagesToCheck) {
            await new Promise(r => setTimeout(r, 500));
        }
    }
    
    return matching;
}

/**
 * Рассчитывает оптимальную цену для брейнрота
 */
async function calculateOptimalPrice(brainrotName, ourIncome) {
    const cacheKey = getCacheKey(brainrotName, ourIncome);
    
    // Проверяем кэш
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        const matchingOffers = await searchOffersByName(brainrotName);
        
        if (!matchingOffers || matchingOffers.length === 0) {
            const result = { 
                error: 'No offers found', 
                suggestedPrice: null,
                marketPrice: null,
                brainrotName 
            };
            priceCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        }

        // Обрабатываем результаты
        const offersWithPrice = [];
        
        for (const item of matchingOffers) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            const income = parseIncomeFromTitle(title);
            const price = offer.pricePerUnitInUSD?.amount || 0;
            
            if (price > 0) {
                offersWithPrice.push({
                    title,
                    income: income || 0,
                    price
                });
            }
        }

        // Сортируем по цене
        offersWithPrice.sort((a, b) => a.price - b.price);

        if (offersWithPrice.length === 0) {
            const result = { 
                error: 'No priced offers', 
                suggestedPrice: null,
                marketPrice: null,
                brainrotName
            };
            priceCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        }

        // Офферы с данными о доходности
        const offersWithIncome = offersWithPrice.filter(o => o.income > 0);
        
        let suggestedPrice = null;
        let minPrice = null;
        let maxPrice = null;

        if (offersWithIncome.length > 0 && ourIncome > 0) {
            const lowerOffers = offersWithIncome.filter(o => o.income <= ourIncome);
            const higherOffers = offersWithIncome.filter(o => o.income > ourIncome);

            if (lowerOffers.length > 0) {
                minPrice = lowerOffers[lowerOffers.length - 1].price;
            }

            if (higherOffers.length > 0) {
                maxPrice = higherOffers[0].price;
            }

            if (minPrice && maxPrice) {
                suggestedPrice = (minPrice + maxPrice) / 2 * 0.95;
            } else if (minPrice) {
                suggestedPrice = minPrice * 1.03;
            } else if (maxPrice) {
                suggestedPrice = maxPrice * 0.95;
            }
        }

        // Средняя рыночная цена
        const marketPrice = offersWithPrice.reduce((sum, o) => sum + o.price, 0) / offersWithPrice.length;

        if (!suggestedPrice && offersWithPrice.length > 0) {
            suggestedPrice = offersWithPrice[0].price;
        }

        const result = {
            brainrotName,
            ourIncome,
            suggestedPrice: suggestedPrice ? Math.round(suggestedPrice * 100) / 100 : null,
            marketPrice: marketPrice ? Math.round(marketPrice * 100) / 100 : null,
            priceRange: {
                min: minPrice ? Math.round(minPrice * 100) / 100 : null,
                max: maxPrice ? Math.round(maxPrice * 100) / 100 : null
            },
            totalOffersAnalyzed: offersWithPrice.length,
            lowestPrice: offersWithPrice[0]?.price ? Math.round(offersWithPrice[0].price * 100) / 100 : null
        };

        priceCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    } catch (error) {
        console.error('Error calculating price:', error);
        return { 
            error: error.message, 
            suggestedPrice: null,
            marketPrice: null,
            brainrotName
        };
    }
}

// Vercel serverless function handler
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            const { brainrotName, pitName, income } = req.query;
            const name = brainrotName || pitName;
            
            if (!name || !income) {
                return res.status(400).json({ 
                    error: 'brainrotName and income are required' 
                });
            }
            
            const result = await calculateOptimalPrice(name, parseFloat(income));
            return res.status(200).json(result);
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Eldorado price error:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    }
};
