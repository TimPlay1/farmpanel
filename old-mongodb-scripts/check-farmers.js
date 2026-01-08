const { MongoClient } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';

async function check() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('farmpanel');
    
    console.log('=== All farmers ===');
    const farmers = await db.collection('farmers').find({}).toArray();
    console.log('Total farmers:', farmers.length);
    
    for (const f of farmers) {
        let brainrotCount = 0;
        if (f.accounts) {
            for (const acc of f.accounts) {
                if (acc.brainrots) brainrotCount += acc.brainrots.length;
            }
        }
        console.log('  -', f.farmKey, '| brainrots:', brainrotCount);
    }
    
    console.log('\n=== All offer_codes ===');
    const codes = await db.collection('offer_codes').find({}).toArray();
    console.log('Total:', codes.length);
    
    console.log('\n=== All offers ===');
    const offers = await db.collection('offers').find({}).toArray();
    console.log('Total:', offers.length);
    
    // Поиск по частичному ключу
    console.log('\n=== Search farmers by partial key (7VZV) ===');
    const partial = await db.collection('farmers').find({
        farmKey: /7VZV/i
    }).toArray();
    console.log('Found:', partial.length);
    for (const f of partial) {
        console.log('  Match:', f.farmKey);
    }
    
    await client.close();
}
check();
