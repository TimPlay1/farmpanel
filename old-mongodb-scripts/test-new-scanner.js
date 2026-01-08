/**
 * Test script for new scanOffers v3.0.18 logic
 * Tests scanning by shopName instead of all offers
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';
const OFFER_SCAN_PAGE_SIZE = 50;
const OFFER_SCAN_DELAY_MS = 500;

async function fetchEldoradoOffers(page = 1, pageSize = 50, searchQuery = '') {
    let queryPath = `?pageIndex=${page}&pageSize=${pageSize}&gameId=259&category=CustomItem`;
    if (searchQuery) queryPath += `&searchQuery=${encodeURIComponent(searchQuery)}`;
    
    const url = `https://www.eldorado.gg/api/flexibleOffers${queryPath}`;
    console.log(`   📡 Fetching: ${url.substring(0, 120)}...`);
    
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            return { error: `HTTP ${response.status}`, results: [] };
        }
        
        return await response.json();
    } catch (e) {
        return { error: e.message, results: [] };
    }
}

function extractAllCodes(title) {
    if (!title) return [];
    const matches = title.match(/#([A-Z0-9]{8})/gi) || [];
    return matches.map(m => m.replace('#', '').toUpperCase());
}

async function testScanByShopName() {
    console.log('🧪 Testing new scanOffers v3.0.18 logic\n');
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('farmerpanel');
    
    // 1. Load farmers with shopName
    const farmers = await db.collection('farmers').find(
        { shopName: { $exists: true, $ne: null, $ne: '' } },
        { projection: { farmKey: 1, shopName: 1 } }
    ).toArray();
    
    console.log(`👥 Found ${farmers.length} farmers with shopName:`);
    for (const f of farmers) {
        console.log(`   - ${f.shopName} (farmKey: ${f.farmKey})`);
    }
    
    // 2. Load existing offers
    const existingOffers = await db.collection('offers').find({}).toArray();
    const offersByCode = new Map();
    for (const offer of existingOffers) {
        if (offer.offerId) {
            offersByCode.set(offer.offerId.toUpperCase(), offer);
        }
    }
    console.log(`\n📋 Loaded ${offersByCode.size} existing offers from DB\n`);
    
    let totalScanned = 0;
    let matchedCount = 0;
    const foundCodes = new Set();
    
    // 3. For each farmer - scan their offers by shopName
    for (const farmer of farmers) {
        const shopName = farmer.shopName;
        const cleanShopName = shopName.replace(/[^\w\s]/g, '').trim();
        if (!cleanShopName || cleanShopName.length < 3) {
            console.log(`⏭️ Skipping "${shopName}" - too short after cleaning`);
            continue;
        }
        
        console.log(`\n🔍 Scanning offers for "${shopName}" (clean: "${cleanShopName}")...`);
        
        // Scan up to 5 pages for each shop (250 offers max)
        for (let page = 1; page <= 5; page++) {
            await new Promise(r => setTimeout(r, OFFER_SCAN_DELAY_MS));
            
            const response = await fetchEldoradoOffers(page, OFFER_SCAN_PAGE_SIZE, cleanShopName);
            
            if (response.error) {
                console.warn(`   ⚠️ Page ${page} error: ${response.error}`);
                break;
            }
            if (!response.results?.length) {
                if (page === 1) console.log(`   ℹ️ No offers found for "${cleanShopName}"`);
                break;
            }
            
            console.log(`   📄 Page ${page}: ${response.results.length} offers`);
            totalScanned += response.results.length;
            
            // Process offers
            for (const item of response.results) {
                const offer = item.offer || item;
                const title = offer.offerTitle || '';
                const codes = extractAllCodes(title);
                
                if (codes.length === 0) continue;
                
                for (const code of codes) {
                    const existingOffer = offersByCode.get(code);
                    if (existingOffer) {
                        foundCodes.add(code);
                        matchedCount++;
                        
                        const price = offer.pricePerUnitInUSD?.amount || 0;
                        console.log(`   ✅ MATCHED: ${code} - status=${existingOffer.status} price=$${price} (${existingOffer.brainrotName})`);
                    }
                }
            }
            
            // If less than pageSize - last page
            if (response.results.length < OFFER_SCAN_PAGE_SIZE) break;
        }
    }
    
    // 4. Check which existing offers were NOT found
    console.log(`\n📊 Results:`);
    console.log(`   Total scanned: ${totalScanned}`);
    console.log(`   Matched: ${matchedCount}`);
    console.log(`   Found codes: ${foundCodes.size}`);
    
    // Check offers that should be paused
    const trackedCodes = [];
    for (const farmer of farmers) {
        const farmerOffers = await db.collection('offers').find({ 
            farmKey: farmer.farmKey, 
            offerId: { $exists: true, $ne: null } 
        }).toArray();
        
        for (const offer of farmerOffers) {
            if (offer.offerId && !foundCodes.has(offer.offerId.toUpperCase())) {
                trackedCodes.push({ 
                    code: offer.offerId.toUpperCase(), 
                    status: offer.status,
                    brainrot: offer.brainrotName 
                });
            }
        }
    }
    
    console.log(`\n❌ Offers NOT found on Eldorado (should be paused):`);
    for (const { code, status, brainrot } of trackedCodes) {
        console.log(`   ${code} - current status: ${status} (${brainrot})`);
    }
    
    console.log(`\n✅ Offers found on Eldorado (should be active):`);
    for (const code of foundCodes) {
        const offer = offersByCode.get(code);
        if (offer) {
            console.log(`   ${code} - current status: ${offer.status} (${offer.brainrotName})`);
        }
    }
    
    await client.close();
    console.log('\n✅ Test complete!');
}

testScanByShopName().catch(console.error);
