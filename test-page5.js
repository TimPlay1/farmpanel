const https = require('https');

// Тест: attr_ids фильтр + фильтрация по brainrot name на клиенте
// La Secret Combinasion 1.5B/s (1500 M/s)

const targetIncome = 1500;
const brainrotName = 'La Secret Combinasion';
const msRangeAttrId = '0-8'; // 1+ B/s

function parseIncomeFromTitle(title) {
    if (!title) return null;
    const bPatterns = [
        /(\d+[.,]?\d*)\s*B\/S/i,
        /(\d+[.,]?\d*)B\/s/i,
        /(\d+[.,]?\d*)B\s/i,
        /(\d+[.,]?\d*)B$/i,
        /\[(\d+[.,]?\d*)B\/s\]/i,
        /\[(\d+[.,]?\d*)B\]/i,
    ];
    for (const pattern of bPatterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            if (value >= 0.5 && value <= 100) return value * 1000;
        }
    }
    return null;
}

async function fetchPage(page) {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'www.eldorado.gg',
            path: `/api/flexibleOffers?gameId=259&category=CustomItem&te_v0=Brainrot&attr_ids=${msRangeAttrId}&pageSize=50&pageIndex=${page}&offerSortingCriterion=Price&isAscending=true`,
            method: 'GET',
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({
                        results: json.results || [],
                        totalPages: json.totalPages || 0,
                        total: json.total || 0
                    });
                } catch (e) {
                    resolve({ results: [], totalPages: 0, total: 0 });
                }
            });
        });
        req.on('error', () => resolve({ results: [], totalPages: 0, total: 0 }));
        req.end();
    });
}

async function main() {
    console.log(`Searching for ${brainrotName} in 1+ B/s range (attr_ids=${msRangeAttrId})`);
    console.log(`Target income: ${targetIncome} M/s, filtering by brainrot name on client\n`);
    
    let upperOffer = null;
    let lowerOffer = null;
    let pageOffers = [];
    let totalPages = 0;
    
    for (let page = 1; page <= 200; page++) {
        const response = await fetchPage(page);
        const results = response.results;
        
        if (page === 1) {
            totalPages = response.totalPages;
            console.log(`Total pages in 1+ B/s range: ${totalPages}, total offers: ${response.total}\n`);
        }
        
        if (results.length === 0 || page > totalPages) {
            console.log(`Reached end at page ${page}`);
            break;
        }
        
        // Фильтруем по brainrot name на клиенте
        const currentPageOffers = [];
        
        for (const item of results) {
            const o = item.offer;
            const brainrot = o.tradeEnvironmentValues?.find(e => e.name === 'Brainrot');
            const brainrotValue = brainrot?.value || '';
            
            // Фильтр по имени брейнрота
            if (brainrotValue !== brainrotName) continue;
            
            const title = o.offerTitle || '';
            const price = o.pricePerUnitInUSD?.amount || 0;
            const income = parseIncomeFromTitle(title);
            
            if (price > 0 && income) {
                currentPageOffers.push({ title, price, income });
                
                // Ищем upper
                if (!upperOffer && income >= targetIncome) {
                    upperOffer = { title, price, income, page };
                    console.log(`\n>>> FOUND UPPER at page ${page}: ${income}M/s @ $${price.toFixed(2)}`);
                    console.log(`    "${title.substring(0, 70)}"`);
                }
            }
        }
        
        // Логируем прогресс каждые 10 страниц
        if (page % 10 === 0) {
            console.log(`Page ${page}: checked, ${currentPageOffers.length} ${brainrotName} offers on this page`);
        }
        
        // Если нашли upper - ищем lower на этой странице
        if (upperOffer && upperOffer.page === page) {
            pageOffers = currentPageOffers;
            
            const lowerCandidates = currentPageOffers.filter(o => 
                o.income < targetIncome && o.price < upperOffer.price
            );
            
            if (lowerCandidates.length > 0) {
                lowerCandidates.sort((a, b) => b.price - a.price);
                lowerOffer = lowerCandidates[0];
                console.log(`>>> FOUND LOWER on same page: ${lowerOffer.income}M/s @ $${lowerOffer.price.toFixed(2)}`);
            }
            
            break;
        }
        
        await new Promise(r => setTimeout(r, 100));
    }
    
    console.log('\n=== RESULT ===');
    if (upperOffer) {
        console.log(`Upper: ${upperOffer.income}M/s @ $${upperOffer.price.toFixed(2)} (page ${upperOffer.page})`);
        if (lowerOffer) {
            console.log(`Lower: ${lowerOffer.income}M/s @ $${lowerOffer.price.toFixed(2)}`);
            const diff = upperOffer.price - lowerOffer.price;
            console.log(`Diff: $${diff.toFixed(2)}`);
            
            if (diff >= 1) {
                console.log(`\nRecommended: $${(upperOffer.price - 1).toFixed(2)} (upper - $1)`);
            } else {
                console.log(`\nRecommended: $${(upperOffer.price - 0.5).toFixed(2)} (upper - $0.50)`);
            }
        } else {
            console.log(`No lower on same page`);
            console.log(`\nRecommended: $${(upperOffer.price - 0.5).toFixed(2)} (upper - $0.50)`);
        }
    } else {
        console.log('Upper not found - above market');
    }
    
    console.log(`\nPage offers: ${pageOffers.length}`);
    pageOffers.slice(0, 10).forEach((o, i) => {
        console.log(`  ${i+1}. $${o.price.toFixed(2)} - ${o.income}M/s`);
    });
}

main();
