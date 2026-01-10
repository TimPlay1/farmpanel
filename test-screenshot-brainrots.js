/**
 * Test brainrots from screenshots - v10.3.41 fuzzy matching test
 */

const ep = require('./api/eldorado-price.js');

const testCases = [
    // === SCREENSHOT 1 - High income (400-460 M/s) ===
    { name: 'Swaggy Bros', income: 460, mutation: 'Yin-Yang' },
    { name: 'Garama and Madundung', income: 450, mutation: null },
    { name: 'La Ginger Sekolah', income: 450, mutation: 'Lava' },
    { name: 'Tang Tang Keletang', income: 435.5, mutation: 'Rainbow' },
    { name: 'Mieteteira Bicicleteira', income: 429, mutation: null },
    { name: 'Mieteteira Bicicleteira', income: 429, mutation: 'Yin-Yang' },
    { name: 'La Spooky Grande', income: 422.6, mutation: 'Gold' },
    { name: 'Los Puggies', income: 405, mutation: 'Radioactive' },
    { name: 'Tang Tang Keletang', income: 402, mutation: null },
    { name: 'Los Mobilis', income: 396, mutation: null },
    { name: 'Eviledon', income: 393.8, mutation: 'Yin-Yang' },
    { name: 'Mieteteira Bicicleteira', income: 390, mutation: 'Rainbow' },
    
    // === SCREENSHOT 2 - Medium income (276-300 M/s) ===
    { name: 'Spaghetti Tualetti', income: 300, mutation: null },
    { name: 'Los Jolly Combinasionas', income: 300, mutation: 'Rainbow' },
    { name: 'Esok Sekolah', income: 300, mutation: 'Rainbow' },
    { name: 'Mieteteira Bicicleteira', income: 299, mutation: 'Yin-Yang' },
    { name: 'Los Mobilis', income: 286, mutation: null },
    { name: 'Mieteteira Bicicleteira', income: 286, mutation: 'Galaxy' },
    { name: 'La Jolly Grande', income: 285, mutation: 'Diamond' },
    { name: 'Esok Sekolah', income: 285, mutation: 'Diamond' },
    { name: 'Money Money Puggy', income: 278.2, mutation: 'Gold' },
    { name: 'Los Puggies', income: 277.5, mutation: 'Gold' },
    { name: 'W or L', income: 277.5, mutation: 'Gold' },
    { name: 'Los Candies', income: 276, mutation: null },
    
    // === SCREENSHOT 3 - Lower income (250-265 M/s) ===
    { name: 'Los Mobilis', income: 264, mutation: 'Rainbow' },
    { name: 'Chicleteira Noelteira', income: 262.5, mutation: 'Yin-Yang' },
    { name: 'Chicleteira Noelteira', income: 262.5, mutation: 'Radioactive' },
    { name: 'Money Money Puggy', income: 262.5, mutation: 'Diamond' },
    { name: 'Mieteteira Bicicleteira', income: 260, mutation: null },
    { name: 'Spaghetti Tualetti', income: 255, mutation: 'Gold' },
    { name: 'Ketchuru and Musturu', income: 255, mutation: 'Lava' },
    { name: 'Los 67', income: 253.1, mutation: 'Gold' },
    { name: 'Los Spooky Combinasionas', income: 250, mutation: 'Yin-Yang' },
    { name: 'Los 25', income: 250, mutation: 'Cursed' },
    { name: 'Money Money Reindeer', income: 250, mutation: 'Rainbow' },
    { name: 'Garama and Madundung', income: 250, mutation: null },
    
    // === From search dropdowns - Similar name groups ===
    // "Los" family
    { name: 'Los Tungtungtungcitos', income: 10, mutation: null },
    { name: 'Los Orcalitos', income: 10, mutation: null },
    { name: 'Los Bombinitos', income: 10, mutation: null },
    { name: 'Los Crocodillitos', income: 10, mutation: null },
    { name: 'Los Matteos', income: 10, mutation: null },
    { name: 'Los Chicleteiras', income: 10, mutation: null },
    
    // "Bomb" family
    { name: 'Bombardiro Crocodilo', income: 10, mutation: null },
    { name: 'Bombombini Gusini', income: 10, mutation: null },
    { name: 'Bombardini Tortini', income: 10, mutation: null },
    
    // "67" family
    { name: '67', income: 160, mutation: null },
    { name: 'Los 67', income: 160, mutation: null },
    { name: 'Festive 67', income: 160, mutation: null },
    
    // "Hotspot" family
    { name: 'Pot Hotspot', income: 100, mutation: null },
    { name: 'Los Hotspotsitos', income: 100, mutation: null },
    { name: 'Nooo My Hotspot', income: 100, mutation: null },
    { name: 'Santa Hotspot', income: 100, mutation: null },
    
    // "Noo/Nooo" family
    { name: 'Noo my Present', income: 10, mutation: null },
    
    // === HIGH VALUE brainrots (from previous screenshots) ===
    { name: 'Dragon Cannelloni', income: 1500, mutation: 'Lava' },
    { name: 'Reinito Sleighito', income: 1400, mutation: null },
    { name: 'Fragrama and Chocrama', income: 1400, mutation: null },
    { name: 'La Ginger Sekolah', income: 1400, mutation: null },
    { name: 'Eviledon', income: 992.2, mutation: null },
    { name: 'Reinito Sleighito', income: 840, mutation: 'Lava' },
    { name: 'La Taco Combinasion', income: 822.5, mutation: 'Yin-Yang' },
    { name: 'Swaggy Bros', income: 780, mutation: null },
    { name: 'La Secret Combinasion', income: 750, mutation: null },
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
            
            // Log ALL offers with full titles
            if (result.allPageOffers && result.allPageOffers.length > 0) {
                console.log(`\n📋 ALL OFFERS (${result.allPageOffers.length}):`);
                result.allPageOffers.forEach((o, i) => {
                    const incomeStr = String(o.income || '?').padStart(6);
                    const priceStr = ('$' + (o.price || 0).toFixed(2)).padStart(8);
                    const title = (o.title || 'NO TITLE').substring(0, 70);
                    console.log(`   ${(i+1).toString().padStart(2)}. ${incomeStr}M/s ${priceStr} | ${title}`);
                });
            } else {
                console.log(`\n📋 NO OFFERS FOUND`);
            }
            
            const upperInfo = result.upperOffer 
                ? `${result.upperOffer.income}M/s @ $${result.upperOffer.price.toFixed(2)} (${result.upperOffer.range || 'current'})`
                : '❌ NONE';
            const nextInfo = result.nextCompetitor 
                ? `${result.nextCompetitor.income}M/s @ $${result.nextCompetitor.price.toFixed(2)} (${result.nextCompetitor.range || 'current'})`
                : '⚠️ NONE';
            
            console.log(`\n📊 RESULTS:`);
            console.log(`   Upper:    ${upperInfo}`);
            console.log(`   NextComp: ${nextInfo}`);
            
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
