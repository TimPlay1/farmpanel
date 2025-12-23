/**
 * Check global_brainrot_prices collection
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';

async function checkGlobalPrices() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('farmpanel');
    const collection = db.collection('global_brainrot_prices');
    
    console.log('Checking global_brainrot_prices in MongoDB...\n');
    
    const total = await collection.countDocuments();
    console.log('Total documents:', total);
    
    if (total === 0) {
        console.log('Collection is empty!');
        await client.close();
        return;
    }
    
    // Проверяем конкретные брейнроты
    const searchTerms = [
        'esok sekolah',
        'chimnino',
        'los mobilis'
    ];
    
    for (const term of searchTerms) {
        console.log(`\n--- Searching for "${term}" ---`);
        const docs = await collection.find({ 
            cacheKey: { $regex: new RegExp(term, 'i') }
        }).limit(5).toArray();
        
        console.log(`Found: ${docs.length} documents`);
        for (const doc of docs) {
            console.log(`  ${doc.cacheKey}:`);
            console.log(`    suggestedPrice: $${doc.suggestedPrice}`);
            console.log(`    medianPrice: ${doc.medianPrice ? '$' + doc.medianPrice : 'N/A'}`);
            console.log(`    nextCompetitorPrice: ${doc.nextCompetitorPrice ? '$' + doc.nextCompetitorPrice : 'N/A'}`);
            console.log(`    competitorPrice: ${doc.competitorPrice ? '$' + doc.competitorPrice : 'N/A'}`);
            console.log(`    updatedAt: ${doc.updatedAt}`);
        }
    }
    
    // Статистика по полям
    console.log('\n--- Statistics ---');
    const withMedian = await collection.countDocuments({ medianPrice: { $exists: true, $ne: null } });
    const withNext = await collection.countDocuments({ nextCompetitorPrice: { $exists: true, $ne: null } });
    console.log('With medianPrice:', withMedian);
    console.log('With nextCompetitorPrice:', withNext);
    
    // Примеры с высокими nextCompetitorPrice
    console.log('\n--- Documents with nextCompetitorPrice > $20 ---');
    const highPrices = await collection.find({ 
        nextCompetitorPrice: { $gt: 20 } 
    }).limit(10).toArray();
    
    for (const doc of highPrices) {
        console.log(`  ${doc.cacheKey}: next=$${doc.nextCompetitorPrice}, suggested=$${doc.suggestedPrice}`);
    }
    
    // Показать sample документ со всеми полями
    console.log('\n--- Sample document structure ---');
    const sample = await collection.findOne();
    console.log(JSON.stringify(sample, null, 2));
    
    await client.close();
}

checkGlobalPrices().catch(console.error);
