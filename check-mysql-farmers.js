/**
 * Check farmers in MySQL database
 * Migrated from MongoDB version
 */

const { connect, getFarmersWithBrainrots, getPool } = require('./utils/mysql-client');

async function check() {
    const client = await connect();
    const db = client.db('farmpanel');
    
    console.log('=== All farmers ===');
    
    // Get all farmers with brainrots
    const farmers = await getFarmersWithBrainrots();
    console.log('Total farmers:', farmers.length);
    
    for (const f of farmers) {
        let brainrotCount = 0;
        if (f.accounts) {
            for (const acc of f.accounts) {
                if (acc.brainrots) brainrotCount += acc.brainrots.length;
            }
        }
        console.log('  -', f.farmKey, '| accounts:', f.accounts?.length || 0, '| brainrots:', brainrotCount);
    }
    
    console.log('\n=== All offer_codes ===');
    const codes = await db.collection('offer_codes').find({}).toArray();
    console.log('Total:', codes.length);
    
    console.log('\n=== All offers ===');
    const offers = await db.collection('offers').find({}).toArray();
    console.log('Total:', offers.length);
    
    // Show sample offers
    if (offers.length > 0) {
        console.log('\nSample offers:');
        for (const o of offers.slice(0, 5)) {
            console.log('  -', o.brainrotName, '| price: $' + o.currentPrice, '| status:', o.status);
        }
    }
    
    // Search farmers by partial key
    console.log('\n=== Search farmers by partial key (KFRV) ===');
    const pool = await getPool();
    const [partial] = await pool.query("SELECT * FROM farmers WHERE farm_key LIKE '%KFRV%'");
    console.log('Found:', partial.length);
    for (const f of partial) {
        console.log('  Match:', f.farm_key);
    }
    
    await client.close();
}

check().catch(console.error);
