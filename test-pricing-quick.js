const { calculateOptimalPrice } = require('./api/eldorado-price');

async function test() {
    console.log('Testing pricing with median and nextCompetitor...\n');
    
    // Test with popular brainrot
    const result = await calculateOptimalPrice('Bombardiro Crocodilo', '80M/s');
    
    console.log('\nResult for Bombardiro Crocodilo 80M/s:');
    console.log('  suggestedPrice:', result.suggestedPrice ? `$${result.suggestedPrice.toFixed(2)}` : 'N/A');
    console.log('  medianPrice:', result.medianPrice ? `$${result.medianPrice.toFixed(2)}` : 'N/A');
    console.log('  nextCompetitorPrice:', result.nextCompetitorPrice ? `$${result.nextCompetitorPrice.toFixed(2)}` : 'N/A');
    
    if (result.medianData) {
        console.log('  medianData:', result.medianData);
    }
    
    if (result.nextCompetitorData) {
        console.log('  nextCompetitorData:', result.nextCompetitorData);
    }
    
    console.log('\n✅ Test complete');
    process.exit(0);
}

test().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
