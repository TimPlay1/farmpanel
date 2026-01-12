/**
 * Deep analysis of farmer offers
 */
const mysql = require('mysql2/promise');
const https = require('https');

const FARM_KEY = 'FARM-7VZV-EY4Y-1OOX-IOQJ';

function fetchEldoradoByShop(shopName, page = 1) {
    return new Promise((resolve) => {
        const cleanName = shopName.replace(/[^\w\s]/g, '').trim();
        const queryPath = `/api/flexibleOffers?gameId=259&category=CustomItem&te_v0=Brainrot&pageSize=100&pageIndex=${page}&offerSortingCriterion=Price&isAscending=true&searchQuery=${encodeURIComponent(cleanName)}`;

        const req = https.request({
            hostname: 'www.eldorado.gg',
            path: queryPath,
            method: 'GET',
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: e.message }); }
            });
        });
        req.on('error', e => resolve({ error: e.message }));
        req.setTimeout(15000, () => { req.destroy(); resolve({ error: 'timeout' }); });
        req.end();
    });
}

function extractCode(title) {
    if (!title) return null;
    const match = title.match(/#([A-Z0-9]{6,10})/i);
    return match ? match[1].toUpperCase() : null;
}

(async () => {
    const pool = await mysql.createPool({
        host: '87.120.216.181', port: 3306,
        user: 'farmerpanel', password: 'FpM3Sql!2026Pwd', database: 'farmerpanel'
    });
    
    console.log('=== FARMER:', FARM_KEY, '===\n');
    
    // Get farmer info
    const [farmer] = await pool.query('SELECT * FROM farmers WHERE farm_key = ?', [FARM_KEY]);
    console.log('Shop Name:', farmer[0]?.shop_name);
    console.log('Username:', farmer[0]?.username);
    
    // Get all offer_codes
    console.log('\n=== OFFER_CODES (registered by user) ===');
    const [codes] = await pool.query('SELECT * FROM offer_codes WHERE farm_key = ? ORDER BY status, code', [FARM_KEY]);
    console.log('Total codes:', codes.length);
    
    const pendingCodes = codes.filter(c => c.status === 'pending');
    const activeCodes = codes.filter(c => c.status === 'active');
    console.log('Pending:', pendingCodes.length);
    console.log('Active:', activeCodes.length);
    
    console.log('\nPending codes (not linked to offers yet):');
    for (const c of pendingCodes) {
        console.log('  ', c.code, '| brainrot:', c.brainrot_name || 'null');
    }
    
    // Get all offers
    console.log('\n=== OFFERS (scanned from Eldorado) ===');
    const [offers] = await pool.query('SELECT * FROM offers WHERE farm_key = ? ORDER BY status, brainrot_name', [FARM_KEY]);
    console.log('Total offers:', offers.length);
    
    const activeOffers = offers.filter(o => o.status === 'active');
    const pausedOffers = offers.filter(o => o.status === 'paused');
    const pendingOffers = offers.filter(o => o.status === 'pending');
    
    console.log('Active:', activeOffers.length);
    console.log('Paused:', pausedOffers.length);
    console.log('Pending:', pendingOffers.length);
    
    // Check codes that exist in offer_codes but NOT in offers
    console.log('\n=== CODES WITHOUT MATCHING OFFERS ===');
    const offerIds = new Set(offers.map(o => o.offer_id?.toUpperCase()));
    const codesWithoutOffers = codes.filter(c => !offerIds.has(c.code.toUpperCase()));
    console.log('Codes without offers:', codesWithoutOffers.length);
    for (const c of codesWithoutOffers) {
        console.log('  ', c.code, '| status:', c.status);
    }
    
    // Search Eldorado for shop
    console.log('\n=== SEARCHING ELDORADO ===');
    const shopName = farmer[0]?.shop_name || 'CrimsonStore';
    console.log('Searching for shop:', shopName);
    
    const result = await fetchEldoradoByShop(shopName, 1);
    const eldoradoOffers = result.results || result.flexibleOffers || [];
    console.log('Found on Eldorado:', eldoradoOffers.length, 'offers');
    
    // Extract codes from Eldorado
    const eldoradoCodes = new Map();
    for (const item of eldoradoOffers) {
        const offer = item.offer || item;
        const title = offer.offerTitle || '';
        const code = extractCode(title);
        if (code) {
            eldoradoCodes.set(code, {
                title: title.substring(0, 60),
                price: offer.pricePerUnitInUSD?.amount || 0,
                seller: item.user?.username
            });
        }
    }
    console.log('Codes found in Eldorado results:', eldoradoCodes.size);
    
    // Find codes registered but not found on Eldorado
    console.log('\n=== REGISTERED CODES NOT FOUND ON ELDORADO (in first 100 results) ===');
    for (const c of codes) {
        if (!eldoradoCodes.has(c.code.toUpperCase())) {
            console.log('  NOT FOUND:', c.code, '| DB status:', c.status);
        }
    }
    
    // Find codes on Eldorado but not registered
    console.log('\n=== ELDORADO CODES NOT IN DB (from first 100) ===');
    for (const [code, info] of eldoradoCodes) {
        const inDb = codes.find(c => c.code.toUpperCase() === code);
        if (!inDb) {
            console.log('  ', code, '| seller:', info.seller, '| $' + info.price);
        }
    }
    
    await pool.end();
    console.log('\nDone!');
})();
