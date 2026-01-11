process.env.MYSQL_HOST = '87.120.216.181';
process.env.MYSQL_USER = 'farmerpanel';
process.env.MYSQL_PASSWORD = 'FpM3Sql!2026Pwd';
process.env.MYSQL_DATABASE = 'farmerpanel';
process.env.MYSQL_URI = 'mysql://farmerpanel:FpM3Sql!2026Pwd@87.120.216.181:3306/farmerpanel';

const { connectToDatabase } = require('./api/_lib/db');

async function check() {
    const { pool } = await connectToDatabase();
    
    // Get all active offers for CrimsonStore in order
    const [offers] = await pool.execute(`
        SELECT id, offer_id, brainrot_name 
        FROM offers 
        WHERE farm_key = 'FARM-7VZV-EY4Y-1OOX-IOQJ' 
        AND status = 'active'
        ORDER BY id
    `);
    
    console.log('=== ACTIVE OFFERS QUEUE ===');
    console.log('Total active:', offers.length);
    
    // Find HJ8R6JB6 position
    const hjIndex = offers.findIndex(o => o.offer_id === 'HJ8R6JB6');
    console.log('HJ8R6JB6 position:', hjIndex + 1, 'of', offers.length);
    
    // Show first 10 and around HJ8R6JB6
    console.log('\nFirst 10 in queue:');
    offers.slice(0, 10).forEach((o, i) => console.log(`  ${i+1}. ${o.offer_id}: ${o.brainrot_name}`));
    
    if (hjIndex > 10) {
        console.log(`\nAround HJ8R6JB6 (position ${hjIndex + 1}):`);
        offers.slice(hjIndex - 2, hjIndex + 3).forEach((o, i) => {
            const pos = hjIndex - 1 + i;
            console.log(`  ${pos}. ${o.offer_id}: ${o.brainrot_name} ${o.offer_id === 'HJ8R6JB6' ? '<<<' : ''}`);
        });
    }
    
    process.exit(0);
}

check().catch(e => { console.error('Error:', e.message); process.exit(1); });
