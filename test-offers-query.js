process.env.MYSQL_HOST = '87.120.216.181';
process.env.MYSQL_USER = 'farmerpanel';
process.env.MYSQL_PASSWORD = 'FpM3Sql!2026Pwd';
process.env.MYSQL_DATABASE = 'farmerpanel';
process.env.MYSQL_URI = 'mysql://farmerpanel:FpM3Sql!2026Pwd@87.120.216.181:3306/farmerpanel';

const { connectToDatabase } = require('./api/_lib/db');

async function check() {
    const { pool } = await connectToDatabase();
    
    // Check balance_history sources
    console.log('=== BALANCE HISTORY BY SOURCE ===');
    const [sources] = await pool.execute(`SELECT source, COUNT(*) as cnt FROM balance_history GROUP BY source`);
    sources.forEach(s => console.log(`  ${s.source}: ${s.cnt}`));
    
    // All offer statuses
    const [statuses] = await pool.execute(`SELECT status, COUNT(*) as cnt FROM offers GROUP BY status`);
    console.log('\nOffer statuses:');
    statuses.forEach(s => console.log(`  ${s.status || 'NULL'}: ${s.cnt}`));
    
    // Cached prices
    const [prices] = await pool.execute(`SELECT COUNT(*) as cnt FROM price_cache`);
    console.log('Cached prices:', prices[0].cnt);
    
    // Check recent balance history
    console.log('\n=== RECENT BALANCE HISTORY ===');
    const [recent] = await pool.execute(`
        SELECT farm_key, source, value, timestamp 
        FROM balance_history 
        ORDER BY timestamp DESC 
        LIMIT 10
    `);
    for (const r of recent) {
        console.log(`  ${r.timestamp.toISOString()} | ${r.source} | $${parseFloat(r.value).toFixed(2)} | ${r.farm_key.substring(0, 20)}`);
    }
    
    process.exit(0);
}

check().catch(e => { console.error('Error:', e.message); process.exit(1); });
