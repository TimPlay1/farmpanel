/**
 * Check and update price_cache in MongoDB
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';

async function checkPriceCache() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('farmpanel');
    const collection = db.collection('price_cache');
    
    // Проверяем конкретные брейнроты
    const keys = [
        'esok sekolah_150',
        'chimnino_185.5', 
        'chimnino_190',
        'los mobilis_363',
        'los mobilis_360'
    ];
    
    console.log('Checking price_cache in MongoDB...\n');
    
    for (const key of keys) {
        const doc = await collection.findOne({ _id: key });
        if (doc) {
            console.log('Key:', key);
            console.log('  suggestedPrice:', doc.suggestedPrice);
            console.log('  medianPrice:', doc.medianPrice);
            console.log('  nextCompetitorPrice:', doc.nextCompetitorPrice);
            console.log('  nextCompetitorData:', JSON.stringify(doc.nextCompetitorData));
            console.log('  updatedAt:', doc.updatedAt);
            console.log('');
        } else {
            console.log('Key:', key, '- NOT FOUND\n');
        }
    }
    
    // Статистика
    const total = await collection.countDocuments();
    const withMedian = await collection.countDocuments({ medianPrice: { $exists: true, $ne: null } });
    const withNext = await collection.countDocuments({ nextCompetitorPrice: { $exists: true, $ne: null } });
    
    console.log('Statistics:');
    console.log('  Total prices:', total);
    console.log('  With medianPrice:', withMedian);
    console.log('  With nextCompetitorPrice:', withNext);
    
    // Показать примеры с высокими nextCompetitorPrice
    console.log('\nExamples with high nextCompetitorPrice (>$20):');
    const highPrices = await collection.find({ 
        nextCompetitorPrice: { $gt: 20 } 
    }).limit(10).toArray();
    
    for (const doc of highPrices) {
        console.log(`  ${doc._id}: next=$${doc.nextCompetitorPrice}, suggested=$${doc.suggestedPrice}`);
    }
    
    await client.close();
}

checkPriceCache().catch(console.error);
