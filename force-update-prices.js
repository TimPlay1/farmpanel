/**
 * Force update prices for specific brainrots
 * Вызывает API напрямую и обновляет данные
 */

const { calculateOptimalPrice } = require('./api/eldorado-price.js');
const { connectToDatabase } = require('./api/_lib/db');

// Брейнроты со скриншотов с проблемными ценами
const brainrotsToUpdate = [
    { name: 'Esok Sekolah', income: 150 },
    { name: 'Chimnino', income: 185.5 },
    { name: 'Los Mobilis', income: 363 },
    { name: 'La Ginger Sekolah', income: 637.5 },
    { name: 'Mieteteira Bicicleteira', income: 494 },
    { name: 'Los Primos', income: 496 },
    // Добавь другие если нужно
];

async function forceUpdatePrices() {
    console.log('🔄 Force updating prices for problematic brainrots...\n');
    
    const { db } = await connectToDatabase();
    const collection = db.collection('price_cache');
    
    for (const br of brainrotsToUpdate) {
        try {
            console.log(`📊 Updating: ${br.name} @ ${br.income}M/s`);
            
            const result = await calculateOptimalPrice(br.name, br.income);
            
            if (result.error) {
                console.log(`   ❌ Error: ${result.error}`);
                continue;
            }
            
            // Формируем ключ для MongoDB
            const cacheKey = `${br.name.toLowerCase()}_${br.income}`;
            
            // Обновляем в MongoDB
            const updateData = {
                suggestedPrice: result.suggestedPrice,
                source: result.parsingSource || 'regex',
                priceSource: result.priceSource,
                competitorPrice: result.competitorPrice,
                competitorIncome: result.competitorIncome,
                targetMsRange: result.targetMsRange,
                medianPrice: result.medianPrice,
                medianData: result.medianData,
                nextCompetitorPrice: result.nextCompetitorPrice,
                nextCompetitorData: result.nextCompetitorData,
                nextRangeChecked: result.nextRangeChecked,
                isInEldoradoList: result.isInEldoradoList,
                lowerPrice: result.lowerPrice,
                lowerIncome: result.lowerIncome,
                name: br.name,
                income: br.income,
                updatedAt: new Date()
            };
            
            await collection.updateOne(
                { _id: cacheKey },
                { $set: updateData },
                { upsert: true }
            );
            
            console.log(`   ✅ Updated: suggested=$${result.suggestedPrice?.toFixed(2)}, median=$${result.medianPrice?.toFixed(2) || 'N/A'}, next=$${result.nextCompetitorPrice?.toFixed(2) || 'N/A'}`);
            
            // Пауза между запросами
            await new Promise(r => setTimeout(r, 500));
            
        } catch (err) {
            console.log(`   ❌ Exception: ${err.message}`);
        }
    }
    
    console.log('\n✅ Force update complete!');
    console.log('Refresh the page to see updated prices.');
    process.exit(0);
}

forceUpdatePrices().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
