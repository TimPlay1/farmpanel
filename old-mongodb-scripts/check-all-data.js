const { MongoClient } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';

async function check() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('farmpanel');
    
    console.log('=== Checking all collections ===\n');
    
    // Проверим offer_codes
    const codesCount = await db.collection('offer_codes').countDocuments();
    console.log('offer_codes:', codesCount, 'documents');
    
    if (codesCount > 0) {
        const sample = await db.collection('offer_codes').find({}).limit(3).toArray();
        console.log('Sample offer_codes:');
        sample.forEach(c => {
            console.log('  -', c.code, '| farmKey:', c.farmKey, '| brainrot:', c.brainrotName, '| income:', c.income);
        });
    }
    
    // Проверим offers
    const offersCount = await db.collection('offers').countDocuments();
    console.log('\noffers:', offersCount, 'documents');
    
    // Проверим farmers для нашего ключа
    const farmer = await db.collection('farmers').findOne({ farmKey: 'FARM-7VZV-EY4Y-1OOX-IOQJ' });
    if (farmer) {
        console.log('\nFarmer found!');
        if (farmer.accounts) {
            let total = 0;
            for (const acc of farmer.accounts) {
                if (acc.brainrots) total += acc.brainrots.length;
            }
            console.log('Total brainrots in collection:', total);
            
            // Найти Los Primos
            for (const acc of farmer.accounts) {
                if (acc.brainrots) {
                    const losPrimos = acc.brainrots.filter(b => b.name && b.name.toLowerCase().includes('los primos'));
                    for (const lp of losPrimos) {
                        console.log('  Los Primos:', lp.name, '| income:', lp.income, '| mutation:', lp.mutation);
                    }
                }
            }
        }
    } else {
        console.log('\nFarmer not found for key FARM-7VZV-EY4Y-1OOX-IOQJ');
    }
    
    // Проверить offer_codes для Los Primos
    console.log('\n=== Los Primos in offer_codes ===');
    const lpCodes = await db.collection('offer_codes').find({
        brainrotName: /los primos/i
    }).toArray();
    console.log('Found:', lpCodes.length);
    for (const c of lpCodes) {
        console.log('  -', c.code, '| income:', c.income, '| farmKey:', c.farmKey);
    }
    
    await client.close();
}
check();
