const { MongoClient } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';

async function check() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('farmpanel');
    
    // Сколько всего офферов
    const count = await db.collection('offers').countDocuments();
    console.log('Total offers:', count);
    
    // Получить 5 последних
    const offers = await db.collection('offers').find({}).limit(5).toArray();
    for (const o of offers) {
        console.log('---');
        console.log('brainrotName:', o.brainrotName);
        console.log('income:', o.income, '(type:', typeof o.income, ')');
        console.log('farmKey:', o.farmKey);
    }
    
    // Проверить офферы с income <= 0
    const badOffers = await db.collection('offers').find({
        $or: [
            { income: { $lte: 0 } },
            { income: null },
            { income: { $exists: false } }
        ]
    }).toArray();
    console.log('\n=== Offers with bad income:', badOffers.length);
    
    await client.close();
}
check();
