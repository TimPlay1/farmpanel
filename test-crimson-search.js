const https = require('https');

async function testSearch(searchText) {
    const ELDORADO_GAME_ID = 259;
    const searchEncoded = encodeURIComponent(searchText);
    const queryPath = `/api/flexibleOffers?gameId=${ELDORADO_GAME_ID}&category=CustomItem&te_v0=Brainrot&pageSize=10&pageIndex=1&searchQuery=${searchEncoded}`;
    
    console.log(`\nSearch: "${searchText}"`);
    
    return new Promise((resolve) => {
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
                    console.log('Count:', parsed.recordCount || 0, '| Results:', parsed.results?.length || 0);
                    
                    if (parsed.results && parsed.results.length > 0) {
                        const item = parsed.results[0];
                        const offer = item.offer || item;
                        console.log('First:', (offer.offerTitle || '').substring(0, 60));
                    }
                } catch(e) {
                    console.log('Error:', e.message);
                }
                resolve();
            });
        });
        
        req.on('error', e => { console.log('Error:', e.message); resolve(); });
        req.end();
    });
}

async function check() {
    await testSearch('#HJ8R6JB6');
    await testSearch('HJ8R6JB6');
    await testSearch('CrimsonStore');
    await testSearch('crimson');
    await testSearch('Garama and Madundung');
}

check();
