const mysql = require('mysql2/promise');

(async () => {
    const pool = await mysql.createPool({
        host: '87.120.216.181', port: 3306, user: 'farmerpanel', 
        password: 'FpM3Sql!2026Pwd', database: 'farmerpanel'
    });
    
    // Check farmers with oldest offers scan
    const [farmers] = await pool.query(`
        SELECT f.farm_key, f.shop_name,
               MIN(o.last_scanned_at) as oldest_scan,
               MAX(o.last_scanned_at) as newest_scan,
               COUNT(o.id) as offer_count
        FROM farmers f
        LEFT JOIN offers o ON o.farm_key = f.farm_key
        WHERE f.shop_name IS NOT NULL AND f.shop_name != '' 
        GROUP BY f.farm_key, f.shop_name
        ORDER BY oldest_scan ASC
        LIMIT 10
    `);
    console.log('Farmers with oldest offer scan (should be prioritized):');
    for (const f of farmers) {
        const age = f.oldest_scan 
            ? ((Date.now() - new Date(f.oldest_scan).getTime()) / 60000).toFixed(1) + ' min ago' 
            : 'NEVER';
        console.log(' ', f.farm_key?.substring(0,8), '|', f.shop_name, '|', age, '| offers:', f.offer_count);
    }
    
    // Check total farmers count
    const [[{cnt}]] = await pool.query(`SELECT COUNT(*) as cnt FROM farmers WHERE shop_name IS NOT NULL AND shop_name != ''`);
    console.log('\nTotal farmers with shop_name:', cnt);
    
    // Check offers lastScannedAt distribution
    const [dist] = await pool.query(`
        SELECT 
            CASE 
                WHEN last_scanned_at IS NULL THEN 'never'
                WHEN TIMESTAMPDIFF(MINUTE, last_scanned_at, NOW()) < 10 THEN 'fresh (<10min)'
                WHEN TIMESTAMPDIFF(MINUTE, last_scanned_at, NOW()) < 60 THEN 'recent (<1h)'
                ELSE 'stale (>1h)'
            END as category,
            COUNT(*) as cnt
        FROM offers
        GROUP BY category
    `);
    console.log('\nOffers by scan freshness:');
    for (const d of dist) {
        console.log(' ', d.category, ':', d.cnt);
    }
    
    // Check when cron last ran (from scan_state)
    const [states] = await pool.query(`SELECT * FROM scan_state`);
    console.log('\nScan states:');
    for (const s of states) {
        const age = s.last_scan_at 
            ? ((Date.now() - new Date(s.last_scan_at).getTime()) / 60000).toFixed(1) + ' min ago'
            : 'NEVER';
        console.log(' ', s.id, '| cycle:', s.cycle_id, '| last:', age, '| total:', s.total_scanned);
    }
    
    await pool.end();
})();
