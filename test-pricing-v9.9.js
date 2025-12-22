/**
 * Тест системы ценообразования v9.9.0
 * Проверяет работу медианы и следующего компетитора
 */

const { calculateOptimalPrice } = require('./api/eldorado-price.js');

// Тестовые брейнроты
const TEST_BRAINROTS = [
    // B/s уровень
    { name: 'La Secret Combinasion', income: 1500 },
    
    // 500-749 M/s
    { name: 'Swaggy Bros', income: 660 },
    
    // 250-499 M/s
    { name: 'Los Primos', income: 496 },
    { name: 'Los Mobilis', income: 363 },
    
    // 100-249 M/s
    { name: 'Eviledon', income: 220.5 },
    { name: 'Esok Sekolah', income: 150 },
    { name: 'La Secret Combinasion', income: 187.5 },
    
    // 50-99 M/s
    { name: 'Los 25', income: 85 },
];

async function runTests() {
    console.log('='.repeat(80));
    console.log('PRICING SYSTEM TEST v9.9.0');
    console.log('Testing: Median Price + Next Competitor Price');
    console.log('='.repeat(80));
    
    const results = [];
    
    for (const brainrot of TEST_BRAINROTS) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing: ${brainrot.name} @ ${brainrot.income} M/s`);
        console.log('='.repeat(60));
        
        try {
            const result = await calculateOptimalPrice(brainrot.name, brainrot.income);
            results.push({
                ...result,
                testName: brainrot.name,
                testIncome: brainrot.income
            });
            
            console.log('\n📋 PRICE RESULTS:');
            console.log(`   suggestedPrice:       $${result.suggestedPrice?.toFixed(2) || 'N/A'}`);
            console.log(`   medianPrice:          $${result.medianPrice?.toFixed(2) || 'N/A'}`);
            console.log(`   nextCompetitorPrice:  $${result.nextCompetitorPrice?.toFixed(2) || 'N/A'}`);
            
            if (result.medianData) {
                console.log(`   medianData: page ${result.medianData.pageNumber}, ${result.medianData.offersOnPage} offers, median $${result.medianData.medianValue?.toFixed(2)}`);
            }
            if (result.nextCompetitorData) {
                console.log(`   nextCompetitor: ${result.nextCompetitorData.income}M/s @ $${result.nextCompetitorData.price?.toFixed(2)} (page ${result.nextCompetitorData.page})`);
            }
            
            // Задержка между запросами
            await new Promise(r => setTimeout(r, 500));
            
        } catch (err) {
            console.error(`❌ Error: ${err.message}`);
            results.push({ 
                error: err.message, 
                testName: brainrot.name, 
                testIncome: brainrot.income 
            });
        }
    }
    
    // Сводка
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY TABLE');
    console.log('='.repeat(80));
    
    console.log('\n| Brainrot               | Income  | Range        | Current | Median  | Next    |');
    console.log('|------------------------|---------|--------------|---------|---------|---------|');
    
    for (const r of results) {
        const name = (r.testName || r.brainrotName || '').substring(0, 22).padEnd(22);
        const income = String(r.testIncome || '').padStart(7);
        const range = (r.targetMsRange || 'N/A').padEnd(12);
        const current = r.suggestedPrice ? `$${r.suggestedPrice.toFixed(2).padStart(5)}` : '  N/A ';
        const median = r.medianPrice ? `$${r.medianPrice.toFixed(2).padStart(5)}` : '  N/A ';
        const next = r.nextCompetitorPrice ? `$${r.nextCompetitorPrice.toFixed(2).padStart(5)}` : '  N/A ';
        
        console.log(`| ${name} | ${income} | ${range} | ${current} | ${median} | ${next} |`);
    }
    
    // Статистика
    const withSuggested = results.filter(r => r.suggestedPrice !== null && r.suggestedPrice !== undefined);
    const withMedian = results.filter(r => r.medianPrice !== null);
    const withNext = results.filter(r => r.nextCompetitorPrice !== null);
    
    console.log('\nStatistics:');
    console.log(`  Total tested:          ${results.length}`);
    console.log(`  With suggested price:  ${withSuggested.length} (${Math.round(withSuggested.length / results.length * 100)}%)`);
    console.log(`  With median price:     ${withMedian.length} (${Math.round(withMedian.length / results.length * 100)}%)`);
    console.log(`  With next competitor:  ${withNext.length} (${Math.round(withNext.length / results.length * 100)}%)`);
    
    // Сравнение цен
    console.log('\n📊 Price Comparison (median vs current):');
    for (const r of results) {
        if (r.suggestedPrice && r.medianPrice) {
            const diff = r.medianPrice - r.suggestedPrice;
            const pct = (diff / r.suggestedPrice * 100).toFixed(1);
            const emoji = diff > 0 ? '📈' : (diff < 0 ? '📉' : '➡️');
            console.log(`   ${r.testName}: ${emoji} median ${diff > 0 ? '+' : ''}$${diff.toFixed(2)} (${pct}%)`);
        }
    }
    
    return results;
}

// Запуск
runTests().then(() => {
    console.log('\n✅ Tests completed');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Tests failed:', err);
    process.exit(1);
});
