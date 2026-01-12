/**
 * Fix offer images from Eldorado HTML - FINAL VERSION
 * Updates offers with correct image URLs, incomes, and mutations
 */

const mysql = require('mysql2/promise');

const dbConfig = {
    host: '87.120.216.181',
    port: 3306,
    user: 'farmerpanel',
    password: 'FpM3Sql!2026Pwd',
    database: 'farmerpanel'
};

// Correct data extracted from eldoradohighligh.html
// Income format: M/s (millions per second)
// When HTML shows "$1.1B/s" = 1100 M/s, "$350.0M/s" = 350 M/s, "101.5" = 101.5 M/s
const offerData = {
    'SK2VU4AA': {
        brainrot_name: 'La Secret Combinasion',
        income: 1100, // $1.1B/s = 1100M/s
        mutation: 'Cursed',
        image: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260110171658_1782212Small.png'
    },
    '39H3HEHH': {
        brainrot_name: 'Chipso and Queso',
        income: 350, // $350.0M/s
        mutation: null,
        image: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260110155628_4972532Small.png'
    },
    '4ZCR5T4Q': {
        brainrot_name: 'Los Chicleteiras',
        income: 102, // 101.5 M/s
        mutation: null,
        image: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260110153408_8961275Small.png'
    },
    'EWCVSTBU': {
        brainrot_name: 'Esok Sekolah',
        income: 308, // 307.5 M/s
        mutation: null,
        image: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260110153116_2946640Small.png'
    },
    'MW5WWBRA': {
        brainrot_name: 'Guest 666',
        income: 8, // 8.3 M/s
        mutation: null,
        image: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260110152540_1673713Small.png'
    },
    'CKKQTQEH': {
        brainrot_name: 'Ketchuru and Musturu',
        income: 574, // 573.8 M/s
        mutation: 'Radioactive',
        image: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260110152445_3018181Small.png'
    }
};

async function fixOfferImages() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database');
        
        for (const [offerCode, data] of Object.entries(offerData)) {
            console.log(`\n=== Processing ${offerCode}: ${data.brainrot_name} ===`);
            
            // First check current state (offer_id is the offer code column)
            const [currentRows] = await connection.execute(
                'SELECT id, brainrot_name, income, mutation, image_url FROM offers WHERE offer_id = ?',
                [offerCode]
            );
            
            if (currentRows.length === 0) {
                console.log(`  ❌ Offer not found in database`);
                continue;
            }
            
            const current = currentRows[0];
            console.log(`  Current: income=${current.income}, mutation=${current.mutation}`);
            console.log(`  Current image: ${current.image_url ? current.image_url.substring(0, 80) + '...' : 'NULL'}`);
            
            // Update the offer
            const [result] = await connection.execute(
                `UPDATE offers 
                 SET brainrot_name = ?,
                     income = ?,
                     mutation = ?,
                     image_url = ?,
                     updated_at = NOW()
                 WHERE offer_id = ?`,
                [data.brainrot_name, data.income, data.mutation, data.image, offerCode]
            );
            
            if (result.affectedRows > 0) {
                console.log(`  ✅ Updated: income=${data.income}, mutation=${data.mutation || 'NONE'}`);
                console.log(`  ✅ New image: ${data.image.substring(0, 80)}...`);
            } else {
                console.log(`  ⚠️ No rows updated`);
            }
        }
        
        // Show final state
        console.log('\n\n=== VERIFICATION ===');
        const [allOffers] = await connection.execute(
            `SELECT offer_id, brainrot_name, income, mutation, 
                    SUBSTRING(image_url, 1, 100) as image_preview
             FROM offers 
             WHERE offer_id IN (?, ?, ?, ?, ?, ?)`,
            Object.keys(offerData)
        );
        
        console.log('\nFinal state:');
        for (const offer of allOffers) {
            console.log(`  ${offer.offer_id}: ${offer.brainrot_name}`);
            console.log(`    Income: ${offer.income}/s, Mutation: ${offer.mutation || 'NONE'}`);
            console.log(`    Image: ${offer.image_preview}...`);
        }
        
        console.log('\n✅ All offers updated successfully!');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

fixOfferImages();
