/**
 * Extended test for fuzzy matching edge cases
 * Tests similar brainrot names and potential false positive scenarios
 */

const ep = require('./api/eldorado-price.js');

// Test cases focusing on problematic pairs identified by analysis
const testCases = [
    // === SIMILAR NAME PAIRS (potential confusion) ===
    // These brainrots have very similar names - system must NOT confuse them
    
    // Dragon variants
    { name: 'Dragon Cannelloni', income: 1500, mutation: null, comment: 'vs Dragon Gingerini (100% similar)' },
    { name: 'Dragon Gingerini', income: 500, mutation: null, comment: 'vs Dragon Cannelloni' },
    
    // La Combinasion variants (all 87-100% similar)
    { name: 'La Taco Combinasion', income: 800, mutation: null, comment: 'vs other Combinasions' },
    { name: 'La Secret Combinasion', income: 750, mutation: null, comment: 'vs La Taco/Grande' },
    { name: 'La Grande Combinasion', income: 600, mutation: null, comment: 'vs La Secret/Taco' },
    
    // Los variants (87-100% similar)
    { name: 'Los Mobilis', income: 300, mutation: null, comment: 'vs Los Bombinitos (98%)' },
    { name: 'Los Bombinitos', income: 400, mutation: null, comment: 'vs Los Mobilis (98%)' },
    { name: 'Los Tralaleritos', income: 350, mutation: null, comment: 'vs Las Tralaleritas (90%)' },
    { name: 'Las Tralaleritas', income: 320, mutation: null, comment: 'vs Los Tralaleritos (90%)' },
    
    // Chicleteira variants (95% similar)
    { name: 'Chicleteira Bicicleteira', income: 280, mutation: null, comment: 'vs Noelteira (95%)' },
    { name: 'Chicleteira Noelteira', income: 260, mutation: 'Yin-Yang', comment: 'vs Bicicleteira (95%)' },
    
    // Bombardini variants (87% similar)
    { name: 'Bombardini Tortini', income: 400, mutation: null, comment: 'vs Bombardiro Crocodilo' },
    { name: 'Bombardiro Crocodilo', income: 350, mutation: null, comment: 'vs Bombardini Tortini' },
    
    // Tralala variants (83% similar)
    { name: 'Tralalero Tralala', income: 300, mutation: null, comment: 'vs Tralalita Tralala' },
    { name: 'Tralalita Tralala', income: 280, mutation: null, comment: 'vs Tralalero Tralala' },
    
    // Sahur variants
    { name: 'Te Te Te Sahur', income: 250, mutation: null, comment: 'vs To to to Sahur (90%)' },
    { name: 'To to to Sahur', income: 260, mutation: null, comment: 'vs Te Te Te Sahur' },
    { name: 'Ho Ho Ho Sahur', income: 270, mutation: null, comment: 'vs other Sahurs' },
    { name: 'Tictac Sahur', income: 375, mutation: 'Rainbow', comment: 'Similar to List List List Sahur' },
    
    // === SHORT/SINGLE WORD BRAINROTS (high false positive risk) ===
    { name: 'Matteo', income: 200, mutation: null, comment: 'Short single word (6 chars)' },
    { name: 'Meowl', income: 300, mutation: null, comment: 'Short single word (5 chars)' },
    { name: 'Eviledon', income: 900, mutation: null, comment: 'Single word (8 chars)' },
    { name: 'Chimino', income: 266, mutation: null, comment: 'Our: Chimnino, Eldorado: Chimino' },
    { name: 'Alessio', income: 150, mutation: null, comment: 'Short single word' },
    
    // === LOS XX NUMBER PATTERN (must match exactly) ===
    { name: 'Los 25', income: 200, mutation: null, comment: 'Must NOT match Los 67' },
    { name: 'Los 67', income: 253, mutation: 'Gold', comment: 'Must NOT match Los 25' },
    
    // === BRAINROTS WITH SIMILAR COMMON WORDS ===
    // These have common words that might cause confusion
    { name: 'Money Money Puggy', income: 320, mutation: 'Gold', comment: 'vs Money Money Reindeer (70%)' },
    { name: 'Money Money Reindeer', income: 280, mutation: null, comment: 'vs Money Money Puggy' },
    
    { name: 'Swag Soda', income: 200, mutation: null, comment: 'vs Swaggy Bros (80%)' },
    { name: 'Swaggy Bros', income: 780, mutation: null, comment: 'vs Swag Soda' },
    
    // === POTENTIAL FALSE POSITIVE TRIGGERS ===
    // These should NOT trigger wrong brainrot detection
    { name: 'Reinito Sleighito', income: 840, mutation: 'Lava', comment: 'Title may have "trait" word' },
    { name: 'La Ginger Sekolah', income: 1400, mutation: null, comment: 'Title may have "instant delivery"' },
    { name: 'Ketchuru and Musturu', income: 350, mutation: 'Gold', comment: 'Title may have "trail"' },
    
    // === REAL BRAINROTS THAT MATCH COMMON WORDS ===
    // These ARE brainrots but sound like common words
    { name: 'Chrismasmamat', income: 300, mutation: null, comment: 'Sounds like "christmas"' },
    { name: 'Santa Hotspot', income: 350, mutation: null, comment: 'Has "santa" in name' },
    { name: 'Chimpanzini Spiderini', income: 400, mutation: null, comment: 'Has "spider" in name' },
    
    // === BRAINROTS NOT IN ELDORADO LIST ===
    { name: 'Los Spooky Combinasionas', income: 305, mutation: null, comment: 'Uses Other+searchQuery' },
    { name: 'Skibidi Toilet', income: 200, mutation: null, comment: 'In our list, not in Eldorado' },
];

async function runTests() {
    console.log('🚀 Extended Fuzzy Matching Tests\n');
    console.log('='.repeat(120));
    
    const results = [];
    let passCount = 0;
    let failCount = 0;
    
    for (const tc of testCases) {
        console.log(`\n${'─'.repeat(100)}`);
        console.log(`🔍 ${tc.name} | ${tc.income}M/s | ${tc.mutation || 'Default'}`);
        console.log(`   📝 ${tc.comment}`);
        console.log('─'.repeat(100));
        
        try {
            const result = await ep.searchBrainrotOffers(tc.name, tc.income, 3, {
                disableAI: true,
                mutation: tc.mutation
            });
            
            const hasUpper = !!result.upperOffer;
            const hasNext = !!result.nextCompetitor;
            const offersCount = result.allPageOffers?.length || 0;
            
            const status = hasUpper ? '✅ PASS' : '⚠️ NO UPPER';
            if (hasUpper) passCount++; else failCount++;
            
            console.log(`\n   ${status}`);
            console.log(`   Upper: ${hasUpper ? `${result.upperOffer.income}M/s @ $${result.upperOffer.price.toFixed(2)}` : 'none'}`);
            console.log(`   NextComp: ${hasNext ? `${result.nextCompetitor.income}M/s @ $${result.nextCompetitor.price.toFixed(2)}` : 'none'}`);
            console.log(`   Offers: ${offersCount}`);
            
            results.push({
                ...tc,
                status: hasUpper ? 'PASS' : 'FAIL',
                upper: result.upperOffer,
                next: result.nextCompetitor,
                offers: offersCount
            });
            
        } catch (err) {
            console.error(`   ❌ ERROR: ${err.message}`);
            results.push({ ...tc, status: 'ERROR', error: err.message });
            failCount++;
        }
        
        // Small delay between tests
        await new Promise(r => setTimeout(r, 150));
    }
    
    // Summary
    console.log('\n\n' + '='.repeat(120));
    console.log('📊 SUMMARY');
    console.log('='.repeat(120));
    console.log(`\nTotal: ${results.length} | ✅ Pass: ${passCount} | ⚠️ Fail: ${failCount}`);
    console.log(`Success rate: ${Math.round(passCount / results.length * 100)}%`);
    
    // Show failures
    const failures = results.filter(r => r.status !== 'PASS');
    if (failures.length > 0) {
        console.log('\n⚠️ FAILURES:');
        for (const f of failures) {
            console.log(`   - ${f.name} (${f.mutation || 'Default'}): ${f.error || 'No upper found'} - ${f.comment}`);
        }
    }
    
    // Category breakdown
    console.log('\n📈 BY CATEGORY:');
    const categories = {
        'Similar Pairs': results.filter(r => r.comment.includes('vs') || r.comment.includes('similar')),
        'Short Names': results.filter(r => r.comment.includes('Short') || r.comment.includes('chars')),
        'Los XX Pattern': results.filter(r => r.name.startsWith('Los ') && /\d/.test(r.name)),
        'Common Words': results.filter(r => r.comment.includes('Sounds like') || r.comment.includes('Has "')),
        'Not in Eldorado': results.filter(r => r.comment.includes('not in Eldorado') || r.comment.includes('Other+searchQuery'))
    };
    
    for (const [cat, items] of Object.entries(categories)) {
        const catPass = items.filter(i => i.status === 'PASS').length;
        console.log(`   ${cat}: ${catPass}/${items.length} (${Math.round(catPass / items.length * 100)}%)`);
    }
}

runTests().catch(console.error);
