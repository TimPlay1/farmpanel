/**
 * Check pending codes for FARM-TAES-479W-XJJ8-4M0J on Eldorado
 */
const https = require('https');

const PENDING_CODES = [
    '2A8VHC8N', '39H3HEHH', '4ZCR5T4Q', '98R4KDY5', 'BFPQCY84',
    'EWCVSTBU', 'H9KE7VEA', 'HS5C9FLM', 'MW5WWBRA', 'R7UL28RG',
    'SK2VU4AA', 'TTSCWC94', 'UEPKFC8A', 'UGXD26J5', 'Z5QXGWEB'
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
    console.log('Checking', PENDING_CODES.length, 'pending codes for Aboba Store...\n');
    
    let found = 0;
    let notFound = 0;
    const foundOffers = [];
    
    for (const code of PENDING_CODES) {
        await new Promise(r => setTimeout(r, 300)); // delay
        const result = await searchCode(code);
        
        if (result.error) {
            console.log(`#${code}: ERROR - ${result.error}`);
        } else if (result.count === 0) {
            console.log(`#${code}: NOT FOUND`);
            notFound++;
        } else {
            for (const item of result.results) {
                const offer = item.offer || item;
                const title = offer.offerTitle || '';
                if (title.toUpperCase().includes(code)) {
                    found++;
                    const price = offer.pricePerUnitInUSD?.amount || 0;
                    console.log(`#${code}: ✅ FOUND | $${price} | ${title.substring(0, 50)}...`);
                    
                    // Parse income from title
                    const incomeMatch = title.match(/(\d+\.?\d*)\s*M\/s/i) || title.match(/\$(\d+\.?\d*)M\/s/i);
                    const income = incomeMatch ? Math.round(parseFloat(incomeMatch[1])) : 0;
                    
                    // Parse brainrot name
                    const nameMatch = title.match(/🔥(.+?)\s*[l|]\s*\$?\d/i);
                    const name = nameMatch ? nameMatch[1].trim() : null;
                    
                    foundOffers.push({
                        code,
                        title,
                        price,
                        income,
                        name,
                        eldoradoId: offer.id,
                        seller: item.user?.username
                    });
                }
            }
        }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('Found:', found, '| Not found:', notFound);
    
    if (foundOffers.length > 0) {
        console.log('\n=== OFFERS TO ADD TO DB ===');
        foundOffers.forEach(o => {
            console.log(`Code: ${o.code}`);
            console.log(`  Name: ${o.name || 'PARSE FAILED'}`);
            console.log(`  Income: ${o.income} M/s`);
            console.log(`  Price: $${o.price}`);
            console.log(`  Eldorado ID: ${o.eldoradoId}`);
        });
    }
    
    console.log('\nDone!');
})();
