/**
 * Test brainrots from screenshots
 */

const ep = require('./api/eldorado-price.js');

const testCases = [
    // Screenshot 1
    { name: 'Los Candies', income: 333.5, mutation: 'Galaxy' },
    { name: 'Spaghetti Tualetti', income: 330, mutation: 'Diamond' },
    { name: 'Mieteteira Bicicleteira', income: 325, mutation: 'Yin-Yang' },
    { name: 'Money Money Puggy', income: 320.2, mutation: 'Gold' },
    { name: 'Tuff Toucan', income: 318.5, mutation: 'Gold' },
    { name: 'Spaghetti Tualetti', income: 315, mutation: 'Gold' },
    { name: 'Chimnino', income: 308, mutation: 'Rainbow' },
    { name: 'Los Mobilis', income: 308, mutation: 'Galaxy' },
    // v10.3.35: Fixed name - Los Spooky Combinasionas (not in Eldorado dropdown, uses Other+searchQuery)
    // Note: На Eldorado нет Gold мутации для этого брейнрота, есть None и Lava
    { name: 'Los Spooky Combinasionas', income: 305, mutation: null },
    { name: 'Chimnino', income: 301, mutation: 'Radioactive' },
    
    // Screenshot 2
    { name: 'Los Mobilis', income: 385, mutation: 'Yin-Yang' },
    { name: 'Los Candies', income: 379.5, mutation: 'Radioactive' },
    { name: 'Money Money Puggy', income: 378, mutation: 'Rainbow' },
    { name: 'Money Money Puggy', income: 378, mutation: 'Cursed' },
    { name: 'Tictac Sahur', income: 375, mutation: 'Rainbow' },
    { name: 'Ketchuru and Musturu', income: 350.6, mutation: 'Gold' },
    { name: 'Chimnino', income: 350, mutation: 'Galaxy' },
    { name: 'Los Mobilis', income: 341, mutation: 'Yin-Yang' },
    { name: 'Swaggy Bros', income: 340, mutation: 'Diamond' },
    { name: 'La Ginger Sekolah', income: 337.5, mutation: 'Default' },
];

async function runTests() {
    console.log('🚀 Testing brainrots from screenshots\n');
    console.log('='.repeat(100));
    
    const results = [];
    
    for (const tc of testCases) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔍 ${tc.name} | ${tc.income}M/s | ${tc.mutation}`);
        console.log('='.repeat(80));
        
        try {
            const result = await ep.searchBrainrotOffers(tc.name, tc.income, 5, {
                disableAI: true,
                mutation: tc.mutation === 'Default' ? null : tc.mutation
            });
            
            const upperInfo = result.upperOffer 
                ? `${result.upperOffer.income}M/s @ $${result.upperOffer.price.toFixed(2)} (${result.upperOffer.range || 'current'})`
                : '❌ NONE';
            const nextInfo = result.nextCompetitor 
                ? `${result.nextCompetitor.income}M/s @ $${result.nextCompetitor.price.toFixed(2)} (${result.nextCompetitor.range || 'current'})`
                : '⚠️ NONE';
            
            console.log(`\n📊 RESULTS:`);
            console.log(`   Upper:    ${upperInfo}`);
            console.log(`   NextComp: ${nextInfo}`);
            console.log(`   Total offers: ${result.allPageOffers?.length || 0}`);
            
            results.push({
                ...tc,
                upper: result.upperOffer,
                next: result.nextCompetitor,
                offers: result.allPageOffers?.length || 0
            });
            
        } catch (err) {
            console.error(`   ❌ ERROR: ${err.message}`);
            results.push({ ...tc, error: err.message });
        }
        
        // Small delay
        await new Promise(r => setTimeout(r, 200));
    }
    
    // Summary table
    console.log('\n\n' + '='.repeat(120));
    console.log('📊 SUMMARY TABLE');
    console.log('='.repeat(120));
    console.log('| Brainrot                    | Mutation    | Income | Upper         | Next Comp     | Offers |');
    console.log('|-----------------------------|-------------|--------|---------------|---------------|--------|');
    
    let withUpper = 0, withNext = 0;
    
    for (const r of results) {
        const mutationStr = (r.mutation || 'Default').padEnd(11);
        
        if (r.error) {
            console.log(`| ${r.name.padEnd(27)} | ${mutationStr} | ${String(r.income).padEnd(6)} | ERROR: ${r.error.substring(0, 30)} |`);
            continue;
        }
        
        const upperStr = r.upper ? `$${r.upper.price.toFixed(2)} p${r.upper.displayPage || 1}` : '❌ none';
        const nextStr = r.next ? `$${r.next.price.toFixed(2)} p${r.next.displayPage || 1}` : '⚠️ none';
        
        console.log(`| ${r.name.padEnd(27)} | ${mutationStr} | ${String(r.income).padEnd(6)} | ${upperStr.padEnd(13)} | ${nextStr.padEnd(13)} | ${String(r.offers).padEnd(6)} |`);
        
        if (r.upper) withUpper++;
        if (r.next) withNext++;
    }
    
    console.log('\n📈 STATISTICS:');
    console.log(`   Total tests: ${results.length}`);
    console.log(`   With Upper: ${withUpper}/${results.length} (${Math.round(withUpper/results.length*100)}%)`);
    console.log(`   With Next Competitor: ${withNext}/${results.length} (${Math.round(withNext/results.length*100)}%)`);
    
    // Show potential issues
    const issues = results.filter(r => !r.upper || !r.next);
    if (issues.length > 0) {
        console.log('\n⚠️ POTENTIAL ISSUES:');
        for (const r of issues) {
            if (!r.upper) console.log(`   - ${r.name} ${r.mutation}: No upper found`);
            else if (!r.next) console.log(`   - ${r.name} ${r.mutation}: Upper found but no next competitor`);
        }
    }
}

runTests().catch(console.error);
