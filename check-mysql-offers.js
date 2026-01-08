/**
 * Check offers in MySQL database
 * Migrated from MongoDB version
 */

const { connect, getPool } = require('./utils/mysql-client');

async function checkOffers() {
    const client = await connect();
    const db = client.db('farmpanel');
    const pool = await getPool();
    
    // List all tables
    const collections = await db.listCollections().toArray();
    console.log('Tables:', collections.map(c => c.name).join(', '));
    
    // Check offers table
    const count = await db.collection('offers').countDocuments();
    console.log(`\noffers: ${count} documents`);
    
    if (count > 0) {
        // Find Esok Sekolah offers
        const [esokOffers] = await pool.query(
            "SELECT * FROM offers WHERE brainrot_name LIKE '%esok sekolah%' LIMIT 5"
        );
        
        console.log(`  Esok Sekolah offers: ${esokOffers.length}`);
        for (const offer of esokOffers) {
            console.log(`    - income: ${offer.income}, currentPrice: $${offer.current_price}, recommendedPrice: $${offer.recommended_price}`);
        }
        
        // Find any offer with price ~$100-120
        const [highPrices] = await pool.query(
            "SELECT * FROM offers WHERE current_price BETWEEN 100 AND 120 OR recommended_price BETWEEN 100 AND 120 LIMIT 10"
        );
        
        console.log(`\n  Offers with price ~$100-120: ${highPrices.length}`);
        for (const offer of highPrices) {
            console.log(`    - ${offer.brainrot_name} | current: $${offer.current_price}, recommended: $${offer.recommended_price}`);
        }
        
        // Show all offers summary
        console.log('\n=== All offers summary ===');
        const [allOffers] = await pool.query(
            "SELECT brainrot_name, current_price, recommended_price, status, mutation FROM offers ORDER BY current_price DESC LIMIT 20"
        );
        
        for (const o of allOffers) {
            console.log(`  ${o.brainrot_name}${o.mutation ? ' [' + o.mutation + ']' : ''} | $${o.current_price} → $${o.recommended_price} | ${o.status}`);
        }
    }
    
    await client.close();
    console.log('\nDone!');
}

checkOffers().catch(console.error);
