/**
 * Check multiple offer codes on Eldorado
 */
const https = require('https');

const CODES = [
    '6XH59426', // from offers table
    '2JLQWD7N', // active in offer_codes
    'YAAE3A49', // pending
    'BWK6BNRJ', // active
    'W4BK54HK', // pending
    '53GCMSJG', // pending
];

function searchCode(code) {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'www.eldorado.gg',
            path: `/api/flexibleOffers?gameId=259&category=CustomItem&te_v0=Brainrot&pageSize=10&pageIndex=1&searchQuery=${encodeURIComponent('#' + code)}`,
            method: 'GET',
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const j = JSON.parse(data);
                    const results = j.results || j.flexibleOffers || [];
                    resolve({ code, count: results.length, results });
                } catch (e) {
                    resolve({ code, error: e.message });
                }
            });
        });
        req.on('error', e => resolve({ code, error: e.message }));
        req.setTimeout(10000, () => { req.destroy(); resolve({ code, error: 'timeout' }); });
        req.end();
    });
}

(async () => {
    console.log('Checking codes on Eldorado...\n');
    
    for (const code of CODES) {
        await new Promise(r => setTimeout(r, 500)); // delay
        const result = await searchCode(code);
        
        if (result.error) {
            console.log(`#${code}: ERROR - ${result.error}`);
        } else if (result.count === 0) {
            console.log(`#${code}: NOT FOUND on Eldorado`);
        } else {
            for (const item of result.results) {
                const offer = item.offer || item;
                const title = offer.offerTitle || '';
                if (title.toUpperCase().includes(code)) {
                    console.log(`#${code}: FOUND!`);
                    console.log(`  Title: ${title.substring(0, 80)}`);
                    console.log(`  Seller: ${item.user?.username}`);
                    console.log(`  Price: $${offer.pricePerUnitInUSD?.amount}`);
                }
            }
        }
    }
    
    console.log('\nDone!');
})();
