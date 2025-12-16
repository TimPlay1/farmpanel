// Тест: La Secret Combinasion 1.5 B/s
const https = require('https');

const ELDORADO_GAME_ID = '259';

function fetchEldorado(searchQuery, page = 1) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            gameId: ELDORADO_GAME_ID,
            searchText: searchQuery,
            pageNumber: page,
            pageSize: 24,
            sortBy: 'Price',
            sortDirection: 'Asc',
            offerType: 'Sell',
            attributeFilters: [{ name: 'M/s', value: '1+ B/s' }] // Фильтр по диапазону
        });

        const options = {
            hostname: 'www.eldorado.gg',
            path: '/api/offers/search',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': body.length,
                'User-Agent': 'Mozilla/5.0'
            }
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    console.log('Response status:', res.statusCode);
                    if (data.length < 100) console.log('Raw data:', data);
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.log('Parse error, data length:', data.length);
                    console.log('First 500 chars:', data.substring(0, 500));
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function test() {
    console.log('=== Fetching La Secret Combinasion 1+ B/s offers ===\n');
    
    const response = await fetchEldorado('La Secret Combinasion', 1);
    
    console.log('Total results:', response.totalResultCount);
    console.log('Results on page:', response.results?.length || 0);
    
    if (response.results) {
        console.log('\n=== First 20 offers ===');
        response.results.slice(0, 20).forEach((item, i) => {
            const o = item.offer || item;
            const title = o.offerTitle || '';
            const price = o.pricePerUnitInUSD?.amount || 0;
            const msAttr = o.offerAttributeIdValues?.find(a => a.name === 'M/s');
            const brainrotEnv = o.tradeEnvironmentValues?.find(e => e.name === 'Brainrot');
            
            // Parse income from title
            let income = null;
            const patterns = [
                /(\d+(?:[.,]\d+)?)\s*B\/s/i,   // 1.5B/s, 1B/s
                /(\d+(?:[.,]\d+)?)\s*b\/s/i,
                /\[(\d+(?:[.,]\d+)?)B\/S\]/i,  // [1B/S]
                /(\d+(?:[.,]\d+)?)\s*M\/s/i,   // fallback M/s
            ];
            
            for (const p of patterns) {
                const m = title.match(p);
                if (m) {
                    let val = parseFloat(m[1].replace(',', '.'));
                    // If matched B/s pattern, multiply by 1000
                    if (p.source.includes('B')) {
                        val = val * 1000;
                    }
                    if (val >= 1 && val <= 99999) {
                        income = val;
                        break;
                    }
                }
            }
            
            console.log(`${i+1}. $${price.toFixed(2)} | ${msAttr?.value || '?'} | income: ${income || '?'} | ${brainrotEnv?.value || '?'} | ${title.substring(0, 55)}`);
        });
    }
}

test().catch(console.error);
