/**
 * MongoDB to MySQL Migration Script
 * Мигрирует все данные из экспортированных JSON файлов в MySQL
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// MySQL connection config
const MYSQL_CONFIG = {
    host: '87.120.216.181',
    port: 3306,
    user: 'farmerpanel',
    password: 'FpM3Sql!2026Pwd',
    database: 'farmerpanel',
    charset: 'utf8mb4'
};

const EXPORT_DIR = path.join(__dirname, 'database', 'export');

async function migrate() {
    console.log('🚀 Starting MongoDB to MySQL Migration...\n');
    
    const pool = mysql.createPool(MYSQL_CONFIG);
    
    try {
        // Test connection
        const conn = await pool.getConnection();
        console.log('✅ Connected to MySQL!\n');
        conn.release();
        
        // Migration order matters due to foreign keys
        const migrationOrder = [
            'farmers',           // 1. Main farmers table
            'farmer_accounts',   // 2. Accounts (from farmers.accounts)
            'farmer_brainrots',  // 3. Brainrots (from accounts.brainrots)
            'accountAvatars',    // 4. Avatars
            'offers',            // 5. Offers
            'offer_codes',       // 6. Offer codes
            'price_cache',       // 7. Price cache
            'global_brainrot_prices', // 8. Global prices
            'balance_history',   // 9. Balance history
            'scan_state',        // 10. Scan state
            'ai_queue',          // 11. AI queue
            'ai_price_cache',    // 12. AI cache
            'rate_limits',       // 13. Rate limits
            'user_colors',       // 14. User colors
            'top_cache',         // 15. Top cache
            'generations',       // 16. Generations
        ];
        
        const stats = {};
        
        for (const collection of migrationOrder) {
            stats[collection] = await migrateCollection(pool, collection);
        }
        
        // Print summary
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 MIGRATION SUMMARY');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        let totalMigrated = 0;
        for (const [name, count] of Object.entries(stats)) {
            console.log(`${name.padEnd(25)} ${count.toString().padStart(6)} rows`);
            totalMigrated += count;
        }
        console.log('─────────────────────────────────────────');
        console.log(`${'TOTAL'.padEnd(25)} ${totalMigrated.toString().padStart(6)} rows`);
        
        await pool.end();
        return stats;
        
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        await pool.end();
        throw error;
    }
}

async function migrateCollection(pool, collection) {
    const filePath = path.join(EXPORT_DIR, `${collection}.json`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️ Skipping ${collection} - no export file found`);
        return 0;
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (data.length === 0) {
        console.log(`⏭️ Skipping ${collection} - empty collection`);
        return 0;
    }
    
    console.log(`\n📦 Migrating ${collection} (${data.length} documents)...`);
    
    try {
        switch (collection) {
            case 'farmers':
                return await migrateFarmers(pool, data);
            case 'farmer_accounts':
                // Already handled in farmers migration
                return 0;
            case 'farmer_brainrots':
                // Already handled in farmers migration
                return 0;
            case 'accountAvatars':
                return await migrateAccountAvatars(pool, data);
            case 'offers':
                return await migrateOffers(pool, data);
            case 'offer_codes':
                return await migrateOfferCodes(pool, data);
            case 'price_cache':
                return await migratePriceCache(pool, data);
            case 'global_brainrot_prices':
                return await migrateGlobalPrices(pool, data);
            case 'balance_history':
                return await migrateBalanceHistory(pool, data);
            case 'scan_state':
                return await migrateScanState(pool, data);
            case 'ai_queue':
                return await migrateAiQueue(pool, data);
            case 'ai_price_cache':
                return await migrateAiPriceCache(pool, data);
            case 'rate_limits':
                return await migrateRateLimits(pool, data);
            case 'user_colors':
                return await migrateUserColors(pool, data);
            case 'top_cache':
                return await migrateTopCache(pool, data);
            case 'generations':
                return await migrateGenerations(pool, data);
            default:
                console.log(`⚠️ Unknown collection: ${collection}`);
                return 0;
        }
    } catch (error) {
        console.error(`❌ Error migrating ${collection}:`, error.message);
        return 0;
    }
}

// ============================================================
// Individual migration functions
// ============================================================

async function migrateFarmers(pool, data) {
    let farmerCount = 0;
    let accountCount = 0;
    let brainrotCount = 0;
    
    for (const farmer of data) {
        // Insert farmer
        const [result] = await pool.execute(
            `INSERT INTO farmers (farm_key, username, shop_name, avatar_icon, avatar_color, total_value, value_updated_at, last_timestamp, created_at, last_update)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE username = VALUES(username), shop_name = VALUES(shop_name)`,
            [
                farmer.farmKey,
                farmer.username,
                farmer.shopName || null,
                farmer.avatar?.icon || 'fa-gem',
                farmer.avatar?.color || '#FF6B6B',
                farmer.totalValue || 0,
                farmer.valueUpdatedAt ? new Date(farmer.valueUpdatedAt) : null,
                farmer.lastTimestamp || null,
                farmer.createdAt ? new Date(farmer.createdAt) : new Date(),
                farmer.lastUpdate ? new Date(farmer.lastUpdate) : new Date()
            ]
        );
        
        const farmerId = result.insertId || (await pool.execute(
            'SELECT id FROM farmers WHERE farm_key = ?',
            [farmer.farmKey]
        ))[0][0]?.id;
        
        farmerCount++;
        
        // Insert accounts
        if (farmer.accounts && farmerId) {
            for (const account of farmer.accounts) {
                const [accResult] = await pool.execute(
                    `INSERT INTO farmer_accounts (farmer_id, player_name, user_id, balance, status, action, is_online, last_update)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE balance = VALUES(balance), status = VALUES(status), is_online = VALUES(is_online)`,
                    [
                        farmerId,
                        account.playerName,
                        account.userId || null,
                        account.balance || 0,
                        account.status || 'idle',
                        account.action || null,
                        account.isOnline || false,
                        account.lastUpdate ? new Date(account.lastUpdate) : null
                    ]
                );
                
                const accountId = accResult.insertId || (await pool.execute(
                    'SELECT id FROM farmer_accounts WHERE farmer_id = ? AND player_name = ?',
                    [farmerId, account.playerName]
                ))[0][0]?.id;
                
                accountCount++;
                
                // Insert brainrots
                if (account.brainrots && accountId) {
                    // Delete existing brainrots first (to avoid duplicates on re-run)
                    await pool.execute('DELETE FROM farmer_brainrots WHERE account_id = ?', [accountId]);
                    
                    for (const brainrot of account.brainrots) {
                        await pool.execute(
                            `INSERT INTO farmer_brainrots (account_id, name, income, income_text, mutation, image_url)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [
                                accountId,
                                brainrot.name,
                                parseIncome(brainrot.income),
                                brainrot.incomeText || brainrot.income || null,
                                brainrot.mutation || null,
                                brainrot.imageUrl || null
                            ]
                        );
                        brainrotCount++;
                    }
                }
            }
        }
    }
    
    console.log(`   ✅ Farmers: ${farmerCount}, Accounts: ${accountCount}, Brainrots: ${brainrotCount}`);
    return farmerCount + accountCount + brainrotCount;
}

async function migrateAccountAvatars(pool, data) {
    let count = 0;
    for (const avatar of data) {
        await pool.execute(
            `INSERT INTO account_avatars (user_id, player_name, base64_image, fetched_at)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE base64_image = VALUES(base64_image)`,
            [
                avatar.userId,
                avatar.playerName || null,
                avatar.base64 || null,
                avatar.fetchedAt || null
            ]
        );
        count++;
    }
    console.log(`   ✅ Migrated ${count} avatars`);
    return count;
}

async function migrateOffers(pool, data) {
    let count = 0;
    for (const offer of data) {
        await pool.execute(
            `INSERT INTO offers (farm_key, offer_id, brainrot_name, income, income_raw, current_price, recommended_price, image_url, eldorado_offer_id, account_id, status, paused_at, last_scanned_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE current_price = VALUES(current_price), status = VALUES(status)`,
            [
                offer.farmKey,
                offer.offerId,
                offer.brainrotName || null,
                parseIncome(offer.income),
                offer.incomeRaw || null,
                offer.currentPrice || null,
                offer.recommendedPrice || null,
                offer.imageUrl || null,
                offer.eldoradoOfferId || null,
                offer.accountId || null,
                offer.status || 'pending',
                offer.pausedAt ? new Date(offer.pausedAt) : null,
                offer.lastScannedAt ? new Date(offer.lastScannedAt) : null,
                offer.createdAt ? new Date(offer.createdAt) : new Date(),
                offer.updatedAt ? new Date(offer.updatedAt) : new Date()
            ]
        );
        count++;
    }
    console.log(`   ✅ Migrated ${count} offers`);
    return count;
}

async function migrateOfferCodes(pool, data) {
    if (data.length === 0) return 0;
    
    let count = 0;
    for (const code of data) {
        await pool.execute(
            `INSERT INTO offer_codes (code, farm_key, brainrot_name, income, status)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE farm_key = VALUES(farm_key)`,
            [
                code.code || code._id,
                code.farmKey,
                code.brainrotName || null,
                parseIncome(code.income),
                code.status || 'pending'
            ]
        );
        count++;
    }
    console.log(`   ✅ Migrated ${count} offer codes`);
    return count;
}

async function migratePriceCache(pool, data) {
    let count = 0;
    for (const price of data) {
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
    }
    console.log(`   ✅ Migrated ${count} price cache entries`);
    return count;
}

async function migrateGlobalPrices(pool, data) {
    let count = 0;
    for (const price of data) {
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
    }
    console.log(`   ✅ Migrated ${count} global prices`);
    return count;
}

async function migrateBalanceHistory(pool, data) {
    // Batch insert for performance
    const BATCH_SIZE = 500;
    let count = 0;
    
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        const values = batch.map(record => [
            record.farmKey,
            record.value || 0,
            record.timestamp ? new Date(record.timestamp) : new Date(),
            record.source || 'client'
        ]);
        
        const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
        const flatValues = values.flat();
        
        await pool.execute(
            `INSERT INTO balance_history (farm_key, value, timestamp, source) VALUES ${placeholders}`,
            flatValues
        );
        
        count += batch.length;
        process.stdout.write(`   Migrating balance history: ${count}/${data.length}\r`);
    }
    
    console.log(`   ✅ Migrated ${count} balance history entries`);
    return count;
}

async function migrateScanState(pool, data) {
    let count = 0;
    for (const state of data) {
        await pool.execute(
            `INSERT INTO scan_state (id, cycle_id, last_scan_at, total_scanned)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE cycle_id = VALUES(cycle_id), last_scan_at = VALUES(last_scan_at)`,
            [
                state._id,
                state.cycleId || 0,
                state.lastScanAt ? new Date(state.lastScanAt) : null,
                state.totalScanned || 0
            ]
        );
        count++;
    }
    console.log(`   ✅ Migrated ${count} scan states`);
    return count;
}

async function migrateAiQueue(pool, data) {
    let count = 0;
    for (const item of data) {
        await pool.execute(
            `INSERT INTO ai_queue (cache_key, name, income, mutation, regex_price, status, retries, added_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status)`,
            [
                item._id,
                item.name || null,
                item.income || null,
                item.mutation || null,
                item.regexPrice || null,
                item.status || 'pending',
                item.retries || 0,
                item.addedAt ? new Date(item.addedAt) : new Date()
            ]
        );
        count++;
    }
    console.log(`   ✅ Migrated ${count} AI queue items`);
    return count;
}

async function migrateAiPriceCache(pool, data) {
    let count = 0;
    for (const cache of data) {
        await pool.execute(
            `INSERT INTO ai_price_cache (cache_key, data, timestamp)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data)`,
            [
                cache._id,
                JSON.stringify(cache.data),
                cache.timestamp || Date.now()
            ]
        );
        count++;
    }
    console.log(`   ✅ Migrated ${count} AI cache entries`);
    return count;
}

async function migrateRateLimits(pool, data) {
    // Skip old rate limits - they're ephemeral
    console.log(`   ⏭️ Skipping rate limits (ephemeral data)`);
    return 0;
}

async function migrateUserColors(pool, data) {
    let count = 0;
    for (const color of data) {
        await pool.execute(
            `INSERT INTO user_colors (farm_key, color)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE color = VALUES(color)`,
            [
                color._id,
                color.color
            ]
        );
        count++;
    }
    console.log(`   ✅ Migrated ${count} user colors`);
    return count;
}

async function migrateTopCache(pool, data) {
    let count = 0;
    for (const cache of data) {
        await pool.execute(
            `INSERT INTO top_cache (type, data, updated_at)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data)`,
            [
                cache.type || cache._id,
                JSON.stringify(cache.data),
                cache.updatedAt ? new Date(cache.updatedAt) : new Date()
            ]
        );
        count++;
    }
    console.log(`   ✅ Migrated ${count} top cache entries`);
    return count;
}

async function migrateGenerations(pool, data) {
    let count = 0;
    for (const gen of data) {
        await pool.execute(
            `INSERT INTO generations (farm_key, data, created_at)
             VALUES (?, ?, ?)`,
            [
                gen.farmKey,
                JSON.stringify(gen.generations || gen.data),
                gen.createdAt ? new Date(gen.createdAt) : new Date()
            ]
        );
        count++;
    }
    console.log(`   ✅ Migrated ${count} generations`);
    return count;
}

// Helper to parse income (can be number, string, or object)
function parseIncome(income) {
    if (income === null || income === undefined) return null;
    if (typeof income === 'number') return Math.round(income);
    if (typeof income === 'string') {
        const match = income.match(/[\d.]+/);
        return match ? Math.round(parseFloat(match[0])) : null;
    }
    return null;
}

// Run migration
migrate().then(() => {
    console.log('\n✅ Migration complete!');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
});
