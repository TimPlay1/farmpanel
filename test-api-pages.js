// Test script for v10.3.31 - verify displayPage calculation
// Tests multiple brainrots with different mutations

const https = require('https');

const SCAN_PAGE_SIZE = 50;
const DISPLAY_PAGE_SIZE = 24;

// Test cases - brainrots with different mutations
const TEST_CASES = [
    { name: 'Garama and Madundung', income: 450, mutation: null },
    { name: 'Garama and Madundung', income: 500, mutation: null },
    { name: 'La Taco Combinasion', income: 507, mutation: 'Diamond' },
    { name: 'Swaggy Bros', income: 460, mutation: 'Yin-Yang' },
    { name: 'Mieteteira Bicicleteira', income: 429, mutation: null },
    { name: 'Mieteteira Bicicleteira', income: 429, mutation: 'Yin-Yang' },
    { name: 'La Ginger Sekolah', income: 468, mutation: 'Gold' },
    { name: 'La Ginger Sekolah', income: 450, mutation: 'Lava' },
    { name: 'Tang Tang Keletang', income: 435, mutation: 'Rainbow' },
    { name: 'Los Puggies', income: 405, mutation: 'Radioactive' },
];

// M/s range mapping
function getMsRange(income) {
    if (income >= 1000) return '1000+ M/s';
    if (income >= 750) return '750-999 M/s';
    if (income >= 500) return '500-749 M/s';
    if (income >= 250) return '250-499 M/s';
    if (income >= 100) return '100-249 M/s';
    return '0-99 M/s';
}

function getMsRangeAttrId(income) {
    if (income >= 1000) return '0-6';
    if (income >= 750) return '0-4';
    if (income >= 500) return '0-3';
    if (income >= 250) return '0-5';
    if (income >= 100) return '0-2';
    return '0-1';
}

function getMutationAttrId(mutation) {
    if (!mutation) return null;
    const map = {
        'Gold': '1-1',
        'Diamond': '1-2',
        'Bloodrot': '1-3',
        'Candy': '1-4',
        'Lava': '1-5',
        'Galaxy': '1-6',
        'Yin-Yang': '1-7',
        'Radioactive': '1-8',
        'Rainbow': '1-9',
        'Cursed': '1-10'
    };
    return map[mutation] || null;
}

// Fetch from Eldorado API
function fetchEldorado(brainrotName, msRangeAttrId, mutationAttrId, pageIndex = 1) {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams({
            gameId: '259',
            category: 'CustomItem',
            tradeEnvironmentValue0: 'Brainrot',
            tradeEnvironmentValue2: brainrotName,
            offerAttributeIdsCsv: mutationAttrId ? `${msRangeAttrId},${mutationAttrId}` : msRangeAttrId,
            pageSize: SCAN_PAGE_SIZE.toString(),
            pageIndex: pageIndex.toString(),
            offerSortingCriterion: 'Price',
            isAscending: 'true'
        });

        const url = `https://www.eldorado.gg/api/flexibleOffers?${params}`;
        
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Parse income from title
function parseIncomeFromTitle(title) {
    // Look for patterns like "450M/s", "450 M/s", "450M", etc
    const patterns = [
        /(\d+(?:\.\d+)?)\s*[mM]\/[sS]/,
        /(\d+(?:\.\d+)?)\s*[mM][sS]/,
        /(\d+(?:\.\d+)?)\s*[mM](?:\s|$)/
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            return parseFloat(match[1]);
        }
    }
    return 0;
}

// Main test function
async function testBrainrot(testCase) {
    const { name, income, mutation } = testCase;
    const msRangeAttrId = getMsRangeAttrId(income);
    const mutationAttrId = getMutationAttrId(mutation);
    const msRange = getMsRange(income);
    
    console.log('\n' + '='.repeat(80));
    console.log(`🔍 Testing: ${name} | ${income}M/s | ${mutation || 'Default'} | Range: ${msRange}`);
    console.log('='.repeat(80));
    
    try {
        const response = await fetchEldorado(name, msRangeAttrId, mutationAttrId);
        
        if (!response.results || response.results.length === 0) {
            console.log('   ❌ No results found');
            return null;
        }
        
        console.log(`   📊 Total offers: ${response.totalItemsCount} | Pages (API): ${response.totalPages}`);
        console.log(`   📊 Display pages (for buyers): ${Math.ceil(response.totalItemsCount / DISPLAY_PAGE_SIZE)}`);
        
        // Parse offers
        const allOffers = [];
        let upperOffer = null;
        let nextCompetitor = null;
        let offerIndex = 0;
        
        for (const item of response.results) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            const parsedIncome = parseIncomeFromTitle(title);
            const price = offer.pricePerUnitInUSD?.amount || 0;
            const brainrotAttr = offer.tradeEnvironmentValues?.find(e => e.name === 'Brainrot');
            
            if (price <= 0) continue;
            
            const displayPage = Math.ceil((offerIndex + 1) / DISPLAY_PAGE_SIZE);
            const apiPage = Math.ceil((offerIndex + 1) / SCAN_PAGE_SIZE);
            
            const offerData = {
                index: offerIndex,
                title: title.substring(0, 50),
                income: parsedIncome,
                price: price,
                displayPage: displayPage,
                apiPage: apiPage,
                brainrot: brainrotAttr?.value || 'N/A'
            };
            
            allOffers.push(offerData);
            offerIndex++;
            
            // Find upper (first with income >= target)
            if (!upperOffer && parsedIncome >= income) {
                upperOffer = offerData;
            }
            // Find next competitor (after upper, different offer)
            else if (upperOffer && !nextCompetitor && parsedIncome >= income && price >= upperOffer.price) {
                nextCompetitor = offerData;
            }
        }
        
        // Show first 5 offers
        console.log('\n   📋 First 5 offers:');
        allOffers.slice(0, 5).forEach((o, i) => {
            console.log(`      ${i+1}. ${o.income}M/s @ $${o.price.toFixed(2)} | Display page: ${o.displayPage} | Brainrot: ${o.brainrot}`);
        });
        
        // Show upper
        if (upperOffer) {
            console.log(`\n   ✅ UPPER (competitor): ${upperOffer.income}M/s @ $${upperOffer.price.toFixed(2)}`);
            console.log(`      Index: ${upperOffer.index} | Display page: ${upperOffer.displayPage} | API page: ${upperOffer.apiPage}`);
        } else {
            console.log('\n   ⚠️ No UPPER found (above market)');
        }
        
        // Show next competitor
        if (nextCompetitor) {
            console.log(`\n   📈 NEXT COMPETITOR: ${nextCompetitor.income}M/s @ $${nextCompetitor.price.toFixed(2)}`);
            console.log(`      Index: ${nextCompetitor.index} | Display page: ${nextCompetitor.displayPage} | API page: ${nextCompetitor.apiPage}`);
        } else {
            console.log('\n   ⚠️ No NEXT COMPETITOR found');
        }
        
        // Calculate median from first 24 offers
        const first24Prices = allOffers.slice(0, 24).filter(o => o.price > 0).map(o => o.price);
        if (first24Prices.length >= 3) {
            first24Prices.sort((a, b) => a - b);
            const mid = Math.floor(first24Prices.length / 2);
            const median = first24Prices.length % 2 === 0 
                ? (first24Prices[mid - 1] + first24Prices[mid]) / 2 
                : first24Prices[mid];
            
            console.log(`\n   📊 MEDIAN (first 24 offers): $${median.toFixed(2)}`);
            console.log(`      Min: $${Math.min(...first24Prices).toFixed(2)} | Max: $${Math.max(...first24Prices).toFixed(2)}`);
            console.log(`      Offers used: ${first24Prices.length}`);
        }
        
        // Verify displayPage calculation
        console.log('\n   🧮 PAGE CALCULATION CHECK:');
        console.log(`      Offer at index 0  → Display page: ${Math.ceil(1/24)} = 1`);
        console.log(`      Offer at index 23 → Display page: ${Math.ceil(24/24)} = 1`);
        console.log(`      Offer at index 24 → Display page: ${Math.ceil(25/24)} = 2`);
        console.log(`      Offer at index 47 → Display page: ${Math.ceil(48/24)} = 2`);
        console.log(`      Offer at index 48 → Display page: ${Math.ceil(49/24)} = 3`);
        
        return {
            name,
            income,
            mutation,
            totalOffers: response.totalItemsCount,
            displayPages: Math.ceil(response.totalItemsCount / DISPLAY_PAGE_SIZE),
            upperOffer,
            nextCompetitor,
            median: first24Prices.length >= 3 ? first24Prices[Math.floor(first24Prices.length / 2)] : null
        };
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return null;
    }
}

// Run all tests
async function runTests() {
    console.log('🚀 Testing v10.3.31 - displayPage calculation');
    console.log(`   SCAN_PAGE_SIZE = ${SCAN_PAGE_SIZE}`);
    console.log(`   DISPLAY_PAGE_SIZE = ${DISPLAY_PAGE_SIZE}`);
    
    const results = [];
    
    for (const testCase of TEST_CASES) {
        const result = await testBrainrot(testCase);
        if (result) results.push(result);
        
        // Small delay between requests
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    
    console.log('\n| Brainrot | Mutation | Income | Upper Page | Next Comp Page | Median |');
    console.log('|----------|----------|--------|------------|----------------|--------|');
    
    for (const r of results) {
        const upperPage = r.upperOffer?.displayPage || '-';
        const nextPage = r.nextCompetitor?.displayPage || '-';
        const median = r.median ? `$${r.median.toFixed(2)}` : '-';
        console.log(`| ${r.name.substring(0, 20).padEnd(20)} | ${(r.mutation || 'Default').padEnd(10)} | ${r.income}M/s | ${String(upperPage).padEnd(10)} | ${String(nextPage).padEnd(14)} | ${median.padEnd(6)} |`);
    }
}

runTests().catch(console.error);
