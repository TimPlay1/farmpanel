const mysql = require('mysql2/promise');
const https = require('https');

// Parse income from title
function parseIncome(title) {
    if (!title) return null;
    const match = title.match(/(\d+(?:\.\d+)?)\s*[Mm]\/[sS]/i) || 
                  title.match(/(\d+(?:\.\d+)?)\s*[Mm](?:\s|$|[^\w])/i);
    return match ? parseFloat(match[1]) : null;
}

// Fetch offers for a brainrot name
function fetchOffers(name) {
    return new Promise((resolve) => {
        const url = `https://www.eldorado.gg/api/flexibleOffers?gameId=259&category=CustomItem&tradeEnvironmentValue0=Brainrot&pageSize=50&pageIndex=1&searchQuery=${encodeURIComponent(name)}&offerSortingCriterion=Price&isAscending=true`;
        
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: e.message, results: [] });
                }
            });
        }).on('error', e => resolve({ error: e.message, results: [] }));
    });
}

async function main() {
    // 1. Get current prices from API
    console.log('=== FETCHING CURRENT PRICES FROM API ===');
    
    const pricesData = await new Promise((resolve) => {
        https.get('https://ody.farm/api/prices-cache', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } 
                catch (e) { resolve({ prices: [] }); }
            });
        }).on('error', () => resolve({ prices: [] }));
    });
    
    // Filter Chimnino prices
    const rows = (pricesData.prices || []).filter(p => 
        p._id && (p._id.startsWith('chimnino') || p._id.startsWith('chimino'))
    ).slice(0, 25);
    
    console.log('=== CURRENT PRICES IN CACHE ===');
    const cacheMap = new Map();
    rows.forEach(r => {
        cacheMap.set(r._id, r.suggestedPrice);
        const age = Math.round((Date.now() - new Date(r.updatedAt).getTime()) / 60000);
        console.log(`${r._id.padEnd(30)} | $${(r.suggestedPrice || 0).toFixed(2).padEnd(6)} | ${age}m ago`);
    });
    
    // 2. Get offers from Eldorado API (1 request!)
    console.log('\n=== FETCHING FROM ELDORADO API (1 request) ===');
    const apiResult = await fetchOffers('Chimnino');
    console.log(`Total offers: ${apiResult.recordCount || 0}`);
    
    // 3. Parse and group by income+mutation
    const apiPrices = new Map();
    for (const item of (apiResult.results || [])) {
        const o = item.offer;
        const price = o.pricePerUnitInUSD?.amount;
        const income = parseIncome(o.offerTitle);
        const mutAttr = o.offerAttributeIdValues?.find(a => a.name === 'Mutations');
        const mut = (mutAttr?.value === 'None' ? null : mutAttr?.value) || null;
        
        if (!income || !price) continue;
        
        // Round income to match cache key format
        const roundedIncome = Math.round(income);
        const mutKey = mut ? `_${mut.toLowerCase()}` : '';
        const cacheKey = `chimnino_${roundedIncome}${mutKey}`;
        
        // Store minimum price
        if (!apiPrices.has(cacheKey) || price < apiPrices.get(cacheKey)) {
            apiPrices.set(cacheKey, price);
        }
    }
    
    // 4. Compare
    console.log('\n=== COMPARISON ===');
    console.log('Cache Key'.padEnd(30) + ' | DB Price | API Price | Diff');
    console.log('-'.repeat(65));
    
    let matches = 0;
    let mismatches = 0;
    
    for (const [key, dbPrice] of cacheMap) {
        const apiPrice = apiPrices.get(key);
        if (apiPrice !== undefined) {
            const diff = ((apiPrice - dbPrice) / dbPrice * 100).toFixed(1);
            const diffStr = diff > 0 ? `+${diff}%` : `${diff}%`;
            console.log(`${key.padEnd(30)} | $${dbPrice.toFixed(2).padEnd(6)} | $${apiPrice.toFixed(2).padEnd(6)} | ${diffStr}`);
            if (Math.abs(parseFloat(diff)) < 10) matches++;
            else mismatches++;
        }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`DB prices checked: ${cacheMap.size}`);
    console.log(`API prices found (from 1 request): ${apiPrices.size}`);
    console.log(`Matches (<10% diff): ${matches}, Mismatches: ${mismatches}`);
}

main().catch(console.error);
