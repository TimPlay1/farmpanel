/**
 * Check global brainrot prices in MySQL
 * Migrated from MongoDB version
 */

const { connect, getPool } = require('./utils/mysql-client');

async function checkPrices() {
    const client = await connect();
    const db = client.db('farmpanel');
    const pool = await getPool();
    
    console.log('=== Global Brainrot Prices ===\n');
    
    const count = await db.collection('global_brainrot_prices').countDocuments();
    console.log('Total price entries:', count);
    
    // Get sample prices
    const [prices] = await pool.query(`
        SELECT brainrot_key, min_price, max_price, avg_price, median_price, sample_count, last_updated
        FROM global_brainrot_prices 
        ORDER BY last_updated DESC 
        LIMIT 20
    `);
    
    console.log('\nRecent prices:');
    for (const p of prices) {
        console.log(`  ${p.brainrot_key}`);
        console.log(`    Min: $${p.min_price} | Max: $${p.max_price} | Avg: $${p.avg_price} | Median: $${p.median_price}`);
        console.log(`    Samples: ${p.sample_count} | Updated: ${p.last_updated}`);
    }
    
    // Check price_cache
    console.log('\n=== Price Cache ===');
    const cacheCount = await db.collection('price_cache').countDocuments();
    console.log('Total cache entries:', cacheCount);
    
    const [cache] = await pool.query(`
        SELECT brainrot_key, price, competitor_price, price_source, updated_at
        FROM price_cache
        ORDER BY updated_at DESC
        LIMIT 10
    `);
    
    console.log('\nRecent cache:');
    for (const c of cache) {
        console.log(`  ${c.brainrot_key} | $${c.price} | competitor: $${c.competitor_price}`);
    }
    
    await client.close();
    console.log('\nDone!');
}

checkPrices().catch(console.error);
