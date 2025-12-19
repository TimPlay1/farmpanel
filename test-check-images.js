// Проверка текущих imageUrl в базе
const { connectToDatabase } = require('./api/_lib/db');

async function checkImageUrls() {
    const { db, client } = await connectToDatabase();
    const offersCollection = db.collection('offers');
    
    // Получим несколько офферов из базы
    const offers = await offersCollection.find({}).limit(5).toArray();
    
    console.log('Current image URLs in database:');
    console.log('================================');
    for (const offer of offers) {
        console.log('Offer:', offer.offerId || offer.name);
        console.log('imageUrl:', offer.imageUrl || 'NOT SET');
        console.log('---');
    }
    
    // Посчитаем сколько офферов с неправильным или пустым imageUrl
    const wrongUrls = await offersCollection.countDocuments({
        $or: [
            { imageUrl: { $exists: false } },
            { imageUrl: null },
            { imageUrl: '' },
            { imageUrl: { $regex: /^https:\/\/offerimages\.eldorado\.gg/ } }
        ]
    });
    
    const total = await offersCollection.countDocuments({});
    console.log(`\nOffers with missing/wrong imageUrl: ${wrongUrls}/${total}`);
    
    await client.close();
}

checkImageUrls().catch(console.error);
