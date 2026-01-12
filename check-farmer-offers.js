/**
 * Check offers for specific farmer
 */
const mysql = require('mysql2/promise');

(async () => {
    const pool = await mysql.createPool({
        host: '87.120.216.181',
        port: 3306,
        user: 'farmerpanel',
        password: 'FpM3Sql!2026Pwd',
        database: 'farmerpanel'
    });
    
    const farmKey = 'FARM-7VZV-EY4Y-1OOX-IOQJ';
    const searchCode = 'CKKQTQEH';
    
    console.log('=== FARMER DATA ===');
    const [farmer] = await pool.query('SELECT * FROM farmers WHERE farm_key = ?', [farmKey]);
    if (farmer[0]) {
        console.log('Farm Key:', farmer[0].farm_key);
        console.log('Username:', farmer[0].username);
        console.log('Shop Name:', farmer[0].shop_name);
    } else {
        console.log('Farmer not found!');
    }
    
    console.log('\n=== OFFER_CODES TABLE ===');
    const [codes] = await pool.query('SELECT * FROM offer_codes WHERE farm_key = ?', [farmKey]);
    console.log('Count:', codes.length);
    for (const c of codes) {
        console.log('  Code:', c.code, '| Name:', c.brainrot_name, '| Income:', c.income, '| Status:', c.status);
    }
    
    console.log('\n=== OFFERS TABLE ===');
    const [offers] = await pool.query('SELECT * FROM offers WHERE farm_key = ?', [farmKey]);
    console.log('Count:', offers.length);
    for (const o of offers) {
        console.log('  ID:', o.offer_id, '| Name:', o.brainrot_name, '| Income:', o.income, '| Price:', o.current_price, '| Status:', o.status);
    }
    
    console.log('\n=== SEARCH FOR', searchCode, '===');
    const [search1] = await pool.query('SELECT * FROM offer_codes WHERE code LIKE ?', ['%' + searchCode + '%']);
    console.log('In offer_codes:', search1.length);
    if (search1.length > 0) {
        for (const r of search1) {
            console.log('  Found:', r.code, '| Farm:', r.farm_key);
        }
    }
    
    const [search2] = await pool.query('SELECT * FROM offers WHERE offer_id LIKE ?', ['%' + searchCode + '%']);
    console.log('In offers:', search2.length);
    if (search2.length > 0) {
        for (const r of search2) {
            console.log('  Found:', r.offer_id, '| Farm:', r.farm_key);
        }
    }
    
    // Also search by Ketchuru name
    console.log('\n=== SEARCH BY NAME "Ketchuru and Musturu" ===');
    const [byName] = await pool.query('SELECT * FROM offers WHERE brainrot_name LIKE ?', ['%Ketchuru%']);
    console.log('Found:', byName.length);
    for (const o of byName) {
        console.log('  Farm:', o.farm_key, '| Name:', o.brainrot_name, '| Income:', o.income);
    }
    
    await pool.end();
    console.log('\nDone!');
})();
