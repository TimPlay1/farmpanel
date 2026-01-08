/**
 * Re-migrate price tables after schema fix
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const MYSQL_CONFIG = {
    host: '87.120.216.181',
    port: 3306,
    user: 'farmerpanel',
    password: 'FpM3Sql!2026Pwd',
    database: 'farmerpanel',
    charset: 'utf8mb4'
};

const EXPORT_DIR = path.join(__dirname, 'database', 'export');

async function migratePrices() {
    console.log('🚀 Re-migrating price tables...\n');
    
    const pool = mysql.createPool(MYSQL_CONFIG);
    
    try {
        // Migrate price_cache
        const priceCacheData = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, 'price_cache.json'), 'utf8'));
        console.log(`📦 Migrating price_cache (${priceCacheData.length} documents)...`);
        
        let count = 0;
        for (const price of priceCacheData) {
            try {
                await pool.execute(
                    `INSERT INTO price_cache (cache_key, name, income, mutation, suggested_price, source, price_source, competitor_price, competitor_income, cycle_id, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE suggested_price = VALUES(suggested_price), updated_at = VALUES(updated_at)`,
                    [
                        price._id,
                        price.name || null,
                        price.income || null,
                        price.mutation || null,
                        price.suggestedPrice || null,
                        price.source || null,
                        price.priceSource || null,
                        price.competitorPrice || null,
                        price.competitorIncome || null,
                        price.cycleId || 0,
                        price.updatedAt ? new Date(price.updatedAt) : new Date()
                    ]
                );
                count++;
            } catch (e) {
                console.error(`   Error on ${price._id}:`, e.message);
            }
        }
        console.log(`   ✅ Migrated ${count} price cache entries`);
        
        // Migrate global_brainrot_prices
        const globalPricesData = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, 'global_brainrot_prices.json'), 'utf8'));
        console.log(`\n📦 Migrating global_brainrot_prices (${globalPricesData.length} documents)...`);
        
        count = 0;
        for (const price of globalPricesData) {
            try {
                await pool.execute(
                    `INSERT INTO global_brainrot_prices (cache_key, suggested_price, previous_price, pending_price, is_spike, spike_detected_at, competitor_price, competitor_income, price_source, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE suggested_price = VALUES(suggested_price)`,
                    [
                        price.cacheKey || price._id,
                        price.suggestedPrice || null,
                        price.previousPrice || null,
                        price.pendingPrice || null,
                        price.isSpike || false,
                        price.spikeDetectedAt ? new Date(price.spikeDetectedAt) : null,
                        price.competitorPrice || null,
                        price.competitorIncome || null,
                        price.priceSource || null,
                        price.updatedAt ? new Date(price.updatedAt) : new Date()
                    ]
                );
                count++;
            } catch (e) {
                console.error(`   Error on ${price.cacheKey || price._id}:`, e.message);
            }
        }
        console.log(`   ✅ Migrated ${count} global prices`);
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        await pool.end();
        throw error;
    }
}

migratePrices().then(() => {
    console.log('\n✅ Price migration complete!');
    process.exit(0);
}).catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
