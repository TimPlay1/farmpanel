/**
 * Fix offer images from Eldorado HTML page
 * Extracted from eldoradohighligh.html
 */
const mysql = require('mysql2/promise');

const FARM_KEY = 'FARM-TAES-479W-XJJ8-4M0J';

// Data extracted from Eldorado HTML page (fileserviceusprod.blob.core.windows.net)
const OFFERS_DATA = [
    // #MW5WWBRA - Guest 666
    {
        code: 'MW5WWBRA',
        brainrotName: 'Guest 666',
        title: '🔥Guest 666 l 8.3🔥 Fast Delivery🚚 ✅Aboba Store✅ #MW5WWBRA',
        imageUrl: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260110152540_1673713Small.png',
        income: 8
    },
    // #CKKQTQEH - Ketchuru and Musturu
    {
        code: 'CKKQTQEH',
        brainrotName: 'Ketchuru and Musturu',
        title: '🔥Ketchuru and Musturu l 573.8🔥 Fast Delivery🚚 ✅Aboba Store✅ #CKKQTQEH',
        imageUrl: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260110152445_3018181Small.png',
        income: 574,
        mutation: 'Radioactive'
    },
    // #RNYNWV6C - La Extinct Grande
    {
        code: 'RNYNWV6C',
        brainrotName: 'La Extinct Grande',
        title: '🔥La Extinct Grande l $105.8M/s🔥 Fast Delivery🚚 ✅Aboba Store✅ #RNYNWV6C',
        imageUrl: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260107131854_3053188Small.png',
        income: 106
    },
    // #4AYJKQVM - La Grande Combinasion
    {
        code: '4AYJKQVM',
        brainrotName: 'La Grande Combinasion',
        title: '🔥La Grande Combinasion l $110.0M/s🔥 Fast Delivery🚚 ✅Aboba Store✅ #4AYJKQVM',
        imageUrl: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260107131745_204895Small.png',
        income: 110
    },
    // #6P4CRTY7 - Los 25
    {
        code: '6P4CRTY7',
        brainrotName: 'Los 25',
        title: '🔥Los 25 l $110.0M/s🔥 Fast Delivery🚚 ✅Aboba Store✅ #6P4CRTY7',
        imageUrl: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260107131704_3879205Small.png',
        income: 110
    },
    // #WG5P28TQ - Los 25
    {
        code: 'WG5P28TQ',
        brainrotName: 'Los 25',
        title: '🔥Los 25 l $115.0M/s🔥 Fast Delivery🚚 ✅Aboba Store✅ #WG5P28TQ',
        imageUrl: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260107131420_8498169Small.png',
        income: 115
    },
    // #A93UGTGQ - Los 25
    {
        code: 'A93UGTGQ',
        brainrotName: 'Los 25',
        title: '🔥Los 25 l $220.0M/s🔥 Fast Delivery🚚 ✅Aboba Store✅ #A93UGTGQ',
        imageUrl: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260107131319_2008337Small.png',
        income: 220
    },
    // #JX9FLZGH - 1x1x1x1
    {
        code: 'JX9FLZGH',
        brainrotName: '1x1x1x1',
        title: '🔥1x1x1x1 l $5.0M/s🔥 Fast Delivery🚚 ✅Aboba Store✅ #JX9FLZGH',
        imageUrl: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260104190315_4500239Small.png',
        income: 5
    },
    // #3ES8VBV2 - Quesadilla Crocodila
    {
        code: '3ES8VBV2',
        brainrotName: 'Quesadilla Crocodila',
        title: '🔥Quesadilla Crocodila l $45.8M/s🔥 Fast Delivery🚚 ✅Aboba Store✅ #3ES8VBV2',
        imageUrl: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260104190207_9448321Small.png',
        income: 46
    },
    // #BFPQCY84 - Los 25 (Closed)
    {
        code: 'BFPQCY84',
        brainrotName: 'Los 25',
        title: '🔥Los 25 l $85.0M/s🔥 Fast Delivery🚚 ✅Aboba Store✅ #BFPQCY84',
        imageUrl: 'https://fileserviceusprod.blob.core.windows.net/offerimages/46637d2b-ced8-4d92-b391-0eaceb3b8dce_Offer_20260104190026_5982676Small.png',
        income: 85
    },
];

(async () => {
    const pool = await mysql.createPool({
        host: '87.120.216.181', port: 3306,
        user: 'farmerpanel', password: 'FpM3Sql!2026Pwd', database: 'farmerpanel'
    });
    
    console.log('Updating offers with correct images from Eldorado HTML...\n');
    
    let updated = 0;
    let created = 0;
    
    for (const offer of OFFERS_DATA) {
        console.log(`#${offer.code}: ${offer.brainrotName}`);
        
        // Check if offer exists
        const [existing] = await pool.query(
            'SELECT * FROM offers WHERE offer_id = ? AND farm_key = ?',
            [offer.code, FARM_KEY]
        );
        
        if (existing.length > 0) {
            // Update existing
            const [r1] = await pool.query(
                `UPDATE offers SET 
                    brainrot_name = ?,
                    income = ?,
                    eldorado_title = ?,
                    mutation = ?,
                    image_url = ?,
                    status = 'active',
                    last_scanned_at = NOW(),
                    updated_at = NOW()
                WHERE offer_id = ? AND farm_key = ?`,
                [offer.brainrotName, offer.income, offer.title, offer.mutation || null, offer.imageUrl, offer.code, FARM_KEY]
            );
            console.log(`  ✅ offers: UPDATED`);
            updated++;
        } else {
            // Create new
            const [r1] = await pool.query(
                `INSERT INTO offers (offer_id, farm_key, brainrot_name, income, eldorado_title, mutation, image_url, status, current_price, last_scanned_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, NOW(), NOW(), NOW())`,
                [offer.code, FARM_KEY, offer.brainrotName, offer.income, offer.title, offer.mutation || null, offer.imageUrl]
            );
            console.log(`  🆕 offers: CREATED`);
            created++;
        }
        
        // Also update offer_codes if exists
        const [r2] = await pool.query(
            `UPDATE offer_codes SET 
                brainrot_name = ?,
                income = ?,
                image_url = ?,
                status = 'active',
                last_seen_at = NOW(),
                updated_at = NOW()
            WHERE code = ? AND farm_key = ?`,
            [offer.brainrotName, offer.income, offer.imageUrl, offer.code, FARM_KEY]
        );
        if (r2.affectedRows > 0) {
            console.log(`  ✅ offer_codes: UPDATED`);
        }
        
        console.log(`  Image: ${offer.imageUrl.substring(0, 80)}...`);
        console.log('');
    }
    
    await pool.end();
    console.log(`\nDone! Updated: ${updated}, Created: ${created}`);
})();
