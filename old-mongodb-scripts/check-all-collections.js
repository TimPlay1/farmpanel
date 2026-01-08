/**
 * Check all collections in MongoDB
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';

async function checkAllCollections() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('farmpanel');
    
    console.log('Checking all collections in MongoDB...\n');
    
    // Получить список всех коллекций
    const collections = await db.listCollections().toArray();
    console.log('Collections found:', collections.map(c => c.name).join(', '));
    console.log('');
    
    for (const col of collections) {
        const collection = db.collection(col.name);
        const count = await collection.countDocuments();
        console.log(`${col.name}: ${count} documents`);
        
        // Показать пример документа
        if (count > 0) {
            const sample = await collection.findOne();
            console.log('  Sample keys:', Object.keys(sample).join(', '));
            
            // Если это prices или похожее - показать больше
            if (col.name.includes('price') || col.name.includes('cache')) {
                console.log('  Sample data:', JSON.stringify(sample, null, 2).substring(0, 500));
            }
        }
        console.log('');
    }
    
    // Проверяем коллекцию offers
    const offersCol = db.collection('offers');
    const offersCount = await offersCol.countDocuments();
    if (offersCount > 0) {
        console.log('\n--- Checking offers collection ---');
        
        // Ищем Esok Sekolah
        const esokOffers = await offersCol.find({ 
            brainrotName: { $regex: /esok sekolah/i }
        }).limit(5).toArray();
        
        console.log('Esok Sekolah offers:', esokOffers.length);
        for (const offer of esokOffers) {
            console.log(`  ${offer.brainrotName} ${offer.income}: current=$${offer.currentPrice}, recommended=$${offer.recommendedPrice}, nextComp=$${offer.nextCompetitorPrice}`);
        }
    }
    
    await client.close();
}

checkAllCollections().catch(console.error);
