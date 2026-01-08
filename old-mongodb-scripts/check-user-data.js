const { MongoClient } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';

async function check() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('farmerpanel'); // правильная база!
    
    console.log('=== Farmers ===');
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
    
    // Поиск пользователя
    console.log('\n=== Search for FARM-7VZV-EY4Y-1OOX-IOQJ ===');
    const farmer = await db.collection('farmers').findOne({ farmKey: 'FARM-7VZV-EY4Y-1OOX-IOQJ' });
    if (farmer) {
        console.log('Found!');
        let total = 0;
        if (farmer.accounts) {
            for (const acc of farmer.accounts) {
                if (acc.brainrots) {
                    total += acc.brainrots.length;
                    // Найти Los Primos
                    const losPrimos = acc.brainrots.filter(b => b.name && b.name.toLowerCase().includes('los primos'));
                    for (const lp of losPrimos) {
                        console.log('  Los Primos:', lp.name, '| income:', lp.income, '| mutation:', lp.mutation);
                    }
                }
            }
        }
        console.log('Total brainrots:', total);
    } else {
        console.log('Not found');
    }
    
    // Офферы пользователя
    console.log('\n=== Offers for FARM-7VZV-EY4Y-1OOX-IOQJ ===');
    const offers = await db.collection('offers').find({ farmKey: 'FARM-7VZV-EY4Y-1OOX-IOQJ' }).toArray();
    console.log('Total offers:', offers.length);
    
    for (const o of offers) {
        console.log('  -', o.brainrotName, '| income:', o.income, '(type:', typeof o.income, ') | mutation:', o.mutation);
    }
    
    // Найти Los Primos в офферах
    console.log('\n=== Los Primos in ALL offers ===');
    const lpOffers = await db.collection('offers').find({
        brainrotName: /los primos/i
    }).toArray();
    console.log('Found:', lpOffers.length);
    for (const o of lpOffers) {
        console.log('  -', o.brainrotName, '| income:', o.income, '| farmKey:', o.farmKey);
    }
    
    await client.close();
}
check();
