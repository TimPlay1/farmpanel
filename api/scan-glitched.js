const https = require('https');
const { connectToDatabase } = require('./_lib/db');

/**
 * Быстрый сканер офферов Glitched Store
 * Делает ОДИН запрос к Eldorado для получения всех офферов магазина
 * Затем сопоставляет с БД по кодам и обновляет статусы/цены
 */

const ELDORADO_GAME_ID = '259';
const STORE_SEARCH_QUERY = 'Glitched Store'; // Название магазина в title офферов

/**
 * Получает все офферы с Eldorado по searchQuery
 */
function fetchEldoradoOffers(searchQuery, pageIndex = 1, pageSize = 100) {
    return new Promise((resolve) => {
        // НЕ используем te_v0=Brainrot - он ломает поиск по searchQuery
        let queryPath = `/api/flexibleOffers?gameId=${ELDORADO_GAME_ID}&category=CustomItem&pageSize=${pageSize}&pageIndex=${pageIndex}&offerSortingCriterion=Price&isAscending=true`;
        
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
        req.setTimeout(20000, () => {
            req.destroy();
            resolve({ error: 'timeout', results: [] });
        });
        req.end();
    });
}

/**
 * Извлекает код оффера из title (#GSXXXXXX)
 */
function extractOfferCode(title) {
    if (!title) return null;
    const match = title.match(/#([A-Z0-9]{6,10})/i);
    return match ? match[1].toUpperCase() : null;
}

/**
 * Парсит income из title
 */
function parseIncomeFromTitle(title) {
    if (!title) return null;
    const patterns = [
        /\$?(\d+[.,]?\d*)\s*M\/s/i,
        /l\s*\$?(\d+[.,]?\d*)\s*[MB]/i,
    ];
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            if (value >= 1 && value <= 9999) return value;
        }
    }
    return null;
}

/**
 * Быстрое сканирование всех офферов Glitched Store
 */
async function scanGlitchedStore(db) {
    const offersCollection = db.collection('offers');
    const now = new Date();
    
    console.log('🔍 Scanning Glitched Store offers on Eldorado...');
    
    // Собираем все офферы магазина со всех страниц
    const allEldoradoOffers = [];
    let page = 1;
    const maxPages = 10;
    
    while (page <= maxPages) {
        const response = await fetchEldoradoOffers(STORE_SEARCH_QUERY, page, 100);
        
        if (response.error) {
            console.error(`Error fetching page ${page}:`, response.error);
            break;
        }
        
        if (!response.results || response.results.length === 0) {
            break;
        }
        
        // Фильтруем только офферы с "Glitched Store" в названии
        for (const item of response.results) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            
            if (title.includes('Glitched Store') || title.includes('👾')) {
                const code = extractOfferCode(title);
                const eldoradoId = offer.id;
                
                // Добавляем все офферы магазина (с кодом или без)
                allEldoradoOffers.push({
                    code: code, // может быть null
                    title: title,
                    price: offer.pricePerUnitInUSD?.amount || 0,
                    income: parseIncomeFromTitle(title),
                    imageUrl: offer.mainOfferImage?.originalSizeImage || null,
                    eldoradoId: eldoradoId,
                    sellerName: item.user?.username || null
                });
            }
        }
        
        console.log(`  Page ${page}: found ${response.results.length} offers, ${allEldoradoOffers.length} total Glitched`);
        
        if (response.results.length < 100) break;
        page++;
        
        // Небольшая задержка между страницами
        await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`📊 Found ${allEldoradoOffers.length} Glitched Store offers on Eldorado`);
    
    // Создаём Maps для быстрого поиска по коду и по eldoradoId
    const eldoradoByCode = new Map();
    const eldoradoById = new Map();
    for (const offer of allEldoradoOffers) {
        if (offer.code) {
            eldoradoByCode.set(offer.code, offer);
        }
        if (offer.eldoradoId) {
            eldoradoById.set(offer.eldoradoId, offer);
        }
    }
    
    // Получаем все офферы из БД (всех пользователей)
    const dbOffers = await offersCollection.find({}).toArray();
    console.log(`📂 Found ${dbOffers.length} offers in database`);
    
    let updated = 0;
    let markedActive = 0;
    let markedPaused = 0;
    
    // Обновляем статусы
    for (const dbOffer of dbOffers) {
        const code = dbOffer.offerId?.replace(/^#/, '').toUpperCase();
        
        // Ищем сначала по коду, потом по eldoradoId
        let eldoradoOffer = null;
        if (code) {
            eldoradoOffer = eldoradoByCode.get(code);
        }
        if (!eldoradoOffer && dbOffer.eldoradoOfferId) {
            eldoradoOffer = eldoradoById.get(dbOffer.eldoradoOfferId);
        }
        
        if (eldoradoOffer) {
            // Найден на Eldorado - обновляем данные
            await offersCollection.updateOne(
                { _id: dbOffer._id },
                {
                    $set: {
                        status: 'active',
                        currentPrice: eldoradoOffer.price,
                        income: eldoradoOffer.income || dbOffer.income,
                        imageUrl: eldoradoOffer.imageUrl || dbOffer.imageUrl,
                        eldoradoOfferId: eldoradoOffer.eldoradoId,
                        lastScannedAt: now,
                        updatedAt: now
                    }
                }
            );
            updated++;
            if (dbOffer.status !== 'active') markedActive++;
        } else {
            // Не найден на Eldorado - помечаем как paused
            if (dbOffer.status === 'active') {
                await offersCollection.updateOne(
                    { _id: dbOffer._id },
                    {
                        $set: {
                            status: 'paused',
                            pausedAt: now,
                            lastScannedAt: now,
                            updatedAt: now
                        }
                    }
                );
                markedPaused++;
            }
        }
    }
    
    console.log(`✅ Scan complete: ${updated} updated, ${markedActive} activated, ${markedPaused} paused`);
    
    return {
        eldoradoCount: allEldoradoOffers.length,
        dbCount: dbOffers.length,
        updated,
        markedActive,
        markedPaused,
        timestamp: now.toISOString()
    };
}

// Кэш последнего сканирования (чтобы не сканировать слишком часто)
let lastScanTime = 0;
let lastScanResult = null;
const SCAN_COOLDOWN = 30000; // 30 секунд между сканами

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { force, debug } = req.query;
        const now = Date.now();
        
        // Debug mode - показывает сырой ответ от Eldorado
        if (debug) {
            const rawResponse = await fetchEldoradoOffers(STORE_SEARCH_QUERY, 1, 5);
            return res.json({
                debug: true,
                searchQuery: STORE_SEARCH_QUERY,
                rawResponse: rawResponse,
                firstItem: rawResponse.results?.[0] || null
            });
        }
        
        // Проверяем cooldown
        if (!force && lastScanResult && (now - lastScanTime) < SCAN_COOLDOWN) {
            return res.json({
                success: true,
                cached: true,
                ...lastScanResult
            });
        }
        
        const { db } = await connectToDatabase();
        const result = await scanGlitchedStore(db);
        
        lastScanTime = now;
        lastScanResult = result;
        
        return res.json({
            success: true,
            cached: false,
            ...result
        });
        
    } catch (error) {
        console.error('Glitched scan error:', error);
        return res.status(500).json({ error: error.message });
    }
};
