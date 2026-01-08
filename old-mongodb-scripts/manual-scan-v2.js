/**
 * Ручной запуск сканирования офферов v2
 * Делает HTTPS запросы последовательно
 */
const https = require('https');
const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';
const ELDORADO_GAME_ID = '259';
const ELDORADO_IMAGE_BASE = 'https://fileserviceusprod.blob.core.windows.net/offerimages/';

const CODE_PATTERNS = [
    /#([A-Z0-9]{4,12})\b/gi,
    /\[([A-Z0-9]{4,12})\]/gi,
    /\(([A-Z0-9]{4,12})\)/gi,
];

const MUTATION_ID_TO_NAME = {
    '1-0': null, '1-1': 'Gold', '1-2': 'Diamond', '1-3': 'Bloodrot',
    '1-4': 'Candy', '1-5': 'Lava', '1-6': 'Galaxy', '1-7': 'Yin-Yang',
    '1-8': 'Radioactive', '1-9': 'Rainbow', '1-10': 'Cursed'
};

function fetchPage(pageIndex, pageSize = 50) {
    return new Promise((resolve, reject) => {
        // v3.0.17: Убран offerSortingCriterion - Eldorado возвращает 400
        const path = `/api/flexibleOffers?gameId=${ELDORADO_GAME_ID}&category=CustomItem&te_v0=Brainrot&pageSize=${pageSize}&pageIndex=${pageIndex}`;
        
        const req = https.request({
            hostname: 'www.eldorado.gg',
            path: path,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    resolve({ error: `HTTP ${res.statusCode}`, results: [] });
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    resolve({
                        results: parsed.results || [],
                        totalCount: parsed.recordCount || 0
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

function extractAllCodes(text) {
    if (!text) return [];
    const codes = new Set();
    for (const pattern of CODE_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const code = match[1].toUpperCase();
            if (code.length >= 4 && !/^\d+$/.test(code)) {
                codes.add(code);
            }
        }
    }
    return Array.from(codes);
}

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

function parseIncomeFromTitle(title) {
    if (!title) return null;
    const match = title.match(/\$?(\d+(?:\.\d+)?)\s*([KMBT])\/s/i);
    if (!match) return null;
    
    let income = parseFloat(match[1]);
    const suffix = match[2].toUpperCase();
    
    if (suffix === 'K') income *= 0.001;
    else if (suffix === 'B') income *= 1000;
    else if (suffix === 'T') income *= 1000000;
    
    return income > 0 ? income : null;
}

function buildImageUrl(imageName) {
    if (!imageName) return null;
    if (imageName.startsWith('http')) return imageName;
    return ELDORADO_IMAGE_BASE + imageName;
}

async function runManualScan() {
    console.log('=== РУЧНОЙ ЗАПУСК СКАНИРОВАНИЯ ОФФЕРОВ v2 ===\n');
    
    // 1. Подключаемся к MongoDB
    console.log('Подключаемся к MongoDB...');
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('farmerpanel');
    console.log('Подключено!\n');
    
    const offersCollection = db.collection('offers');
    const now = new Date();
    
    // 2. Загружаем все коды
    const codeToOwner = new Map();
    const existingOffers = await offersCollection.find({}).toArray();
    for (const offer of existingOffers) {
        if (offer.offerId) {
            codeToOwner.set(offer.offerId.toUpperCase(), {
                farmKey: offer.farmKey,
                brainrotName: offer.brainrotName,
                source: 'offers'
            });
        }
    }
    console.log(`Загружено ${codeToOwner.size} кодов из БД\n`);
    
    // 3. Сканируем страницы
    const PAGES_TO_SCAN = 30;
    const PAGE_SIZE = 50;
    
    let totalScanned = 0;
    let matchedCount = 0;
    let updatedCount = 0;
    const foundCodes = new Set();
    
    for (let page = 1; page <= PAGES_TO_SCAN; page++) {
        process.stdout.write(`Страница ${page}/${PAGES_TO_SCAN}... `);
        
        const response = await fetchPage(page, PAGE_SIZE);
        
        if (response.error) {
            console.log(`❌ ${response.error}`);
            break;
        }
        
        if (!response.results?.length) {
            console.log(`пусто, завершаю`);
            break;
        }
        
        console.log(`${response.results.length} офферов`);
        totalScanned += response.results.length;
        
        // Обрабатываем офферы
        for (const item of response.results) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            const codes = extractAllCodes(title);
            
            if (codes.length === 0) continue;
            
            for (const code of codes) {
                const owner = codeToOwner.get(code);
                if (!owner) continue;
                
                foundCodes.add(code);
                matchedCount++;
                
                const price = offer.pricePerUnitInUSD?.amount || 0;
                const mutation = extractMutationFromAttributes(offer.offerAttributeIdValues);
                const imageName = offer.mainOfferImage?.originalSizeImage || offer.mainOfferImage?.largeImage;
                const income = parseIncomeFromTitle(title);
                
                // Получаем существующий оффер
                const existingOffer = await offersCollection.findOne({ 
                    farmKey: owner.farmKey, 
                    offerId: code 
                });
                
                if (existingOffer) {
                    const oldStatus = existingOffer.status;
                    const finalIncome = (income && income > 0) ? income : (existingOffer.income || 0);
                    
                    await offersCollection.updateOne(
                        { _id: existingOffer._id },
                        { $set: {
                            status: 'active',
                            eldoradoOfferId: offer.id,
                            currentPrice: price,
                            mutation: mutation,
                            income: finalIncome,
                            imageUrl: buildImageUrl(imageName) || existingOffer.imageUrl,
                            eldoradoTitle: title,
                            sellerName: item.user?.username || null,
                            lastScannedAt: now,
                            updatedAt: now
                        }}
                    );
                    
                    if (oldStatus !== 'active') {
                        console.log(`  ✅ ${code}: ${oldStatus} → active`);
                    }
                    updatedCount++;
                }
            }
        }
        
        // Задержка между страницами
        await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`\n=== РЕЗУЛЬТАТЫ ===`);
    console.log(`Просканировано: ${totalScanned} офферов`);
    console.log(`Найдено совпадений: ${matchedCount}`);
    console.log(`Обновлено: ${updatedCount}`);
    console.log(`Уникальных кодов найдено: ${foundCodes.size}`);
    
    // Статистика по статусам
    const stillPending = await offersCollection.countDocuments({ status: 'pending' });
    const stillPaused = await offersCollection.countDocuments({ status: 'paused' });
    const stillActive = await offersCollection.countDocuments({ status: 'active' });
    
    console.log(`\nСтатусы после сканирования:`);
    console.log(`  Active: ${stillActive}`);
    console.log(`  Pending: ${stillPending}`);
    console.log(`  Paused: ${stillPaused}`);
    
    await client.close();
}

runManualScan().catch(console.error);
