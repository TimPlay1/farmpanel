/**
 * Скрипт для очистки базы данных от лишних фермеров
 * Оставляет только указанные farm keys
 */

const { MongoClient } = require('mongodb');

// Читаем MONGODB_URI из .env файла вручную
const fs = require('fs');
const path = require('path');
let MONGODB_URI = process.env.MONGODB_URI;

try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/MONGODB_URI=(.+)/);
        if (match) {
            MONGODB_URI = match[1].trim();
        }
    }
} catch (e) {
    // ignore
}

const VALID_FARM_KEYS = [
    'FARM-KFRV-UPE4-U2WJ-JOE6',
    'FARM-7VZV-EY4Y-1OOX-IOQJ',
    'FARM-TAES-479W-XJJ8-4M0J'
];

async function cleanup() {
    const uri = MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not set. Create .env file with MONGODB_URI=your_connection_string');
        process.exit(1);
    }

    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('farmerpanel');
        const farmersCollection = db.collection('farmers');
        
        // Получаем всех фермеров
        const allFarmers = await farmersCollection.find({}).toArray();
        console.log(`\nTotal farmers in DB: ${allFarmers.length}`);
        console.log('\nAll farm keys:');
        allFarmers.forEach(f => {
            const isValid = VALID_FARM_KEYS.includes(f.farmKey);
            console.log(`  ${isValid ? '✓' : '✗'} ${f.farmKey} - ${f.username || 'Unknown'}`);
        });
        
        // Находим лишних
        const toDelete = allFarmers.filter(f => !VALID_FARM_KEYS.includes(f.farmKey));
        console.log(`\nFarmers to delete: ${toDelete.length}`);
        
        if (toDelete.length === 0) {
            console.log('Nothing to delete!');
            return;
        }
        
        // Удаляем лишних
        const deleteKeys = toDelete.map(f => f.farmKey);
        const result = await farmersCollection.deleteMany({
            farmKey: { $nin: VALID_FARM_KEYS }
        });
        
        console.log(`\nDeleted ${result.deletedCount} farmers`);
        
        // Также очищаем кэш топов
        const topCacheCollection = db.collection('top_cache');
        await topCacheCollection.deleteMany({});
        console.log('Cleared top cache');
        
        // Проверяем результат
        const remaining = await farmersCollection.find({}).toArray();
        console.log(`\nRemaining farmers: ${remaining.length}`);
        remaining.forEach(f => {
            console.log(`  ✓ ${f.farmKey} - ${f.username || 'Unknown'}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
        console.log('\nDisconnected from MongoDB');
    }
}

cleanup();
