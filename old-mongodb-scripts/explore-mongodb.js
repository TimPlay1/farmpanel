/**
 * MongoDB Data Explorer & Exporter
 * Изучает структуру данных и экспортирует для миграции в MySQL
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/farmerpanel?retryWrites=true&w=majority';

async function exploreAndExport() {
    console.log('🔍 Connecting to MongoDB Atlas...\n');
    
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB Atlas!\n');
        
        const db = client.db('farmerpanel');
        
        // Get all collections
        const collections = await db.listCollections().toArray();
        console.log('📋 Collections found:', collections.length);
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const exportData = {};
        const stats = [];
        
        for (const col of collections) {
            const collection = db.collection(col.name);
            const count = await collection.countDocuments();
            const sample = await collection.findOne();
            
            stats.push({
                name: col.name,
                count,
                sampleFields: sample ? Object.keys(sample) : []
            });
            
            console.log(`📦 ${col.name}: ${count} documents`);
            if (sample) {
                console.log(`   Fields: ${Object.keys(sample).join(', ')}`);
            }
            console.log('');
            
            // Export all documents
            const docs = await collection.find({}).toArray();
            exportData[col.name] = docs;
        }
        
        // Save export
        const exportDir = path.join(__dirname, 'database', 'export');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        
        // Save each collection separately
        for (const [colName, docs] of Object.entries(exportData)) {
            const filePath = path.join(exportDir, `${colName}.json`);
            fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
            console.log(`💾 Exported ${colName} to ${filePath}`);
        }
        
        // Save stats
        fs.writeFileSync(
            path.join(exportDir, '_stats.json'),
            JSON.stringify(stats, null, 2)
        );
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 SUMMARY');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        let totalDocs = 0;
        for (const stat of stats) {
            totalDocs += stat.count;
            console.log(`${stat.name.padEnd(25)} ${stat.count.toString().padStart(6)} docs`);
        }
        console.log('─────────────────────────────────────────');
        console.log(`${'TOTAL'.padEnd(25)} ${totalDocs.toString().padStart(6)} docs`);
        
        console.log(`\n✅ All data exported to: ${exportDir}`);
        
        // Detailed analysis of farmers (the most complex collection)
        if (exportData.farmers && exportData.farmers.length > 0) {
            console.log('\n═══════════════════════════════════════════════════════════');
            console.log('🔍 FARMERS COLLECTION ANALYSIS (most complex)');
            console.log('═══════════════════════════════════════════════════════════\n');
            
            const farmer = exportData.farmers[0];
            console.log('Sample farmer structure:');
            console.log(JSON.stringify(farmer, (key, value) => {
                // Truncate long values
                if (typeof value === 'string' && value.length > 100) {
                    return value.substring(0, 100) + '...[truncated]';
                }
                if (Array.isArray(value) && value.length > 2) {
                    return `[Array of ${value.length} items]`;
                }
                return value;
            }, 2));
            
            // Count nested data
            let totalAccounts = 0;
            let totalBrainrots = 0;
            
            for (const f of exportData.farmers) {
                if (f.accounts) {
                    totalAccounts += f.accounts.length;
                    for (const acc of f.accounts) {
                        if (acc.brainrots) {
                            totalBrainrots += acc.brainrots.length;
                        }
                    }
                }
            }
            
            console.log(`\n📈 Nested data stats:`);
            console.log(`   Farmers: ${exportData.farmers.length}`);
            console.log(`   Accounts (nested): ${totalAccounts}`);
            console.log(`   Brainrots (nested): ${totalBrainrots}`);
        }
        
        return exportData;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.close();
    }
}

exploreAndExport().then(() => {
    console.log('\n✅ Export complete!');
    process.exit(0);
}).catch(err => {
    console.error('Export failed:', err);
    process.exit(1);
});
