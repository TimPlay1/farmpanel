/**
 * Comprehensive test of fuzzy matching with edge cases
 * v10.3.41 - Testing all potential problem cases
 */

const ep = require('./api/eldorado-price.js');

// Test cases grouped by category
const testCases = [
    // === CATEGORY 1: Brainrots with "Tral" prefix (match trait/trail) ===
    { name: 'Tralalita Tralala', income: 300, mutation: null, note: 'Should NOT match "trait"' },
    { name: 'Tralaledon', income: 300, mutation: null, note: 'Should NOT match "trade"' },
    { name: 'Las Tralaleritas', income: 300, mutation: null, note: 'Similar fuzzy key' },
    { name: 'Los Tralaleritos', income: 300, mutation: null, note: 'Similar fuzzy key' },
    { name: 'Tralalero Tralala', income: 300, mutation: null },
    
    // === CATEGORY 2: Brainrots with common English word parts ===
    { name: 'Chimpanzini Spiderini', income: 300, mutation: null, note: 'Contains "spider"' },
    { name: 'Santa Hotspot', income: 300, mutation: null, note: 'Contains "santa"' },
    { name: 'Dragon Cannelloni', income: 1500, mutation: 'Lava', note: 'Contains "dragon"' },
    { name: 'Strawberry Elephant', income: 300, mutation: null, note: 'Contains "strawberry", "elephant"' },
    { name: 'Skibidi Toilet', income: 300, mutation: null, note: 'Contains "toilet"' },
    { name: 'Meowl', income: 300, mutation: null, note: 'Short name (5 chars)' },
    { name: 'Matteo', income: 300, mutation: null, note: 'Short name (6 chars)' },
    
    // === CATEGORY 3: Los/La/Las prefix families ===
    { name: 'Los 25', income: 260, mutation: null, note: 'Number-based' },
    { name: 'Los 67', income: 260, mutation: 'Gold', note: 'Number-based' },
    { name: 'Los Candies', income: 350, mutation: 'Galaxy' },
    { name: 'Los Mobilis', income: 350, mutation: 'Yin-Yang' },
    { name: 'Los Lucky Block', income: 300, mutation: null, note: 'Contains "lucky block"' },
    { name: 'La Secret Combinasion', income: 750, mutation: null },
    { name: 'La Grande Combinasion', income: 500, mutation: 'Gold' },
    { name: 'Las Tralaleritas', income: 300, mutation: null },
    
    // === CATEGORY 4: Holiday/seasonal themed ===
    { name: 'Chrismasmamat', income: 300, mutation: null, note: 'Similar to "christmas"' },
    { name: 'Festive 67', income: 300, mutation: null, note: 'Contains "festive"' },
    { name: 'Festive Lucky Block', income: 300, mutation: null },
    
    // === CATEGORY 5: Similar sounding pairs ===
    { name: 'Chicleteira Bicicleteira', income: 300, mutation: null },
    { name: 'Chicleteira Noelteira', income: 300, mutation: 'Yin-Yang' },
    { name: 'Bombardini Tortini', income: 300, mutation: null, note: 'Similar to "Bombardiro"' },
    { name: 'Bombardiro Crocodilo', income: 300, mutation: null },
    { name: 'Orcaledon', income: 300, mutation: null },
    { name: 'Orcalero Orcala', income: 300, mutation: null },
    { name: 'Eviledon', income: 992, mutation: null },
    
    // === CATEGORY 6: Money/Candy themed ===
    { name: 'Money Money Puggy', income: 350, mutation: 'Rainbow' },
    { name: 'Money Money Reindeer', income: 300, mutation: null },
    
    // === CATEGORY 7: Very short names ===
    { name: 'W or L', income: 300, mutation: null, note: 'Very short (6 chars)' },
    { name: '1x1x1x1', income: 300, mutation: null, note: 'Number-based' },
    { name: 'Chimino', income: 308, mutation: 'Rainbow', note: 'Short, alias Chimnino' },
    { name: 'Alessio', income: 300, mutation: null },
    { name: 'Bunnyman', income: 300, mutation: null },
    
    // === CATEGORY 8: Ginger themed ===
    { name: 'La Ginger Sekolah', income: 1400, mutation: null },
    { name: 'Dragon Gingerini', income: 300, mutation: null },
    { name: 'Gingerat Gerat', income: 300, mutation: null, note: 'Similar to "entrega"' },
    
    // === CATEGORY 9: High value brainrots ===
    { name: 'Reinito Sleighito', income: 1400, mutation: null, note: 'Test SLEGITO typo detection' },
    { name: 'Fragrama and Chocrama', income: 1400, mutation: null },
    { name: 'Swaggy Bros', income: 780, mutation: null },
    { name: 'La Taco Combinasion', income: 822, mutation: 'Yin-Yang' },
];

async function runTests() {
    console.log('🚀 Comprehensive fuzzy matching test - v10.3.41');
    console.log('='.repeat(80) + '\n');
    
    // Initialize - use searchBrainrotOffers which loads dynamic brainrots internally
    
    const results = [];
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        const { name, income, mutation, note } = testCase;
        
        console.log('='.repeat(80));
        console.log(`🔍 ${name} | ${income}M/s | ${mutation || 'Default'}`);
        if (note) console.log(`   📝 ${note}`);
        console.log('='.repeat(80));
        
        try {
            const result = await ep.searchBrainrotOffers(name, income, 5, {
                disableAI: true,
                mutation: mutation === 'Default' ? null : mutation
            });
            
            const hasUpper = result.upperOffer !== null;
            const hasNextComp = result.nextCompetitor !== null;
            
            if (hasUpper) {
                passed++;
                results.push({
                    name,
                    mutation: mutation || 'Default',
                    income,
                    upper: result.upperOffer.price,
                    nextComp: result.nextCompetitor ? result.nextCompetitor.price : null,
                    offers: result.allPageOffers?.length || 0,
                    status: '✅'
                });
            } else {
                failed++;
                results.push({
                    name,
                    mutation: mutation || 'Default',
                    income,
                    upper: 'none',
                    nextComp: result.nextCompetitor ? result.nextCompetitor.price : 'none',
                    offers: result.allPageOffers?.length || 0,
                    status: '❌'
                });
            }
            
            console.log(`\n📊 RESULTS:`);
            console.log(`   Upper:    ${result.upperOffer ? '$' + result.upperOffer.price.toFixed(2) : '❌ NONE'}`);
            console.log(`   NextComp: ${result.nextCompetitor ? '$' + result.nextCompetitor.price.toFixed(2) : '⚠️ NONE'}`);
            console.log(`   Offers:   ${result.allPageOffers?.length || 0}`);
            
        } catch (err) {
            failed++;
            console.error(`   ❌ ERROR: ${err.message}`);
            results.push({
                name,
                mutation: mutation || 'Default',
                income,
                upper: 'ERROR',
                nextComp: 'ERROR',
                offers: 0,
                status: '❌'
            });
        }
        
        // Small delay between tests
        await new Promise(r => setTimeout(r, 200));
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY TABLE');
    console.log('='.repeat(80));
    console.log('| Brainrot                    | Mutation    | Income | Upper      | NextComp   | Status |');
    console.log('|-----------------------------|-------------|--------|------------|------------|--------|');
    
    results.forEach(r => {
        const upperStr = r.upper === 'none' || r.upper === null ? '❌ none' : (typeof r.upper === 'number' ? '$' + r.upper.toFixed(2) : String(r.upper));
        const nextStr = r.nextComp === 'none' || r.nextComp === null ? '⚠️ none' : (typeof r.nextComp === 'number' ? '$' + r.nextComp.toFixed(2) : String(r.nextComp));
        console.log(`| ${r.name.padEnd(27)} | ${(r.mutation || 'Default').padEnd(11)} | ${String(r.income).padEnd(6)} | ${upperStr.padEnd(10)} | ${nextStr.padEnd(10)} | ${r.status.padEnd(6)} |`);
    });
    
    console.log('\n📈 STATISTICS:');
    console.log(`   Total tests: ${testCases.length}`);
    console.log(`   Passed (has Upper): ${passed}/${testCases.length} (${Math.round(passed/testCases.length*100)}%)`);
    console.log(`   Failed (no Upper): ${failed}/${testCases.length}`);
    
    // Group failures by category
    const failures = results.filter(r => r.status === '❌');
    if (failures.length > 0) {
        console.log('\n⚠️ FAILURES:');
        failures.forEach(f => {
            console.log(`   - ${f.name} (${f.mutation})`);
        });
    }
    
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
