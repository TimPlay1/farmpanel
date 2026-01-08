/**
 * Test MySQL Adapter
 * Тестирует совместимость нового MySQL адаптера с существующим кодом
 */

// Set env var for testing
process.env.MYSQL_URI = 'mysql://farmerpanel:FpM3Sql!2026Pwd@87.120.216.181:3306/farmerpanel';

const { connectToDatabase, generateAvatar, generateUsername } = require('./api/_lib/db-mysql');

async function testAdapter() {
    console.log('🧪 Testing MySQL Adapter...\n');
    
    try {
        const { db } = await connectToDatabase();
        
        // Test 1: Farmers collection
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Test 1: Farmers Collection');
        console.log('═══════════════════════════════════════════════════════════');
        
        const farmersCollection = db.collection('farmers');
        
        // Count
        const count = await farmersCollection.countDocuments();
        console.log(`✅ Count: ${count} farmers`);
        
        // FindOne
        const farmer = await farmersCollection.findOne({ farmKey: 'FARM-KFRV-UPE4-U2WJ-JOE6' });
        if (farmer) {
            console.log(`✅ FindOne: Found farmer "${farmer.username}"`);
            console.log(`   - Accounts: ${farmer.accounts?.length || 0}`);
            console.log(`   - Avatar: ${farmer.avatar?.icon} ${farmer.avatar?.color}`);
            console.log(`   - PlayerUserIdMap keys: ${Object.keys(farmer.playerUserIdMap || {}).length}`);
            
            // Check brainrots
            let brainrotCount = 0;
            for (const acc of farmer.accounts || []) {
                brainrotCount += acc.brainrots?.length || 0;
            }
            console.log(`   - Total brainrots: ${brainrotCount}`);
        }
        
        // Find all
        const allFarmers = await farmersCollection.find({}).toArray();
        console.log(`✅ Find all: ${allFarmers.length} farmers`);
        
        // Test 2: Offers collection
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('Test 2: Offers Collection');
        console.log('═══════════════════════════════════════════════════════════');
        
        const offersCollection = db.collection('offers');
        
        const offersCount = await offersCollection.countDocuments();
        console.log(`✅ Count: ${offersCount} offers`);
        
        const offers = await offersCollection.find({ farmKey: 'FARM-KFRV-UPE4-U2WJ-JOE6' }).limit(3).toArray();
        console.log(`✅ Find with filter: ${offers.length} offers for hyesos`);
        
        if (offers.length > 0) {
            console.log(`   Sample: ${offers[0].brainrotName} - $${offers[0].currentPrice}`);
        }
        
        // Test 3: Price cache
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('Test 3: Price Cache Collection');
        console.log('═══════════════════════════════════════════════════════════');
        
        const priceCache = db.collection('price_cache');
        
        const priceCount = await priceCache.countDocuments();
        console.log(`✅ Count: ${priceCount} cached prices`);
        
        const samplePrice = await priceCache.findOne({});
        if (samplePrice) {
            console.log(`✅ Sample price: ${samplePrice.name} (${samplePrice.income}ms) = $${samplePrice.suggestedPrice}`);
        }
        
        // Test 4: Balance history
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('Test 4: Balance History Collection');
        console.log('═══════════════════════════════════════════════════════════');
        
        const balanceHistory = db.collection('balance_history');
        
        const historyCount = await balanceHistory.countDocuments();
        console.log(`✅ Count: ${historyCount} history entries`);
        
        const recentHistory = await balanceHistory.find({})
            .sort({ timestamp: -1 })
            .limit(5)
            .toArray();
        console.log(`✅ Recent entries: ${recentHistory.length}`);
        
        // Test 5: Scan state
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('Test 5: Scan State Collection');
        console.log('═══════════════════════════════════════════════════════════');
        
        const scanState = db.collection('scan_state');
        
        const state = await scanState.findOne({ _id: 'price_scanner' });
        if (state) {
            console.log(`✅ Scan state: cycle ${state.cycleId}, last scan: ${state.lastScanAt}`);
        }
        
        // Test 6: Helper functions
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('Test 6: Helper Functions');
        console.log('═══════════════════════════════════════════════════════════');
        
        const avatar = generateAvatar([]);
        console.log(`✅ Generated avatar: ${avatar.icon} ${avatar.color}`);
        
        const username = generateUsername();
        console.log(`✅ Generated username: ${username}`);
        
        // Test 7: Update operations
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('Test 7: Update Operations (read-only test)');
        console.log('═══════════════════════════════════════════════════════════');
        
        // Test updateOne syntax (without actually changing data)
        const testUpdate = await scanState.findOneAndUpdate(
            { _id: 'price_scanner' },
            { $set: { cycleId: state?.cycleId || 0 } },
            { returnDocument: 'after' }
        );
        console.log(`✅ FindOneAndUpdate: cycle ${testUpdate.value?.cycleId}`);
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ ALL TESTS PASSED!');
        console.log('═══════════════════════════════════════════════════════════');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

testAdapter();
