const https = require('https');

// Кэш для цен (хранится в памяти)
const priceCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

/**
 * Парсит доходность из title оффера
 * @param {string} title - например "Pot Hotspot | $112.5 M/s | Taco Trait 🌮"
 * @returns {number|null} - доходность в M/s или null
 */
function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    // Паттерны для парсинга доходности
    const patterns = [
        /\$?([\d.]+)\s*M\/s/i,              // $112.5 M/s
        /([\d.]+)\s*mil\/s/i,               // 112.5 mil/s
        /([\d.]+)\s*million\/s/i,           // 112.5 million/s
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            return parseFloat(match[1]);
        }
    }
    return null;
}

/**
 * Парсит диапазон доходности из фильтра (например "100-249 M/s")
 */
function parseIncomeRange(rangeStr) {
    if (!rangeStr) return null;
    const match = rangeStr.match(/([\d.]+)\s*-\s*([\d.]+)/);
    if (match) {
        return {
            min: parseFloat(match[1]),
            max: parseFloat(match[2])
        };
    }
    return null;
}

/**
 * Получить ключ кэша
 */
function getCacheKey(pitName, income) {
    return `${pitName.toLowerCase()}_${Math.floor(income / 10) * 10}`;
}

/**
 * Поиск офферов на Eldorado
 */
async function searchEldoradoOffers(searchQuery, pitAttribute = null) {
    return new Promise((resolve, reject) => {
        const queryParams = new URLSearchParams({
            gameId: 'pet-simulator-99',
            category: 'Account',
            searchQuery: searchQuery,
            pageSize: '50',
            pageIndex: '1',
            offerSortingCriterion: 'Price',
            isAscending: 'true'
        });

        // Если есть атрибут пита
        if (pitAttribute) {
            queryParams.append('offerAttributeIdsCsv', pitAttribute);
        }

        const options = {
            hostname: 'www.eldorado.gg',
            path: `/api/flexibleOffers?${queryParams.toString()}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'FarmerPanel/1.0',
                'swagger': 'Swager request'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    console.error('Failed to parse Eldorado response:', e.message);
                    resolve({ results: [] });
                }
            });
        });

        req.on('error', (e) => {
            console.error('Eldorado request error:', e.message);
            resolve({ results: [] });
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({ results: [] });
        });

        req.end();
    });
}

/**
 * Рассчитывает оптимальную цену
 */
async function calculateOptimalPrice(pitName, ourIncome) {
    const cacheKey = getCacheKey(pitName, ourIncome);
    
    // Проверяем кэш
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        // Формируем поисковый запрос
        const searchQuery = `brainrot ${pitName}`;
        
        const response = await searchEldoradoOffers(searchQuery);
        
        if (!response.results || response.results.length === 0) {
            const result = { 
                error: 'No offers found', 
                suggestedPrice: null,
                marketPrice: null 
            };
            priceCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        }

        // Обрабатываем результаты
        const offersWithIncome = [];
        
        for (const item of response.results) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            const income = parseIncomeFromTitle(title);
            const price = offer.pricePerUnit?.amount || 0;
            
            if (income && price > 0) {
                offersWithIncome.push({
                    title,
                    income,
                    price,
                    userId: offer.userId,
                    deliveryTime: offer.guaranteedDeliveryTime
                });
            }
        }

        // Сортируем по цене (низкая к высокой)
        offersWithIncome.sort((a, b) => a.price - b.price);

        if (offersWithIncome.length === 0) {
            const result = { 
                error: 'No offers with income info', 
                suggestedPrice: null,
                marketPrice: null 
            };
            priceCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        }

        // Находим границы цен
        // Нижняя граница: офферы с доходностью <= нашей
        const lowerOffers = offersWithIncome.filter(o => o.income <= ourIncome);
        // Верхняя граница: офферы с доходностью > нашей
        const higherOffers = offersWithIncome.filter(o => o.income > ourIncome);

        let suggestedPrice = null;
        let minPrice = null;
        let maxPrice = null;
        let minOffer = null;
        let maxOffer = null;

        // Берём последний (самый дорогой) из нижних офферов
        if (lowerOffers.length > 0) {
            minOffer = lowerOffers[lowerOffers.length - 1];
            minPrice = minOffer.price;
        }

        // Берём первый (самый дешёвый) из верхних офферов
        if (higherOffers.length > 0) {
            maxOffer = higherOffers[0];
            maxPrice = maxOffer.price;
        }

        // Рассчитываем оптимальную цену
        if (minPrice && maxPrice) {
            // Есть обе границы - ставим на 3% ниже верхней
            suggestedPrice = maxPrice * 0.97;
            // Но не ниже минимальной
            if (suggestedPrice < minPrice) {
                suggestedPrice = (minPrice + maxPrice) / 2;
            }
        } else if (minPrice) {
            // Только нижняя граница - ставим на 5% выше
            suggestedPrice = minPrice * 1.05;
        } else if (maxPrice) {
            // Только верхняя граница - ставим на 5% ниже
            suggestedPrice = maxPrice * 0.95;
        } else {
            // Берём среднюю цену всех офферов
            const avgPrice = offersWithIncome.reduce((sum, o) => sum + o.price, 0) / offersWithIncome.length;
            suggestedPrice = avgPrice;
        }

        // Средняя рыночная цена для отображения
        const marketPrice = offersWithIncome.length > 0 
            ? offersWithIncome.reduce((sum, o) => sum + o.price, 0) / offersWithIncome.length
            : null;

        const result = {
            pitName,
            ourIncome,
            suggestedPrice: suggestedPrice ? Math.round(suggestedPrice * 100) / 100 : null,
            marketPrice: marketPrice ? Math.round(marketPrice * 100) / 100 : null,
            priceRange: {
                min: minPrice,
                max: maxPrice
            },
            minOffer: minOffer ? {
                title: minOffer.title,
                price: minOffer.price,
                income: minOffer.income
            } : null,
            maxOffer: maxOffer ? {
                title: maxOffer.title,
                price: maxOffer.price,
                income: maxOffer.income
            } : null,
            totalOffersAnalyzed: offersWithIncome.length,
            lowestPrice: offersWithIncome[0]?.price || null,
            highestPrice: offersWithIncome[offersWithIncome.length - 1]?.price || null
        };

        // Сохраняем в кэш
        priceCache.set(cacheKey, { data: result, timestamp: Date.now() });
        
        return result;
    } catch (error) {
        console.error('Error calculating price:', error);
        return { 
            error: error.message, 
            suggestedPrice: null,
            marketPrice: null 
        };
    }
}

/**
 * Получить цены для нескольких брейнротов
 */
async function getBulkPrices(brainrots) {
    const results = [];
    
    for (const brainrot of brainrots) {
        const result = await calculateOptimalPrice(
            brainrot.pitName, 
            brainrot.income
        );
        results.push({
            ...brainrot,
            pricing: result
        });
        
        // Задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return results;
}

// Vercel serverless function handler
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // GET - получить цену для одного брейнрота
        if (req.method === 'GET') {
            const { pitName, income } = req.query;
            
            if (!pitName || !income) {
                return res.status(400).json({ 
                    error: 'pitName and income are required' 
                });
            }
            
            const result = await calculateOptimalPrice(
                pitName, 
                parseFloat(income)
            );
            
            return res.status(200).json(result);
        }
        
        // POST - получить цены для нескольких брейнротов
        if (req.method === 'POST') {
            const { brainrots } = req.body;
            
            if (!Array.isArray(brainrots) || brainrots.length === 0) {
                return res.status(400).json({ 
                    error: 'brainrots array is required' 
                });
            }
            
            // Ограничиваем до 20 запросов за раз
            const limitedBrainrots = brainrots.slice(0, 20);
            const results = await getBulkPrices(limitedBrainrots);
            
            return res.status(200).json({ results });
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
