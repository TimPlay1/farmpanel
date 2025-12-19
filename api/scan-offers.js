const https = require('https');
const { connectToDatabase } = require('./_lib/db');

/**
 * API для сканирования офферов пользователя на Eldorado
 * Ищет офферы по кодам из БД (привязанным к farmKey)
 * 
 * Логика поиска:
 * 1. Берём из БД офферы пользователя (brainrotName, offerId)
 * 2. Для каждого оффера ищем на Eldorado по brainrotName (searchQuery)
 * 3. Находим оффер где в title есть наш код (#offerId)
 */

const ELDORADO_GAME_ID = '259';

/**
 * Выполняет запрос к Eldorado API с поиском по searchQuery
 * searchQuery - работает как поиск по названию брейнрота
 */
function fetchEldoradoOffers(searchQuery, pageIndex = 1, pageSize = 50) {
    return new Promise((resolve) => {
        let queryPath = `/api/flexibleOffers?gameId=${ELDORADO_GAME_ID}&category=CustomItem&te_v0=Brainrot&pageSize=${pageSize}&pageIndex=${pageIndex}&offerSortingCriterion=Price&isAscending=true`;
        
        if (searchQuery) {
            queryPath += `&searchQuery=${encodeURIComponent(searchQuery)}`;
        }

        const options = {
            hostname: 'www.eldorado.gg',
            path: queryPath,
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({
                        results: parsed.results || parsed.flexibleOffers || [],
                        totalCount: parsed.recordCount || parsed.totalCount || 0
                    });
                } catch (e) {
                    resolve({ error: e.message, results: [] });
                }
            });
        });

        req.on('error', (e) => resolve({ error: e.message, results: [] }));
        req.setTimeout(15000, () => {
            req.destroy();
            resolve({ error: 'timeout', results: [] });
        });
        req.end();
    });
}

/**
 * Извлекает код оффера из title
 * Формат: #XXXXXXXX где X - буквы и цифры (6-10 символов) в конце title
 */
function extractOfferCode(title) {
    if (!title) return null;
    
    const patterns = [
        /#([A-Z0-9]{6,10})\s*$/i,         // #CODE в конце строки
        /#([A-Z0-9]{6,10})(?:\s|$|🔥)/i,  // #CODE перед пробелом/концом/emoji
        /\b#([A-Z0-9]{6,10})\b/i,         // #CODE как отдельное слово
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            return match[1].toUpperCase();
        }
    }
    
    return null;
}

/**
 * Парсит income из title оффера
 */
function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    const patterns = [
        /(\d+[.,]?\d*)\s*M\/s/i,
        /(\d+[.,]?\d*)\s*m\/sec/i,
        /l\s*\$?(\d+[.,]?\d*)\s*[MB]/i,
        /(\d+[.,]?\d*)M\/s/i,
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
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
 * Проверяет содержит ли оффер наш код (в title или description)
 */
function offerContainsCode(offer, code) {
    const normalizedCode = code.toUpperCase();
    const title = (offer.offerTitle || '').toUpperCase();
    const description = (offer.offerDescription || '').toUpperCase();
    
    return title.includes(`#${normalizedCode}`) || description.includes(`#${normalizedCode}`);
}

/**
 * Ищет оффер на Eldorado по brainrotName и коду
 * @param {string} brainrotName - название брейнрота для поиска
 * @param {string} offerCode - код оффера для проверки в title/description
 * @param {number} maxPages - максимум страниц для поиска
 * @returns {object|null} - данные оффера или null
 */
async function findOfferOnEldorado(brainrotName, offerCode, maxPages = 10) {
    if (!offerCode) return null;
    
    const normalizedCode = offerCode.toUpperCase();
    console.log(`Searching for code #${normalizedCode} (brainrot: ${brainrotName || 'any'})`);
    
    // Стратегия 1: Поиск напрямую по коду #GS через searchQuery
    console.log('  Strategy 1: Search by offer code directly');
    const codeSearchResponse = await fetchEldoradoOffers(`#${normalizedCode}`, 1, 20);
    
    if (!codeSearchResponse.error && codeSearchResponse.results?.length) {
        for (const item of codeSearchResponse.results) {
            const offer = item.offer || item;
            if (offerContainsCode(offer, normalizedCode)) {
                const price = offer.pricePerUnitInUSD?.amount || 0;
                const income = parseIncomeFromTitle(offer.offerTitle || '');
                const msAttr = offer.offerAttributeIdValues?.find(a => a.name === 'M/s');
                const imageUrl = offer.images?.[0]?.originalUrl || offer.images?.[0]?.url || null;
                
                console.log(`  FOUND by code search: $${price}`);
                
                return {
                    eldoradoOfferId: offer.id,
                    brainrotName: brainrotName,
                    income: income,
                    incomeRange: msAttr?.value || null,
                    currentPrice: price,
                    title: offer.offerTitle,
                    imageUrl: imageUrl,
                    sellerName: offer.seller?.nickname || null,
                    sellerId: offer.seller?.id || null,
                    status: offer.status || 'active'
                };
            }
        }
    }
    
    // Стратегия 2: Поиск по названию brainrot (если указано)
    if (brainrotName) {
        console.log(`  Strategy 2: Search by brainrot name "${brainrotName}"`);
        for (let page = 1; page <= maxPages; page++) {
            const response = await fetchEldoradoOffers(brainrotName, page);
            
            if (response.error || !response.results?.length) {
                console.log(`    Page ${page}: no results or error`);
                break;
            }
            
            // Ищем оффер с нашим кодом в title или description
            for (const item of response.results) {
                const offer = item.offer || item;
                
                if (offerContainsCode(offer, normalizedCode)) {
                    const price = offer.pricePerUnitInUSD?.amount || 0;
                    const income = parseIncomeFromTitle(offer.offerTitle || '');
                    const msAttr = offer.offerAttributeIdValues?.find(a => a.name === 'M/s');
                    const imageUrl = offer.images?.[0]?.originalUrl || offer.images?.[0]?.url || null;
                    
                    console.log(`    FOUND on page ${page}: $${price}`);
                    
                    return {
                        eldoradoOfferId: offer.id,
                        brainrotName: brainrotName,
                        income: income,
                        incomeRange: msAttr?.value || null,
                        currentPrice: price,
                        title: offer.offerTitle,
                        imageUrl: imageUrl,
                        sellerName: offer.seller?.nickname || null,
                        sellerId: offer.seller?.id || null,
                        status: offer.status || 'active'
                    };
                }
            }
            
            // Небольшая задержка между страницами
            await new Promise(r => setTimeout(r, 150));
        }
    }
    
    // Стратегия 3: Поиск по "Glitched Store" чтобы найти все наши офферы
    console.log('  Strategy 3: Search by "Glitched Store"');
    for (let page = 1; page <= 3; page++) {
        const response = await fetchEldoradoOffers('Glitched Store', page, 50);
        
        if (response.error || !response.results?.length) {
            break;
        }
        
        for (const item of response.results) {
            const offer = item.offer || item;
            
            if (offerContainsCode(offer, normalizedCode)) {
                const price = offer.pricePerUnitInUSD?.amount || 0;
                const income = parseIncomeFromTitle(offer.offerTitle || '');
                const msAttr = offer.offerAttributeIdValues?.find(a => a.name === 'M/s');
                const imageUrl = offer.images?.[0]?.originalUrl || offer.images?.[0]?.url || null;
                
                console.log(`    FOUND by Glitched Store search on page ${page}: $${price}`);
                
                return {
                    eldoradoOfferId: offer.id,
                    brainrotName: brainrotName,
                    income: income,
                    incomeRange: msAttr?.value || null,
                    currentPrice: price,
                    title: offer.offerTitle,
                    imageUrl: imageUrl,
                    sellerName: offer.seller?.nickname || null,
                    sellerId: offer.seller?.id || null,
                    status: offer.status || 'active'
                };
            }
        }
        
        await new Promise(r => setTimeout(r, 150));
    }
    
    console.log(`  Not found after all strategies`);
    return null;
}

/**
 * Сканирует все офферы пользователя на Eldorado
 * @param {string} farmKey - ключ пользователя
 * @param {object} db - подключение к БД
 */
async function scanUserOffers(farmKey, db) {
    const offersCollection = db.collection('offers');
    
    // Получаем все офферы пользователя из БД
    const userOffers = await offersCollection.find({ farmKey }).toArray();
    
    if (!userOffers.length) {
        return { found: [], notFound: [], total: 0 };
    }
    
    console.log(`Scanning ${userOffers.length} offers for farmKey: ${farmKey.substring(0, 8)}...`);
    
    const found = [];
    const notFound = [];
    
    // Parallel scanning with concurrency limit
    const BATCH_SIZE = 5; // Process 5 offers at a time
    
    for (let i = 0; i < userOffers.length; i += BATCH_SIZE) {
        const batch = userOffers.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchResults = await Promise.all(batch.map(async (dbOffer) => {
            const offerCode = dbOffer.offerId;
            const brainrotName = dbOffer.brainrotName;
            
            if (!offerCode) {
                return { type: 'notFound', data: { code: null, reason: 'no_code' } };
            }
            
            if (!brainrotName) {
                return { type: 'notFound', data: { code: offerCode, reason: 'no_brainrot_name' } };
            }
            
            // Ищем оффер на Eldorado по названию брейнрота и коду
            const eldoradoOffer = await findOfferOnEldorado(brainrotName, offerCode);
            
            if (eldoradoOffer) {
                // Обновляем информацию в БД - статус меняем на active!
                await offersCollection.updateOne(
                    { farmKey, offerId: offerCode },
                    { 
                        $set: {
                            eldoradoOfferId: eldoradoOffer.eldoradoOfferId,
                            currentPrice: eldoradoOffer.currentPrice,
                            income: eldoradoOffer.income || dbOffer.income,
                            eldoradoTitle: eldoradoOffer.title,
                            imageUrl: eldoradoOffer.imageUrl || dbOffer.imageUrl,
                            sellerName: eldoradoOffer.sellerName,
                            sellerId: eldoradoOffer.sellerId,
                            status: 'active', // найден на Eldorado = активный!
                            lastScannedAt: new Date(),
                            updatedAt: new Date()
                        }
                    }
                );
                
                return {
                    type: 'found',
                    data: {
                        code: offerCode,
                        brainrotName: brainrotName,
                        eldoradoOfferId: eldoradoOffer.eldoradoOfferId,
                        currentPrice: eldoradoOffer.currentPrice,
                        income: eldoradoOffer.income || dbOffer.income,
                        imageUrl: eldoradoOffer.imageUrl,
                        status: 'active'
                    }
                };
            } else {
                // v9.6 FIX: Оффер не найден на Eldorado - НЕ удаляем!
                console.log(`  Offer ${offerCode} not found on Eldorado - marking as PAUSED`);
                
                await offersCollection.updateOne(
                    { farmKey, offerId: offerCode },
                    { 
                        $set: {
                            status: 'paused',
                            lastScannedAt: new Date(),
                            updatedAt: new Date()
                        }
                    }
                );
                
                return {
                    type: 'notFound',
                    data: {
                        code: offerCode,
                        brainrotName: brainrotName,
                        reason: 'not_visible_on_marketplace',
                        deleted: false,
                        status: 'paused'
                    }
                };
            }
        }));
        
        // Collect results from batch
        for (const result of batchResults) {
            if (result.type === 'found') {
                found.push(result.data);
            } else {
                notFound.push(result.data);
            }
        }
        
        // Small delay between batches (not between individual offers)
        if (i + BATCH_SIZE < userOffers.length) {
            await new Promise(r => setTimeout(r, 100));
        }
    }
    
    // v9.6: больше не удаляем, только помечаем как paused
    const paused = notFound.filter(o => o.status === 'paused');
    return { found, notFound, paused, deleted: [], total: userOffers.length };
}

/**
 * Vercel serverless handler
 */
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { farmKey, offerCode, brainrotName } = req.query;
        
        // Поиск конкретного оффера по brainrotName + offerCode
        if (offerCode && brainrotName) {
            const offer = await findOfferOnEldorado(brainrotName, offerCode);
            return res.json({
                success: !!offer,
                offer: offer
            });
        }
        
        // Сканирование всех офферов пользователя
        if (!farmKey) {
            return res.status(400).json({ 
                error: 'farmKey is required, or provide brainrotName + offerCode for single offer search' 
            });
        }
        
        const { db } = await connectToDatabase();
        const result = await scanUserOffers(farmKey, db);
        
        return res.json({
            success: true,
            total: result.total,
            found: result.found.length,
            notFound: result.notFound.length,
            deleted: result.deleted?.length || 0,
            offers: result.found,
            missing: result.notFound,
            deletedOffers: result.deleted || []
        });
        
    } catch (error) {
        console.error('Scan offers error:', error);
        return res.status(500).json({ error: error.message });
    }
};

// Экспорт для тестирования
module.exports.findOfferOnEldorado = findOfferOnEldorado;
module.exports.extractOfferCode = extractOfferCode;
