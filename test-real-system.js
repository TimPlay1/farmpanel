// v10.3.31 Complete System Test
// Tests the REAL searchBrainrotOffers function with all brainrots from the screenshot

const ep = require('./api/eldorado-price.js');

const TEST_CASES = [
    // Row 1 from screenshot
    { name: 'La Taco Combinasion', income: 507, mutation: 'Diamond' },
    { name: 'Garama and Madundung', income: 500, mutation: null },
    { name: 'Mieteteira Bicicleteira', income: 494, mutation: 'Galaxy' },
    { name: 'La Ginger Sekolah', income: 468, mutation: 'Gold' },
    
    // Row 2 from screenshot
    { name: 'Swaggy Bros', income: 460, mutation: 'Yin-Yang' },
    { name: 'Garama and Madundung', income: 450, mutation: null },
    { name: 'La Ginger Sekolah', income: 450, mutation: 'Lava' },
    { name: 'Tang Tang Keletang', income: 435, mutation: 'Rainbow' },
    
    // Row 3 from screenshot
    { name: 'Mieteteira Bicicleteira', income: 429, mutation: null },
    { name: 'Mieteteira Bicicleteira', income: 429, mutation: 'Yin-Yang' },
    { name: 'La Spooky Grande', income: 422, mutation: 'Gold' },
    { name: 'Los Puggies', income: 405, mutation: 'Radioactive' },
    
    // Row 4 from screenshot  
    { name: 'Tang Tang Keletang', income: 402, mutation: null },
    { name: 'Los Mobilis', income: 396, mutation: null },
    { name: 'Eviledon', income: 393, mutation: 'Yin-Yang' },
    { name: 'Mieteteira Bicicleteira', income: 390, mutation: 'Rainbow' },
];

async function testBrainrot(testCase) {
    const { name, income, mutation } = testCase;
    const mutationStr = mutation || 'Default';
    
    console.log('\n' + '='.repeat(80));
    console.log(`🔍 ${name} | ${income}M/s | ${mutationStr}`);
    console.log('='.repeat(80));
    
    try {
        const result = await ep.searchBrainrotOffers(name, income, 5, { 
            disableAI: true, 
            mutation: mutation 
        });
        
        const upper = result.upperOffer;
        const lower = result.lowerOffer;
        const next = result.nextCompetitor;
        
        console.log('\n📊 RESULTS:');
        console.log(`   Upper:    ${upper ? `${upper.income}M/s @ $${upper.price.toFixed(2)} (page ${upper.displayPage})` : '❌ NOT FOUND'}`);
        console.log(`   Lower:    ${lower ? `${lower.income}M/s @ $${lower.price.toFixed(2)} (page ${lower.displayPage})` : '❌ NOT FOUND'}`);
        console.log(`   NextComp: ${next ? `${next.income}M/s @ $${next.price.toFixed(2)} (page ${next.displayPage})` : '⚠️ NOT FOUND'}`);
        console.log(`   Total offers: ${result.allPageOffers?.length || 0}`);
        
        return {
            name,
            income,
            mutation: mutationStr,
            upper: upper ? { income: upper.income, price: upper.price, page: upper.displayPage } : null,
            lower: lower ? { income: lower.income, price: lower.price } : null,
            next: next ? { income: next.income, price: next.price, page: next.displayPage } : null,
            totalOffers: result.allPageOffers?.length || 0
        };
    } catch (e) {
        console.error(`   ❌ Error: ${e.message}`);
        return { name, income, mutation: mutationStr, error: e.message };
    }
}

async function runAllTests() {
    console.log('🚀 v10.3.31 COMPLETE SYSTEM TEST');
    console.log('Testing REAL searchBrainrotOffers function');
    console.log('Using tradeEnvironmentValue2 filter + pageSize=50 + displayPage calculation\n');
    
    const results = [];
    
    for (const testCase of TEST_CASES) {
        const result = await testBrainrot(testCase);
        results.push(result);
        
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
    }
    
    // Summary table
    console.log('\n\n' + '='.repeat(100));
    console.log('📊 SUMMARY TABLE');
    console.log('='.repeat(100));
    console.log('');
    console.log('| Brainrot                    | Mutation    | Income | Upper         | Next Comp     | Offers |');
    console.log('|-----------------------------|-------------|--------|---------------|---------------|--------|');
    
    for (const r of results) {
        if (r.error) {
            console.log(`| ${r.name.substring(0,27).padEnd(27)} | ${r.mutation.padEnd(11)} | ${String(r.income).padEnd(6)} | ERROR         | ERROR         | -      |`);
            continue;
        }
        
        const upperStr = r.upper 
            ? `$${r.upper.price.toFixed(2)} p${r.upper.page}`.padEnd(13)
            : '❌ none      ';
        const nextStr = r.next 
            ? `$${r.next.price.toFixed(2)} p${r.next.page}`.padEnd(13)
            : '⚠️ none      ';
        
        console.log(`| ${r.name.substring(0,27).padEnd(27)} | ${r.mutation.padEnd(11)} | ${String(r.income).padEnd(6)} | ${upperStr} | ${nextStr} | ${String(r.totalOffers).padEnd(6)} |`);
    }
    
    // Stats
    const successful = results.filter(r => !r.error);
    const withUpper = successful.filter(r => r.upper);
    const withNext = successful.filter(r => r.next);
    
    console.log('\n📈 STATISTICS:');
    console.log(`   Total tests: ${results.length}`);
    console.log(`   Successful: ${successful.length}`);
    console.log(`   With Upper: ${withUpper.length}/${successful.length} (${Math.round(withUpper.length/successful.length*100)}%)`);
    console.log(`   With Next Competitor: ${withNext.length}/${successful.length} (${Math.round(withNext.length/successful.length*100)}%)`);
    
    // Check for issues
    const issues = [];
    for (const r of successful) {
        if (!r.upper) {
            issues.push(`${r.name} ${r.mutation}: No upper found (above market)`);
        }
        if (r.upper && !r.next) {
            issues.push(`${r.name} ${r.mutation}: Upper found but no next competitor`);
        }
    }
    
    if (issues.length > 0) {
        console.log('\n⚠️ POTENTIAL ISSUES:');
        issues.forEach(i => console.log(`   - ${i}`));
    }
}

runAllTests().catch(console.error);
