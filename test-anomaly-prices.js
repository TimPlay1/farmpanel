/**
 * Тест аномальных цен - проверка всех брейнротов со скриншотов
 */

const { searchBrainrotOffers, calculateOptimalPrice } = require('./api/eldorado-price.js');

const testCases = [
    // Аномальные случаи со скриншотов
    { name: 'Esok Sekolah', income: 150, expectedNextMax: 5 },
    { name: 'Chimnino', income: 185.5, expectedNextMax: 10 },
    { name: 'Los Mobilis', income: 363, expectedNextMax: 15 },
    
    // Остальные брейнроты со скриншотов
    { name: 'Los Primos', income: 496 },
    { name: 'Los Burritos', income: 174.2 },
    { name: 'Los Candies', income: 333.5 },
    { name: 'Los Burritos', income: 93.5 },
    { name: 'La Jolly Grande', income: 270 },
    { name: 'Mieteteira Bicicleteira', income: 377 },
    { name: 'Los 25', income: 100 },
    { name: 'Los 67', income: 258.8 },
    { name: 'Chimnino', income: 161 },
    { name: 'Los Spooky Combinasionas', income: 150 },
    { name: 'Money Money Puggy', income: 105 },
    { name: 'Chimnino', income: 129.5 },
    { name: 'Los Burritos', income: 119 },
    { name: 'Esok Sekolah', income: 255 },
    { name: 'Eviledon', income: 992.2 },
    { name: 'La Ginger Sekolah', income: 637.5 },
    { name: 'Spaghetti Tualetti', income: 510 },
    { name: 'Mieteteira Bicicleteira', income: 494 },
    { name: 'Esok Sekolah', income: 360 },
    { name: 'Ketupat Kepat', income: 350 },
    { name: 'Money Money Puggy', income: 346.5 },
    { name: 'Mieteteira Bicicleteira', income: 325 },
    { name: 'Los Candies', income: 287.5 },
    { name: 'Mieteteira Bicicleteira', income: 273 },
    { name: 'Chicleteira Noelteira', income: 270 },
    { name: 'Chimnino', income: 266 },
    { name: 'Chicleteira Noelteira', income: 262.5 },
    { name: 'Los Spooky Combinasionas', income: 250 },
    { name: 'Los Combinasionas', income: 247.5 },
    { name: 'Los Combinasionas', income: 243.8 },
    { name: 'Los Mobilis', income: 225.5 },
    { name: 'Los 67', income: 225 },
    { name: 'Los Mobilis', income: 220 },
];

async function runTests() {
    console.log('🧪 Testing anomaly prices...\n');
    console.log('='.repeat(120));
    
    const results = [];
    const anomalies = [];
    
    for (const test of testCases) {
        try {
            console.log(`\n📊 Testing: ${test.name} @ ${test.income}M/s`);
            console.log('-'.repeat(80));
            
            const result = await calculateOptimalPrice(test.name, test.income);
            
            if (result.error) {
                console.log(`   ❌ Error: ${result.error}`);
                results.push({ ...test, error: result.error });
                continue;
            }
            
            // Показываем все данные
            console.log(`   📍 Suggested:  $${result.suggestedPrice?.toFixed(2) || 'N/A'}`);
            console.log(`   📊 Median:     $${result.medianPrice?.toFixed(2) || 'N/A'}`);
            console.log(`   📈 NextComp:   $${result.nextCompetitorPrice?.toFixed(2) || 'N/A'}`);
            console.log(`   🎯 Upper:      ${result.competitorIncome}M/s @ $${result.competitorPrice?.toFixed(2) || 'N/A'}`);
            console.log(`   📉 Lower:      ${result.lowerIncome}M/s @ $${result.lowerPrice?.toFixed(2) || 'N/A'}`);
            console.log(`   📜 Source:     ${result.priceSource?.substring(0, 80) || 'N/A'}`);
            
            if (result.nextCompetitorData) {
                console.log(`   🔼 NextData:   ${result.nextCompetitorData.income}M/s @ $${result.nextCompetitorData.price?.toFixed(2)} "${result.nextCompetitorData.title}"`);
            }
            
            if (result.medianData) {
                console.log(`   📊 MedianData: page ${result.medianData.pageNumber}, ${result.medianData.offersUsed} offers, median=$${result.medianData.medianValue?.toFixed(2)}`);
            }
            
            // Показываем samples
            if (result.samples && result.samples.length > 0) {
                console.log(`   📋 Samples (first 3):`);
                result.samples.slice(0, 3).forEach((s, i) => {
                    console.log(`      ${i+1}. ${s.income}M/s @ $${s.price?.toFixed(2)} "${s.title}" [${s.source}]`);
                });
            }
            
            // Проверяем на аномалии
            const isAnomaly = (
                (result.nextCompetitorPrice && result.nextCompetitorPrice > 20) ||
                (result.suggestedPrice && result.suggestedPrice > 50) ||
                (test.expectedNextMax && result.nextCompetitorPrice > test.expectedNextMax)
            );
            
            if (isAnomaly) {
                console.log(`   ⚠️ ANOMALY DETECTED!`);
                anomalies.push({
                    name: test.name,
                    income: test.income,
                    nextCompetitorPrice: result.nextCompetitorPrice,
                    suggestedPrice: result.suggestedPrice,
                    nextCompetitorData: result.nextCompetitorData
                });
            }
            
            results.push({
                name: test.name,
                income: test.income,
                suggested: result.suggestedPrice,
                median: result.medianPrice,
                nextComp: result.nextCompetitorPrice,
                isAnomaly
            });
            
            // Пауза между запросами
            await new Promise(r => setTimeout(r, 500));
            
        } catch (err) {
            console.log(`   ❌ Exception: ${err.message}`);
            results.push({ ...test, error: err.message });
        }
    }
    
    // Итоговый отчёт
    console.log('\n' + '='.repeat(120));
    console.log('📊 SUMMARY REPORT');
    console.log('='.repeat(120));
    
    console.log(`\nTotal tests: ${results.length}`);
    console.log(`Anomalies found: ${anomalies.length}`);
    
    if (anomalies.length > 0) {
        console.log('\n⚠️ ANOMALIES:');
        anomalies.forEach(a => {
            console.log(`   - ${a.name} @ ${a.income}M/s: nextComp=$${a.nextCompetitorPrice?.toFixed(2)}, suggested=$${a.suggestedPrice?.toFixed(2)}`);
            if (a.nextCompetitorData) {
                console.log(`     NextComp data: ${a.nextCompetitorData.income}M/s @ $${a.nextCompetitorData.price?.toFixed(2)} "${a.nextCompetitorData.title}"`);
            }
        });
    }
    
    // Таблица результатов
    console.log('\n📋 RESULTS TABLE:');
    console.log('-'.repeat(100));
    console.log('Name'.padEnd(30) + 'Income'.padStart(10) + 'Suggested'.padStart(12) + 'Median'.padStart(12) + 'NextComp'.padStart(12) + 'Status'.padStart(15));
    console.log('-'.repeat(100));
    
    results.forEach(r => {
        const status = r.error ? '❌ ERROR' : (r.isAnomaly ? '⚠️ ANOMALY' : '✅ OK');
        const suggested = r.suggested ? `$${r.suggested.toFixed(2)}` : 'N/A';
        const median = r.median ? `$${r.median.toFixed(2)}` : 'N/A';
        const nextComp = r.nextComp ? `$${r.nextComp.toFixed(2)}` : 'N/A';
        
        console.log(
            r.name.substring(0, 28).padEnd(30) +
            `${r.income}`.padStart(10) +
            suggested.padStart(12) +
            median.padStart(12) +
            nextComp.padStart(12) +
            status.padStart(15)
        );
    });
}

runTests().catch(console.error);
