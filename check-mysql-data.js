/**
 * Check all data in MySQL database
 * Migrated from MongoDB version
 */

const { connect, getFarmersWithBrainrots } = require('./utils/mysql-client');

async function check() {
    const client = await connect();
    const db = client.db('farmpanel');
    
    console.log('=== Checking all MySQL tables ===\n');
    
    // Check offer_codes
    const codesCount = await db.collection('offer_codes').countDocuments();
    console.log('offer_codes:', codesCount, 'documents');
    
    if (codesCount > 0) {
        const sample = await db.collection('offer_codes').find({}).limit(3).toArray();
        console.log('Sample offer_codes:');
        sample.forEach(c => {
            console.log('  -', c.code, '| farmKey:', c.farmKey, '| brainrot:', c.brainrotName, '| income:', c.income);
        });
    }
    
    // Check offers
    const offersCount = await db.collection('offers').countDocuments();
    console.log('\noffers:', offersCount, 'documents');
    
    // Check farmers with nested data
    const farmers = await getFarmersWithBrainrots({ farmKey: 'FARM-KFRV-UPE4-U2WJ-JOE6' });
    if (farmers.length > 0) {
        const farmer = farmers[0];
        console.log('\nFarmer found!');
        if (farmer.accounts) {
            let total = 0;
            for (const acc of farmer.accounts) {
                if (acc.brainrots) total += acc.brainrots.length;
            }
            console.log('Total brainrots in collection:', total);
            
            // Show some brainrots
            for (const acc of farmer.accounts) {
                if (acc.brainrots) {
                    for (const b of acc.brainrots.slice(0, 5)) {
                        console.log('  -', b.name, '| income:', b.income, '| mutation:', b.mutation);
                    }
                }
            }
        }
    } else {
        console.log('\nFarmer not found');
    }
    
    // Check other tables
    console.log('\n=== Table counts ===');
    const tables = ['price_cache', 'global_brainrot_prices', 'balance_history', 'farmer_accounts', 'farmer_brainrots'];
    for (const table of tables) {
        const count = await db.collection(table).countDocuments();
        console.log(`${table}: ${count} rows`);
    }
    
    await client.close();
    console.log('\nDone!');
}

check().catch(console.error);
