const { calculateOptimalPrice } = require('./api/eldorado-price');

// Маппинг M/s диапазонов в attr_ids для ссылки
const MS_RANGE_ATTRS = {
    '0-24': '0-1',
    '25-49': '0-2', 
    '50-99': '0-3',
    '100-249': '0-4',
    '250-499': '0-5',
    '500-749': '0-6',
    '750-999': '0-7',
    '1000+': '0-8'
};

function getAttrIdForIncome(incomeMs) {
    if (incomeMs < 25) return '0-1';
    if (incomeMs < 50) return '0-2';
    if (incomeMs < 100) return '0-3';
    if (incomeMs < 250) return '0-4';
    if (incomeMs < 500) return '0-5';
    if (incomeMs < 750) return '0-6';
    if (incomeMs < 1000) return '0-7';
    return '0-8';
}

function buildEldoradoLink(brainrotName, incomeMs, page = 1) {
    const attrId = getAttrIdForIncome(incomeMs);
    const encodedName = encodeURIComponent(brainrotName);
    return `https://www.eldorado.gg/steal-a-brainrot-brainrots/i/259?attr_ids=${attrId}&te_v2=${encodedName}&offerSortingCriterion=Price&isAscending=true&gamePageOfferIndex=${page}&gamePageOfferSize=24`;
}

async function testBrainrot(name, income) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${name} @ ${income}`);
    console.log('='.repeat(80));
    
    const incomeMs = parseInt(income);
    const link = buildEldoradoLink(name, incomeMs);
    console.log(`🔗 Eldorado Link: ${link}\n`);
    
    try {
        const result = await calculateOptimalPrice(name, income);
        
        console.log('\n📊 RESULTS:');
        console.log(`  Suggested Price: ${result.suggestedPrice ? `$${result.suggestedPrice.toFixed(2)}` : 'N/A'}`);
        console.log(`  Median Price: ${result.medianPrice ? `$${result.medianPrice.toFixed(2)}` : 'N/A'}`);
        console.log(`  Next Competitor Price: ${result.nextCompetitorPrice ? `$${result.nextCompetitorPrice.toFixed(2)}` : 'N/A'}`);
        
        if (result.competitorData) {
            console.log(`\n  Upper Competitor: ${result.competitorData.income}M/s @ $${result.competitorData.price.toFixed(2)}`);
        }
        if (result.lowerData) {
            console.log(`  Lower Offer: ${result.lowerData.income}M/s @ $${result.lowerData.price.toFixed(2)}`);
        }
        if (result.medianData) {
            console.log(`  Median Data: ${result.medianData.offersUsed} offers used, median value: $${result.medianData.medianValue.toFixed(2)}`);
        }
        if (result.nextCompetitorData) {
            console.log(`  Next Competitor: ${result.nextCompetitorData.income}M/s @ $${result.nextCompetitorData.price.toFixed(2)} (diff: $${result.nextCompetitorData.priceDiff?.toFixed(2) || 'N/A'})`);
        }
        
        return { success: true, name, income, result };
    } catch (err) {
        console.error(`  ❌ Error: ${err.message}`);
        return { success: false, name, income, error: err.message };
    }
}

async function runTests() {
    console.log('🧪 FULL PRICING TEST WITH ELDORADO LINKS');
    console.log('=========================================\n');
    
    const testCases = [
        // Популярные брейнроты с большим количеством офферов
        { name: 'Los Mobilis', income: '80M/s' },
        { name: 'Los Mobilis', income: '150M/s' },
        { name: 'La Taco Combinasion', income: '150M/s' },
        { name: 'Tralalero Tralala', income: '30M/s' },
        { name: 'Spaghetti Tuatara', income: '100M/s' },
    ];
    
    const results = [];
    
    for (const tc of testCases) {
        const result = await testBrainrot(tc.name, tc.income);
        results.push(result);
        
        // Небольшая пауза между запросами
        await new Promise(r => setTimeout(r, 1000));
    }
    
    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));
    
    const successful = results.filter(r => r.success);
    const withMedian = successful.filter(r => r.result?.medianPrice);
    const withNextComp = successful.filter(r => r.result?.nextCompetitorPrice);
    
    console.log(`Total tests: ${results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`With median price: ${withMedian.length}`);
    console.log(`With next competitor price: ${withNextComp.length}`);
    
    console.log('\n📋 Detailed Results:');
    for (const r of results) {
        if (r.success) {
            const suggested = r.result.suggestedPrice ? `$${r.result.suggestedPrice.toFixed(2)}` : 'N/A';
            const median = r.result.medianPrice ? `$${r.result.medianPrice.toFixed(2)}` : 'N/A';
            const nextComp = r.result.nextCompetitorPrice ? `$${r.result.nextCompetitorPrice.toFixed(2)}` : 'N/A';
            console.log(`  ✅ ${r.name} @ ${r.income}: Suggested=${suggested}, Median=${median}, NextComp=${nextComp}`);
        } else {
            console.log(`  ❌ ${r.name} @ ${r.income}: ${r.error}`);
        }
    }
    
    console.log('\n✅ All tests complete!');
    process.exit(0);
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
