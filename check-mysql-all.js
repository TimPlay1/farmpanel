/**
 * Check all MySQL tables with counts
 * Migrated from MongoDB check-all-collections.js
 */

const { connect, getPool } = require('./utils/mysql-client');

async function checkAll() {
    const pool = await getPool();
    
    console.log('=== MySQL Database Tables ===\n');
    
    const tables = [
        'farmers',
        'farmer_accounts', 
        'farmer_brainrots',
        'account_avatars',
        'offers',
        'offer_codes',
        'price_cache',
        'global_brainrot_prices',
        'balance_history',
        'scan_state',
        'ai_queue',
        'ai_price_cache',
        'rate_limits',
        'user_colors',
        'top_cache',
        'generations',
        'queues',
        'delete_queues',
        'adjustment_queue'
    ];
    
    let totalRows = 0;
    
    for (const table of tables) {
        try {
            const [[result]] = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
            const count = result.count;
            totalRows += count;
            const status = count > 0 ? '✅' : '⚪';
            console.log(`${status} ${table}: ${count} rows`);
        } catch (err) {
            console.log(`❌ ${table}: ERROR - ${err.message}`);
        }
    }
    
    console.log(`\n📊 Total rows: ${totalRows}`);
    
    // Show sample data from key tables
    console.log('\n=== Sample Data ===\n');
    
    // Farmers
    const [[farmerSample]] = await pool.query('SELECT farm_key, created_at FROM farmers LIMIT 3');
    if (farmerSample) {
        console.log('Farmers:');
        const [farmers] = await pool.query('SELECT farm_key, created_at FROM farmers LIMIT 3');
        farmers.forEach(f => console.log(`  - ${f.farm_key} (created: ${f.created_at})`));
    }
    
    // Offers
    const [offersSample] = await pool.query('SELECT brainrot_name, current_price, status FROM offers LIMIT 3');
    if (offersSample.length > 0) {
        console.log('\nOffers:');
        offersSample.forEach(o => console.log(`  - ${o.brainrot_name} | $${o.current_price} | ${o.status}`));
    }
    
    // Balance history stats
    const [[bhStats]] = await pool.query(`
        SELECT 
            COUNT(*) as total,
            MIN(timestamp) as oldest,
            MAX(timestamp) as newest
        FROM balance_history
    `);
    console.log(`\nBalance History: ${bhStats.total} entries`);
    console.log(`  Oldest: ${bhStats.oldest}`);
    console.log(`  Newest: ${bhStats.newest}`);
    
    await pool.end();
    console.log('\nDone!');
}

checkAll().catch(console.error);
