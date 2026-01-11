process.env.MYSQL_HOST = '87.120.216.181';
process.env.MYSQL_USER = 'farmerpanel';
process.env.MYSQL_PASSWORD = 'FpM3Sql!2026Pwd';
process.env.MYSQL_DATABASE = 'farmerpanel';
process.env.MYSQL_URI = 'mysql://farmerpanel:FpM3Sql!2026Pwd@87.120.216.181:3306/farmerpanel';

const { connectToDatabase } = require('./api/_lib/db');

async function check() {
    const { pool } = await connectToDatabase();
    
    // Check balance_history table
    console.log('=== BALANCE HISTORY ANALYSIS ===\n');
    
    // 1. Total records
    const [totalCount] = await pool.execute(`SELECT COUNT(*) as cnt FROM balance_history`);
    console.log('Total records:', totalCount[0].cnt);
    
    // 2. Records per farm_key
    const [perFarm] = await pool.execute(`
        SELECT farm_key, COUNT(*) as cnt, 
               MIN(timestamp) as earliest, 
               MAX(timestamp) as latest
        FROM balance_history 
        GROUP BY farm_key
    `);
    console.log('\n=== RECORDS PER FARM ===');
    for (const f of perFarm) {
        const days = Math.round((new Date(f.latest) - new Date(f.earliest)) / (1000 * 60 * 60 * 24) * 10) / 10;
        console.log(`${f.farm_key}:`);
        console.log(`  Records: ${f.cnt}`);
        console.log(`  Earliest: ${f.earliest}`);
        console.log(`  Latest: ${f.latest}`);
        console.log(`  Span: ${days} days`);
    }
    
    // 3. Records per day for last 7 days
    console.log('\n=== RECORDS PER DAY (LAST 7 DAYS) ===');
    const [perDay] = await pool.execute(`
        SELECT DATE(timestamp) as day, COUNT(*) as cnt
        FROM balance_history 
        WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(timestamp)
        ORDER BY day DESC
    `);
    for (const d of perDay) {
        console.log(`  ${d.day}: ${d.cnt} records`);
    }
    
    // 4. Check for CrimsonStore specifically
    console.log('\n=== CRIMSONSTORE HISTORY ===');
    const [crimson] = await pool.execute(`
        SELECT COUNT(*) as cnt, 
               MIN(timestamp) as earliest, 
               MAX(timestamp) as latest,
               MIN(value) as min_val,
               MAX(value) as max_val
        FROM balance_history 
        WHERE farm_key = 'FARM-7VZV-EY4Y-1OOX-IOQJ'
    `);
    if (crimson[0].cnt > 0) {
        console.log(`  Records: ${crimson[0].cnt}`);
        console.log(`  Range: ${crimson[0].earliest} to ${crimson[0].latest}`);
        console.log(`  Value range: $${crimson[0].min_val} - $${crimson[0].max_val}`);
    } else {
        console.log('  No records found');
    }
    
    // 5. Show sample recent records
    console.log('\n=== SAMPLE RECENT RECORDS ===');
    const [recent] = await pool.execute(`
        SELECT farm_key, value, timestamp, source 
        FROM balance_history 
        ORDER BY timestamp DESC 
        LIMIT 10
    `);
    for (const r of recent) {
        console.log(`  ${r.timestamp} | ${r.farm_key.substring(0, 20)}... | $${r.value} | ${r.source}`);
    }
    
    process.exit(0);
}

check().catch(e => { console.error('Error:', e.message); process.exit(1); });
