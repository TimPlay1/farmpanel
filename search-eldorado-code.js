/**
 * Search for offer code directly on Eldorado
 */
const https = require('https');

const CODE = 'CKKQTQEH';
const SHOP_NAME = 'Aboba Store';

function fetchEldoradoByShop(shopName, page = 1) {
    return new Promise((resolve) => {
        const cleanName = shopName.replace(/[^\w\s]/g, '').trim();
        const queryPath = `/api/flexibleOffers?gameId=259&category=CustomItem&te_v0=Brainrot&pageSize=50&pageIndex=${page}&offerSortingCriterion=Price&isAscending=true&searchQuery=${encodeURIComponent(cleanName)}`;

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
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: e.message });
                }
            });
        });
        req.on('error', e => resolve({ error: e.message }));
        req.setTimeout(15000, () => { req.destroy(); resolve({ error: 'timeout' }); });
        req.end();
    });
}

function fetchEldoradoByCode(code) {
    return new Promise((resolve) => {
        const queryPath = `/api/flexibleOffers?gameId=259&category=CustomItem&te_v0=Brainrot&pageSize=50&pageIndex=1&offerSortingCriterion=Price&isAscending=true&searchQuery=${encodeURIComponent('#' + code)}`;

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
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: e.message });
                }
            });
        });
        req.on('error', e => resolve({ error: e.message }));
        req.setTimeout(15000, () => { req.destroy(); resolve({ error: 'timeout' }); });
        req.end();
    });
}

(async () => {
    console.log('=== SEARCH BY CODE #' + CODE + ' ===');
    const byCode = await fetchEldoradoByCode(CODE);
    
    if (byCode.error) {
        console.log('Error:', byCode.error);
    } else {
        const results = byCode.results || byCode.flexibleOffers || [];
        console.log('Found:', results.length, 'offers');
        
        for (const item of results) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            const price = offer.pricePerUnitInUSD?.amount || 0;
            const seller = item.user?.username || 'unknown';
            
            if (title.toUpperCase().includes(CODE)) {
                console.log('\n✅ MATCH FOUND!');
                console.log('  Title:', title);
                console.log('  Price: $' + price);
                console.log('  Seller:', seller);
                console.log('  ID:', offer.id);
            }
        }
    }
    
    console.log('\n=== SEARCH BY SHOP NAME "' + SHOP_NAME + '" ===');
    const byShop = await fetchEldoradoByShop(SHOP_NAME);
    
    if (byShop.error) {
        console.log('Error:', byShop.error);
    } else {
        const results = byShop.results || byShop.flexibleOffers || [];
        console.log('Found:', results.length, 'offers');
        
        let foundCode = false;
        for (const item of results) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            const seller = item.user?.username || 'unknown';
            
            if (title.toUpperCase().includes(CODE)) {
                foundCode = true;
                const price = offer.pricePerUnitInUSD?.amount || 0;
                console.log('\n✅ FOUND CODE IN SHOP!');
                console.log('  Title:', title);
                console.log('  Price: $' + price);
                console.log('  Seller:', seller);
            }
        }
        
        if (!foundCode) {
            console.log('\n❌ Code', CODE, 'NOT found in shop search results');
            console.log('First 5 offers:');
            for (const item of results.slice(0, 5)) {
                const offer = item.offer || item;
                console.log('  -', offer.offerTitle);
            }
        }
    }
})();
