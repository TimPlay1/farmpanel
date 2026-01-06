const https = require('https');
const { connectToDatabase } = require('./_lib/db');

/**
 * Универсальный сканер офферов v10.6.0
 * Ищет офферы по уникальным кодам (#XXXXXX) напрямую на Eldorado
 * Поддерживает любые названия магазинов (не только Glitched Store)
 * 
 * v10.6.0 изменения:
 * - Добавлен парсинг мутации из offerAttributeIdValues
 * - Мутация сохраняется в БД при каждом сканировании
 */

const ELDORADO_GAME_ID = '259';
const ELDORADO_IMAGE_BASE = 'https://fileserviceusprod.blob.core.windows.net/offerimages/';

// v10.6.0: Маппинг ID мутации -> название
const MUTATION_ID_TO_NAME = {
    '1-0': null, '1-1': 'Gold', '1-2': 'Diamond', '1-3': 'Bloodrot',
    '1-4': 'Candy', '1-5': 'Lava', '1-6': 'Galaxy', '1-7': 'Yin-Yang',
    '1-8': 'Radioactive', '1-9': 'Rainbow', '1-10': 'Cursed'
};

/**
 * v10.6.0: Извлекает мутацию из атрибутов Eldorado offer
 */
function extractMutationFromAttributes(attributes) {
    if (!attributes || !Array.isArray(attributes)) return null;
    const mutAttr = attributes.find(a => a.name === 'Mutations' || a.name === 'Mutation');
    if (mutAttr?.value && mutAttr.value !== 'None') {
        return mutAttr.value;
    }
    const mutById = attributes.find(a => a.id?.startsWith('1-') && a.id !== '1-0');
    if (mutById) return MUTATION_ID_TO_NAME[mutById.id] || null;
    return null;
}

/**
 * Строит полный URL изображения из имени файла
 * Eldorado хранит изображения офферов в Azure Blob Storage
 */
function buildImageUrl(imageName) {
    if (!imageName) return null;
    // Если уже полный URL - возвращаем как есть
    if (imageName.startsWith('http')) return imageName;
    return ELDORADO_IMAGE_BASE + imageName;
}

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
 * Быстрое сканирование офферов - универсальный подход v10.4.0
 * 1. Собирает все коды офферов из БД
 * 2. Ищет каждый код на Eldorado напрямую по #CODE (ПАРАЛЛЕЛЬНО!)
 * 3. Обновляем статусы в БД
 * 
 * v10.5.0: Последовательные запросы (Cloudflare rate limit 1015)
 */
async function scanGlitchedStore(db) {
    const offersCollection = db.collection('offers');
    const now = new Date();
    
    console.log('🔍 Glitched scanner v10.5.0 starting (sequential mode)...');
    
    // Получаем все офферы из БД с кодами
    const dbOffers = await offersCollection.find({ 
        offerId: { $exists: true, $ne: null, $ne: '' }
    }).toArray();
    
    console.log(`📂 Found ${dbOffers.length} offers with codes in database`);
    
    if (dbOffers.length === 0) {
        return {
            eldoradoCount: 0,
            dbCount: 0,
            updated: 0,
            markedActive: 0,
            markedPaused: 0,
            timestamp: now.toISOString()
        };
    }
    
    let updated = 0;
    let markedActive = 0;
    let markedPaused = 0;
    let foundOnEldorado = 0;
    let skippedDueToError = 0;
    
    // v10.4.0: Обрабатываем офферы параллельно batch'ами по 5
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < dbOffers.length; i += BATCH_SIZE) {
        batches.push(dbOffers.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`📦 Processing ${batches.length} batches of ${BATCH_SIZE} offers each`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // Запускаем поиск для всех офферов в batch параллельно
        const searchPromises = batch.map(async (dbOffer) => {
            const code = dbOffer.offerId?.replace(/^#/, '').toUpperCase();
            if (!code || code.length < 6) return { dbOffer, result: null };
            
            const result = await findOfferByCode(code);
            return { dbOffer, result };
        });
        
        // Ждём все результаты batch'а
        const batchResults = await Promise.all(searchPromises);
        
        // Обрабатываем результаты и обновляем БД
        for (const { dbOffer, result } of batchResults) {
            if (!result) continue;
            
            if (result.found) {
                foundOnEldorado++;
                
                // Найден на Eldorado - обновляем данные
                // v10.6.0: Добавляем mutation к обновлению
                const updateData = {
                    status: 'active',
                    currentPrice: result.price,
                    income: result.income || dbOffer.income,
                    imageUrl: result.imageUrl || dbOffer.imageUrl,
                    eldoradoOfferId: result.eldoradoId,
                    lastScannedAt: now,
                    updatedAt: now,
                    notFoundCount: 0 // Сбрасываем счётчик
                };
                // v10.6.0: Сохраняем мутацию если найдена
                if (result.mutation) {
                    updateData.mutation = result.mutation;
                }
                await offersCollection.updateOne(
                    { _id: dbOffer._id },
                    { $set: updateData }
                );
                updated++;
                if (dbOffer.status !== 'active') {
                    markedActive++;
                    console.log(`  ✅ Activated: ${dbOffer.offerId} (${dbOffer.brainrotName})`);
                }
            } else if (result.error) {
                // Ошибка API (timeout, rate limit) - НЕ помечаем как paused
                skippedDueToError++;
                // Обновляем только lastScannedAt
                await offersCollection.updateOne(
                    { _id: dbOffer._id },
                    { $set: { lastScannedAt: now } }
                );
            } else if (result.notFound) {
                // v9.12.1 FIX: Если оффер точно не найден (no API error) - помечаем как paused СРАЗУ
                // Eldorado API не кеширует - paused офферы исчезают из поиска мгновенно
                // Старая логика ждала 3 неудачных попытки, что неправильно
                const notFoundCount = (dbOffer.notFoundCount || 0) + 1;
                
                // v9.12.1: Помечаем как paused сразу (1 попытка достаточно)
                // Оставляем счётчик для логирования
                await offersCollection.updateOne(
                    { _id: dbOffer._id },
                    {
                        $set: {
                            status: 'paused',
                            pausedAt: now,
                            lastScannedAt: now,
                            updatedAt: now,
                            notFoundCount: notFoundCount
                        }
                    }
                );
                
                if (dbOffer.status === 'active') {
                    markedPaused++;
                    console.log(`  ⏸️ Marked paused (not found): ${dbOffer.offerId} (${dbOffer.brainrotName})`);
                }
            }
        }
        
        // Небольшая задержка между batch'ами (не между каждым оффером!)
        if (batchIndex < batches.length - 1) {
            await new Promise(r => setTimeout(r, 100));
        }
    }
    
    console.log(`✅ Scan complete: ${foundOnEldorado} found, ${updated} updated, ${markedActive} activated, ${markedPaused} paused, ${skippedDueToError} skipped`);
    
    return {
        eldoradoCount: foundOnEldorado,
        dbCount: dbOffers.length,
        updated,
        markedActive,
        markedPaused,
        skippedDueToError,
        timestamp: now.toISOString()
    };
}

/**
 * Ищет оффер на Eldorado по коду #XXXXXX
 * v10.3.0: Добавлен retry и улучшенная обработка ошибок
 */
async function findOfferByCode(code, retries = 2) {
    const normalizedCode = code.toUpperCase();
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        // Поиск по #CODE напрямую через searchQuery
        const response = await fetchEldoradoOffers(`#${normalizedCode}`, 1, 20);
        
        // Если ошибка (timeout, rate limit) - retry
        if (response.error) {
            console.log(`   ⚠️ Search error for #${normalizedCode} (attempt ${attempt}/${retries}): ${response.error}`);
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, 500 * attempt)); // Увеличивающаяся задержка
                continue;
            }
            return { notFound: false, error: response.error }; // Не можем точно сказать - не найден или ошибка
        }
        
        // Если пустые результаты
        if (!response.results?.length) {
            // Пробуем ещё раз (API Eldorado иногда возвращает пустой результат)
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, 300));
                continue;
            }
            return { notFound: true }; // Точно не найден после всех попыток
        }
        
        // Ищем оффер где код совпадает
        for (const item of response.results) {
            const offer = item.offer || item;
            const title = (offer.offerTitle || '').toUpperCase();
            const description = (offer.offerDescription || '').toUpperCase();
            
            // Проверяем что код есть в title или description
            if (title.includes(`#${normalizedCode}`) || description.includes(`#${normalizedCode}`)) {
                const imageName = offer.mainOfferImage?.originalSizeImage || offer.mainOfferImage?.largeImage;
                // v10.6.0: Извлекаем мутацию из атрибутов оффера
                const mutation = extractMutationFromAttributes(offer.offerAttributeIdValues);
                
                return {
                    found: true,
                    code: normalizedCode,
                    title: offer.offerTitle,
                    price: offer.pricePerUnitInUSD?.amount || 0,
                    income: parseIncomeFromTitle(offer.offerTitle),
                    imageUrl: buildImageUrl(imageName),
                    eldoradoId: offer.id,
                    sellerName: item.user?.username || null,
                    mutation: mutation // v10.6.0: Мутация оффера
                };
            }
        }
        
        // Нашли результаты но нет точного совпадения кода - retry
        if (attempt < retries) {
            await new Promise(r => setTimeout(r, 300));
            continue;
        }
    }
    
    return { notFound: true }; // Не найден после всех попыток
}

// Кэш последнего сканирования (чтобы не сканировать слишком часто)
let lastScanTime = 0;
let lastScanResult = null;
const SCAN_COOLDOWN = 15000; // 15 секунд между сканами

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
        
        // Debug mode - тест поиска по коду
        if (debug) {
            const testCode = req.query.code || 'TEST1234';
            const rawResponse = await fetchEldoradoOffers(`#${testCode}`, 1, 5);
            return res.json({
                debug: true,
                searchQuery: `#${testCode}`,
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
