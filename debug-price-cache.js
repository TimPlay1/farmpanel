/**
 * Debug script to check price_cache data
 */

const { getPool } = require('./utils/mysql-client');

async function debug() {
    const pool = await getPool();
    
    console.log('=== Price Cache Analysis ===\n');
    
    // Check chimnino and esok prices
    const [chimnino] = await pool.query(
        "SELECT cache_key, name, income, suggested_price, updated_at FROM price_cache WHERE cache_key LIKE '%chimnino%' LIMIT 10"
    );
    console.log('Chimnino prices:', JSON.stringify(chimnino, null, 2));
    
    const [esok] = await pool.query(
        "SELECT cache_key, name, income, suggested_price, updated_at FROM price_cache WHERE cache_key LIKE '%esok%' LIMIT 10"
    );
    console.log('\nEsok Sekolah prices:', JSON.stringify(esok, null, 2));
    
    // Check what brainrots are in farmers table that might not have prices
    const [brainrotsWithoutPrices] = await pool.query(`
        SELECT fb.name, fb.income, fb.income_text, fb.mutation
        FROM farmer_brainrots fb
        LEFT JOIN price_cache pc ON 
            LOWER(fb.name) = pc.name AND 
            FLOOR(CASE WHEN fb.income > 10000 THEN fb.income/1000000 ELSE fb.income END / 10) * 10 = pc.income
        WHERE pc.cache_key IS NULL
        LIMIT 20
    `);
    console.log('\nBrainrots WITHOUT prices:', JSON.stringify(brainrotsWithoutPrices, null, 2));
    
    // Check recent updates
    const [recentPrices] = await pool.query(
        "SELECT cache_key, suggested_price, updated_at FROM price_cache ORDER BY updated_at DESC LIMIT 10"
    );
    console.log('\nMost recent prices:', JSON.stringify(recentPrices, null, 2));
    
    // Check scan_state
    const [scanState] = await pool.query("SELECT * FROM scan_state");
    console.log('\nScan state:', JSON.stringify(scanState, null, 2));
    
    // Check La Ginger Sekolah prices 
    const [ginger] = await pool.query(
        "SELECT cache_key, name, income, suggested_price FROM price_cache WHERE cache_key LIKE '%ginger%' ORDER BY income DESC LIMIT 10"
    );
    console.log('\nLa Ginger Sekolah prices:', JSON.stringify(ginger, null, 2));
    
    // Check if there are any B/s range prices
    const [highIncome] = await pool.query(
        "SELECT cache_key, name, income, suggested_price FROM price_cache WHERE income >= 1000 ORDER BY income DESC LIMIT 10"
    );
    console.log('\nHigh income (1B+) prices:', JSON.stringify(highIncome, null, 2));
    
    await pool.end();
    console.log('\nDone!');
}

debug().catch(console.error);
