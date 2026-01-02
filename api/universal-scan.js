const https = require('https');
const { connectToDatabase } = require('./_lib/db');

/**
 * Универсальный сканер офферов на Eldorado
 * 
 * Сканирует ВСЕ офферы в категории Brainrot, ищет уникальные коды в тайтлах,
 * затем сопоставляет с зарегистрированными кодами пользователей панели.
 * 
 * Логика:
 * 1. Получаем офферы с Eldorado (все страницы категории)
 * 2. Извлекаем коды из тайтлов (#XXXXXXXX)
 * 3. Сопоставляем с offer_codes в БД
 * 4. Обновляем статусы: active/paused
 * 5. Создаём/обновляем записи в offers коллекции
 */

const ELDORADO_GAME_ID = '259';
const ELDORADO_IMAGE_BASE = 'https://fileserviceusprod.blob.core.windows.net/offerimages/';

// Паттерны для извлечения кодов из тайтлов
const CODE_PATTERNS = [
    /#([A-Z0-9]{4,12})\b/gi,     // #CODE (4-12 символов)
    /\[([A-Z0-9]{4,12})\]/gi,    // [CODE]
    /\(([A-Z0-9]{4,12})\)/gi,    // (CODE)
];

/**
 * Строит полный URL изображения
 */
function buildImageUrl(imageName) {
    if (!imageName) return null;
    if (imageName.startsWith('http')) return imageName;
    return ELDORADO_IMAGE_BASE + imageName;
}

/**
 * Получает офферы с Eldorado
 */
function fetchEldoradoOffers(pageIndex = 1, pageSize = 100, searchQuery = null) {
    return new Promise((resolve) => {
        let queryPath = `/api/flexibleOffers?gameId=${ELDORADO_GAME_ID}&category=CustomItem&te_v0=Brainrot&pageSize=${pageSize}&pageIndex=${pageIndex}&offerSortingCriterion=CreationDate&isAscending=false`;
        
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
        req.setTimeout(30000, () => {
            req.destroy();
            resolve({ error: 'timeout', results: [] });
        });
        req.end();
    });
}

/**
 * Извлекает все коды из текста
 */
function extractAllCodes(text) {
    if (!text) return [];
    
    const codes = new Set();
    
    for (const pattern of CODE_PATTERNS) {
        // Reset lastIndex for global regex
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const code = match[1].toUpperCase();
            // Фильтруем слишком короткие и числовые коды
            if (code.length >= 4 && !/^\d+$/.test(code)) {
                codes.add(code);
            }
        }
    }
    
    return Array.from(codes);
}

/**
 * Парсит income из title
 */
function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    const patterns = [
        /(\d+[.,]?\d*)\s*B\/s/i,     // Billion
        /(\d+[.,]?\d*)\s*M\/s/i,     // Million
        /l\s*\$?(\d+[.,]?\d*)\s*B/i, // l $XXX B
        /l\s*\$?(\d+[.,]?\d*)\s*M/i, // l $XXX M
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            // Для Billion умножаем на 1000
            if (pattern.source.includes('B')) {
                return value * 1000;
            }
            if (value >= 0.1 && value <= 9999) {
                return value;
            }
        }
    }
    return null;
}

/**
 * Извлекает название брейнрота из title
 */
function extractBrainrotName(title, attributes) {
    // Сначала пробуем из атрибутов
    if (attributes) {
        const brainrotAttr = attributes.find(a => 
            a.name === 'Brainrot' || a.name?.toLowerCase().includes('brainrot')
        );
        if (brainrotAttr?.value) {
            return brainrotAttr.value;
        }
    }
    
    // Пробуем извлечь из title
    if (!title) return null;
    
    // Убираем emoji и технические части
    let cleaned = title
        .replace(/[🔥🚚👾❤️💥📦🎁]/g, '')
        .replace(/#[A-Z0-9]+/gi, '')
        .replace(/\d+[.,]?\d*\s*[MB]\/s/gi, '')
        .replace(/Fast Delivery/gi, '')
        .replace(/Glitched Store/gi, '')
        .replace(/l\s*\$/gi, '')
        .trim();
    
    // Берём первую значимую часть
    const parts = cleaned.split(/[|l\-–—]/);
    if (parts.length > 0) {
        return parts[0].trim().replace(/\s+/g, ' ') || null;
    }
    
    return null;
}

/**
 * Сканирует все офферы и находит коды
 */
async function scanAllOffers(db, options = {}) {
    const {
        maxPages = 50,           // Максимум страниц для сканирования
        pageSize = 100,          // Офферов на странице
        updateDatabase = true,   // Обновлять ли БД
        searchQuery = null       // Опциональный поисковый запрос
    } = options;
    
    const codesCollection = db.collection('offer_codes');
    const offersCollection = db.collection('offers');
    const now = new Date();
    
    console.log(`🔍 Starting universal offer scan...`);
    
    // Получаем все зарегистрированные коды из БД
    const registeredCodes = await codesCollection.find({}).toArray();
    const codeToOwner = new Map();
    for (const codeDoc of registeredCodes) {
        codeToOwner.set(codeDoc.code.toUpperCase(), codeDoc);
    }
    console.log(`📋 Loaded ${registeredCodes.length} registered codes from database`);
    
    // Сканируем Eldorado
    const foundOffers = [];      // Все офферы с кодами
    const matchedOffers = [];    // Офферы с зарегистрированными кодами
    const scannedCodes = new Set(); // Все найденные коды
    
    let page = 1;
    let totalScanned = 0;
    
    while (page <= maxPages) {
        const response = await fetchEldoradoOffers(page, pageSize, searchQuery);
        
        if (response.error) {
            console.error(`❌ Error on page ${page}:`, response.error);
            break;
        }
        
        if (!response.results || response.results.length === 0) {
            console.log(`📄 Page ${page}: no more results`);
            break;
        }
        
        for (const item of response.results) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            const description = offer.offerDescription || '';
            
            // Извлекаем коды из title и description
            const titleCodes = extractAllCodes(title);
            const descCodes = extractAllCodes(description);
            const allCodes = [...new Set([...titleCodes, ...descCodes])];
            
            if (allCodes.length === 0) continue;
            
            // Получаем данные оффера
            const price = offer.pricePerUnitInUSD?.amount || 0;
            const income = parseIncomeFromTitle(title);
            const imageName = offer.mainOfferImage?.originalSizeImage || offer.mainOfferImage?.largeImage;
            const imageUrl = buildImageUrl(imageName);
            const brainrotName = extractBrainrotName(title, offer.offerAttributeIdValues);
            const msAttr = offer.offerAttributeIdValues?.find(a => a.name === 'M/s');
            
            const offerData = {
                eldoradoOfferId: offer.id,
                title: title,
                brainrotName: brainrotName,
                income: income,
                incomeRange: msAttr?.value || null,
                currentPrice: price,
                imageUrl: imageUrl,
                sellerName: item.user?.username || offer.seller?.nickname || null,
                sellerId: item.user?.id || offer.seller?.id || null,
                codes: allCodes,
                foundAt: now
            };
            
            foundOffers.push(offerData);
            
            // Проверяем каждый код на принадлежность
            for (const code of allCodes) {
                scannedCodes.add(code);
                
                const owner = codeToOwner.get(code);
                if (owner) {
                    matchedOffers.push({
                        ...offerData,
                        matchedCode: code,
                        farmKey: owner.farmKey,
                        registeredBrainrotName: owner.brainrotName
                    });
                }
            }
        }
        
        totalScanned += response.results.length;
        console.log(`📄 Page ${page}: ${response.results.length} offers, ${foundOffers.length} with codes, ${matchedOffers.length} matched`);
        
        if (response.results.length < pageSize) break;
        page++;
        
        // Задержка между страницами
        await new Promise(r => setTimeout(r, 150));
    }
    
    console.log(`\n📊 Scan complete:`);
    console.log(`   Total scanned: ${totalScanned} offers`);
    console.log(`   With codes: ${foundOffers.length} offers`);
    console.log(`   Unique codes found: ${scannedCodes.size}`);
    console.log(`   Matched to users: ${matchedOffers.length}`);
    
    // Обновляем БД если нужно
    if (updateDatabase && matchedOffers.length > 0) {
        console.log(`\n💾 Updating database...`);
        
        let updated = 0;
        let created = 0;
        
        // Группируем по farmKey для batch обновления
        const byFarmKey = new Map();
        for (const offer of matchedOffers) {
            if (!byFarmKey.has(offer.farmKey)) {
                byFarmKey.set(offer.farmKey, []);
            }
            byFarmKey.get(offer.farmKey).push(offer);
        }
        
        for (const [farmKey, offers] of byFarmKey) {
            for (const offer of offers) {
                // Обновляем offer_codes
                await codesCollection.updateOne(
                    { code: offer.matchedCode },
                    {
                        $set: {
                            status: 'active',
                            eldoradoOfferId: offer.eldoradoOfferId,
                            currentPrice: offer.currentPrice,
                            imageUrl: offer.imageUrl || null,
                            brainrotName: offer.brainrotName || offer.registeredBrainrotName,
                            income: offer.income,
                            lastSeenAt: now,
                            updatedAt: now
                        }
                    }
                );
                
                // Создаём/обновляем запись в offers коллекции
                const existingOffer = await offersCollection.findOne({
                    farmKey: farmKey,
                    offerId: offer.matchedCode
                });
                
                if (existingOffer) {
                    await offersCollection.updateOne(
                        { _id: existingOffer._id },
                        {
                            $set: {
                                status: 'active',
                                eldoradoOfferId: offer.eldoradoOfferId,
                                currentPrice: offer.currentPrice,
                                brainrotName: offer.brainrotName || existingOffer.brainrotName,
                                income: offer.income || existingOffer.income,
                                imageUrl: offer.imageUrl || existingOffer.imageUrl,
                                eldoradoTitle: offer.title,
                                sellerName: offer.sellerName,
                                sellerId: offer.sellerId,
                                lastScannedAt: now,
                                updatedAt: now
                            }
                        }
                    );
                    updated++;
                } else {
                    await offersCollection.insertOne({
                        farmKey: farmKey,
                        offerId: offer.matchedCode,
                        brainrotName: offer.brainrotName || offer.registeredBrainrotName,
                        income: offer.income,
                        currentPrice: offer.currentPrice,
                        imageUrl: offer.imageUrl,
                        eldoradoOfferId: offer.eldoradoOfferId,
                        eldoradoTitle: offer.title,
                        sellerName: offer.sellerName,
                        sellerId: offer.sellerId,
                        status: 'active',
                        lastScannedAt: now,
                        createdAt: now,
                        updatedAt: now
                    });
                    created++;
                }
            }
        }
        
        // Помечаем не найденные коды как paused
        const foundCodeSet = new Set(matchedOffers.map(o => o.matchedCode));
        const activeCodesInDb = await codesCollection.find({ 
            status: 'active',
            code: { $nin: Array.from(foundCodeSet) }
        }).toArray();
        
        let paused = 0;
        for (const codeDoc of activeCodesInDb) {
            await codesCollection.updateOne(
                { code: codeDoc.code },
                {
                    $set: {
                        status: 'paused',
                        pausedAt: now,
                        updatedAt: now
                    }
                }
            );
            
            // Также обновляем в offers
            await offersCollection.updateMany(
                { offerId: codeDoc.code, status: 'active' },
                {
                    $set: {
                        status: 'paused',
                        pausedAt: now,
                        updatedAt: now
                    }
                }
            );
            paused++;
        }
        
        console.log(`   Updated: ${updated}, Created: ${created}, Paused: ${paused}`);
    }
    
    return {
        totalScanned,
        withCodes: foundOffers.length,
        uniqueCodes: scannedCodes.size,
        matched: matchedOffers.length,
        matchedOffers: matchedOffers,
        foundCodes: Array.from(scannedCodes),
        timestamp: now.toISOString()
    };
}

// Кэш последнего сканирования
let lastScanTime = 0;
let lastScanResult = null;
const SCAN_COOLDOWN = 30000; // 30 секунд между полными сканами

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { force, maxPages, searchQuery, farmKey } = req.query;
        const now = Date.now();
        
        // Если запрос от конкретного пользователя - возвращаем только его офферы
        if (farmKey && lastScanResult && !force) {
            const userOffers = lastScanResult.matchedOffers?.filter(o => o.farmKey === farmKey) || [];
            return res.json({
                success: true,
                cached: true,
                farmKey: farmKey,
                offers: userOffers,
                count: userOffers.length,
                lastScan: new Date(lastScanTime).toISOString()
            });
        }
        
        // Проверяем cooldown для полного скана
        if (!force && lastScanResult && (now - lastScanTime) < SCAN_COOLDOWN) {
            return res.json({
                success: true,
                cached: true,
                ...lastScanResult
            });
        }
        
        const { db } = await connectToDatabase();
        
        const result = await scanAllOffers(db, {
            maxPages: parseInt(maxPages) || 50,
            searchQuery: searchQuery || null,
            updateDatabase: true
        });
        
        lastScanTime = now;
        lastScanResult = result;
        
        // Если запрос от конкретного пользователя - фильтруем результат
        if (farmKey) {
            const userOffers = result.matchedOffers?.filter(o => o.farmKey === farmKey) || [];
            return res.json({
                success: true,
                cached: false,
                farmKey: farmKey,
                offers: userOffers,
                count: userOffers.length,
                totalScanned: result.totalScanned,
                timestamp: result.timestamp
            });
        }
        
        return res.json({
            success: true,
            cached: false,
            ...result
        });
        
    } catch (error) {
        console.error('Universal scan error:', error);
        return res.status(500).json({ error: error.message });
    }
};

// Экспорт для использования в других модулях
module.exports.scanAllOffers = scanAllOffers;
module.exports.extractAllCodes = extractAllCodes;
module.exports.parseIncomeFromTitle = parseIncomeFromTitle;
