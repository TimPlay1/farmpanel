/**
 * Final test for scanOffers v3.0.18
 * This simulates what the cron job will do
 */

const { MongoClient } = require('mongodb');
const https = require('https');

const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';
const ELDORADO_GAME_ID = '259';
const OFFER_SCAN_PAGE_SIZE = 50;
const OFFER_SCAN_DELAY_MS = 150;

// Extract codes from title
function extractAllCodes(title) {
    if (!title) return [];
    const matches = title.match(/#([A-Z0-9]{8})/gi) || [];
    return matches.map(m => m.replace('#', '').toUpperCase());
}

// Parse income from title (same as cron-price-scanner.js)
function parseIncomeFromTitle(title) {
    if (!title) return 0;
    
    const patterns = [
        /\$?([\d,]+(?:\.\d+)?)\s*[KkМмMm]\/s/i,
        /\$?([\d,]+(?:\.\d+)?)\s*[Bb]\/s/i,
        /([\d,]+(?:\.\d+)?)\s*[KkМмMm]\/s/i,
        /([\d,]+(?:\.\d+)?)\s*[Bb]\/s/i,
        /([\d,]+(?:\.\d+)?)\s*[MmМм]\/s/i
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            let value = parseFloat(match[1].replace(/,/g, ''));
            if (/[Bb]\/s/.test(match[0])) value *= 1000;
            return Math.round(value);
        }
    }
    return 0;
}

// Fetch from Eldorado API - same as cron-price-scanner.js
function fetchEldoradoOffers(pageIndex = 1, pageSize = 50, searchText = null) {
    return new Promise((resolve) => {
        let queryPath = `/api/flexibleOffers?gameId=${ELDORADO_GAME_ID}&category=CustomItem&te_v0=Brainrot&pageSize=${pageSize}&pageIndex=${pageIndex}`;
        
        if (searchText) {
            queryPath += `&searchQuery=${encodeURIComponent(searchText)}`;
        }

        const options = {
            hostname: 'www.eldorado.gg',
            path: queryPath,
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
        req.setTimeout(15000, () => {
            req.destroy();
            resolve({ error: 'timeout', results: [] });
        });
        req.end();
    });
}

async function runTest() {
    console.log('🧪 Final test for scanOffers v3.0.18\n');
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('farmerpanel');
    
    const farmersCollection = db.collection('farmers');
    const offersCollection = db.collection('offers');
    const now = new Date();
    
    // 1. Get farmers with shopName
    const farmers = await farmersCollection.find(
        { shopName: { $exists: true, $ne: null, $ne: '' } },
        { projection: { farmKey: 1, shopName: 1 } }
    ).toArray();
    
    console.log(`👥 Found ${farmers.length} farmers with shopName`);
    
    // 2. Load existing offers
    const existingOffers = await offersCollection.find({}).toArray();
    const offersByCode = new Map();
    for (const offer of existingOffers) {
        if (offer.offerId) {
            offersByCode.set(offer.offerId.toUpperCase(), offer);
        }
    }
    console.log(`📋 Loaded ${offersByCode.size} existing offers from DB\n`);
    
    let totalScanned = 0;
    let matchedCount = 0;
    let updatedCount = 0;
    const foundCodes = new Set();
    
    // 3. Scan each farmer's offers by shopName
    for (const farmer of farmers) {
        const shopName = farmer.shopName;
        const cleanShopName = shopName.replace(/[^\w\s]/g, '').trim();
        if (!cleanShopName || cleanShopName.length < 3) {
            console.log(`⏭️ Skipping "${shopName}" - too short after cleaning`);
            continue;
        }
        
        console.log(`🔍 Scanning "${shopName}" (clean: "${cleanShopName}")...`);
        
        for (let page = 1; page <= 5; page++) {
            await new Promise(r => setTimeout(r, OFFER_SCAN_DELAY_MS));
            
            const response = await fetchEldoradoOffers(page, OFFER_SCAN_PAGE_SIZE, cleanShopName);
            
            if (response.error) {
                console.warn(`   ⚠️ Page ${page} error: ${response.error}`);
                break;
            }
            if (!response.results?.length) {
                if (page === 1) console.log(`   ℹ️ No offers found`);
                break;
            }
            
            console.log(`   📄 Page ${page}: ${response.results.length} offers`);
            totalScanned += response.results.length;
            
            for (const item of response.results) {
                const offer = item.offer || item;
                const title = offer.offerTitle || '';
                const codes = extractAllCodes(title);
                
                if (codes.length === 0) continue;
                
                for (const code of codes) {
                    const existingOffer = offersByCode.get(code);
                    if (existingOffer && existingOffer.farmKey === farmer.farmKey) {
                        foundCodes.add(code);
                        matchedCount++;
                        
                        // Would update in real scenario
                        if (existingOffer.status !== 'active') {
                            updatedCount++;
                        }
                    }
                }
            }
            
            if (response.results.length < OFFER_SCAN_PAGE_SIZE) break;
        }
    }
    
    // 4. Summary
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total scanned: ${totalScanned}`);
    console.log(`   Matched in DB: ${matchedCount}`);
    console.log(`   Would update to active: ${updatedCount}`);
    console.log(`   Unique codes found: ${foundCodes.size}`);
    
    // 5. Count offers that would be paused (not found on Eldorado)
    let wouldPause = 0;
    for (const farmer of farmers) {
        const farmerOffers = await offersCollection.find({ 
            farmKey: farmer.farmKey, 
            offerId: { $exists: true, $ne: null },
            status: { $ne: 'paused' }
        }).toArray();
        
        for (const offer of farmerOffers) {
            if (offer.offerId && !foundCodes.has(offer.offerId.toUpperCase())) {
                wouldPause++;
            }
        }
    }
    
    console.log(`   Would pause (not found): ${wouldPause}`);
    
    await client.close();
    console.log('\n✅ Test complete!');
}

runTest().catch(console.error);
