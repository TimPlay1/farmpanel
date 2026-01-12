const mysql = require('mysql2/promise');

(async () => {
    const conn = await mysql.createConnection({
        host: '87.120.216.181',
        port: 3306,
        user: 'farmerpanel',
        password: 'FpM3Sql!2026Pwd',
        database: 'farmerpanel'
    });
    
    const updates = [
        { code: 'SK2VU4AA', income: 1100, income_raw: '$1.1B/s' },
        { code: '39H3HEHH', income: 350, income_raw: '$350.0M/s' },
        { code: '4ZCR5T4Q', income: 102, income_raw: '$101.5M/s' },
        { code: 'EWCVSTBU', income: 308, income_raw: '$307.5M/s' },
        { code: 'MW5WWBRA', income: 8, income_raw: '$8.3M/s' },
        { code: 'CKKQTQEH', income: 574, income_raw: '$573.8M/s' }
    ];
    
    for (const u of updates) {
        const [result] = await conn.execute(
            'UPDATE offers SET income = ?, income_raw = ?, updated_at = NOW() WHERE offer_id = ?',
            [u.income, u.income_raw, u.code]
        );
        console.log(`${u.code}: income=${u.income}, income_raw=${u.income_raw} -> affected: ${result.affectedRows}`);
    }
    
    // Verify
    console.log('\nVerification:');
    const [rows] = await conn.execute(
        'SELECT offer_id, brainrot_name, income, income_raw FROM offers WHERE offer_id IN (?, ?, ?, ?, ?, ?)',
        updates.map(u => u.code)
    );
    rows.forEach(r => console.log(`  ${r.offer_id}: ${r.brainrot_name} | income: ${r.income} | raw: ${r.income_raw}`));
    
    await conn.end();
    console.log('\nDone!');
})();
