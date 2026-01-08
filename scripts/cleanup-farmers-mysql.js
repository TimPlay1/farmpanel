/**
 * Скрипт для очистки базы данных от лишних фермеров
 * Оставляет только указанные farm keys
 * 
 * Migrated to MySQL
 */

const { connect, getPool } = require('../utils/mysql-client');

const VALID_FARM_KEYS = [
    'FARM-KFRV-UPE4-U2WJ-JOE6',
    'FARM-7VZV-EY4Y-1OOX-IOQJ',
    'FARM-TAES-479W-XJJ8-4M0J'
];

async function cleanup() {
    const pool = await getPool();
    
    try {
        console.log('Connected to MySQL');
        
        // Получаем всех фермеров
        const [allFarmers] = await pool.query('SELECT id, farm_key, username FROM farmers');
        console.log(`\nTotal farmers in DB: ${allFarmers.length}`);
        console.log('\nAll farm keys:');
        allFarmers.forEach(f => {
            const isValid = VALID_FARM_KEYS.includes(f.farm_key);
            console.log(`  ${isValid ? '✓' : '✗'} ${f.farm_key} - ${f.username || 'Unknown'}`);
        });
        
        // Находим лишних
        const toDelete = allFarmers.filter(f => !VALID_FARM_KEYS.includes(f.farm_key));
        console.log(`\nFarmers to delete: ${toDelete.length}`);
        
        if (toDelete.length === 0) {
            console.log('Nothing to delete!');
            await pool.end();
            return;
        }
        
        // Удаляем связанные данные (каскадно)
        for (const farmer of toDelete) {
            console.log(`Deleting farmer ${farmer.farm_key}...`);
            
            // Получаем аккаунты фермера
            const [accounts] = await pool.query(
                'SELECT id FROM farmer_accounts WHERE farmer_id = ?',
                [farmer.id]
            );
            
            // Удаляем брейнроты для каждого аккаунта
            for (const acc of accounts) {
                await pool.query('DELETE FROM farmer_brainrots WHERE account_id = ?', [acc.id]);
            }
            
            // Удаляем аккаунты
            await pool.query('DELETE FROM farmer_accounts WHERE farmer_id = ?', [farmer.id]);
            
            // Удаляем фермера
            await pool.query('DELETE FROM farmers WHERE id = ?', [farmer.id]);
        }
        
        console.log(`\nDeleted ${toDelete.length} farmers`);
        
        // Также очищаем кэш топов
        await pool.query('DELETE FROM top_cache');
        console.log('Cleared top cache');
        
        // Проверяем результат
        const [remaining] = await pool.query('SELECT farm_key, username FROM farmers');
        console.log(`\nRemaining farmers: ${remaining.length}`);
        remaining.forEach(f => {
            console.log(`  ✓ ${f.farm_key} - ${f.username || 'Unknown'}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
        console.log('\nDisconnected from MySQL');
    }
}

cleanup();
