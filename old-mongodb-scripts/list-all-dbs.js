const { MongoClient } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';

async function check() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    console.log('=== All databases ===');
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    
    for (const dbInfo of dbs.databases) {
        console.log('\n📁 Database:', dbInfo.name);
        const db = client.db(dbInfo.name);
        const collections = await db.listCollections().toArray();
        
        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log('  📋', col.name, ':', count, 'docs');
        }
    }
    
    await client.close();
}
check();
