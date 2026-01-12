/**
 * Add missing offers to DB for FARM-TAES-479W-XJJ8-4M0J
 */
const mysql = require('mysql2/promise');

const FARM_KEY = 'FARM-TAES-479W-XJJ8-4M0J';

const OFFERS_TO_ADD = [
    { code: '39H3HEHH', name: 'Chipso and Queso', income: 350, price: 9.89, eldoradoId: '4331f5b6-8821-41dc-8a1f-158ebc8b330e' },
    { code: '4ZCR5T4Q', name: 'Los Chicleteiras', income: 102, price: 2.39, eldoradoId: 'f9179a51-e0c4-4639-a69a-c64342588073' },
    { code: 'EWCVSTBU', name: 'Esok Sekolah', income: 308, price: 4.85, eldoradoId: 'a3baabff-f2bd-44ff-b71b-5ea86c530246' },
    { code: 'MW5WWBRA', name: 'Guest 666', income: 8, price: 9.89, eldoradoId: '84ee244a-5343-4a1e-9290-90c0cc161bfe' },
    { code: 'SK2VU4AA', name: 'La Secret Combinasion', income: 1100, price: 24.50, eldoradoId: 'dcd17c7f-16cd-499a-a2cd-c622bbbb51ef' },
];

(async () => {
    const pool = await mysql.createPool({
        host: '87.120.216.181', port: 3306,
        user: 'farmerpanel', password: 'FpM3Sql!2026Pwd', database: 'farmerpanel'
    });
    
    console.log('Adding', OFFERS_TO_ADD.length, 'offers to DB...\n');
    
    for (const offer of OFFERS_TO_ADD) {
        // Update offer_codes
        const [r1] = await pool.query(
            'UPDATE offer_codes SET status = ?, brainrot_name = ?, income = ?, eldorado_offer_id = ?, current_price = ?, last_seen_at = NOW(), updated_at = NOW() WHERE code = ? AND farm_key = ?',
            ['active', offer.name, offer.income, offer.eldoradoId, offer.price, offer.code, FARM_KEY]
        );
        console.log(`offer_codes ${offer.code}: ${r1.affectedRows} updated`);
        
        // Check if offer exists
        const [existing] = await pool.query('SELECT * FROM offers WHERE offer_id = ? AND farm_key = ?', [offer.code, FARM_KEY]);
        
        if (existing.length === 0) {
            // Create new offer
            const [r2] = await pool.query(
                'INSERT INTO offers (farm_key, offer_id, brainrot_name, income, current_price, eldorado_offer_id, status, last_scanned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())',
                [FARM_KEY, offer.code, offer.name, offer.income, offer.price, offer.eldoradoId, 'active']
            );
            console.log(`offers ${offer.code}: CREATED`);
        } else {
            // Update existing
            const [r2] = await pool.query(
                'UPDATE offers SET brainrot_name = ?, income = ?, current_price = ?, eldorado_offer_id = ?, status = ?, last_scanned_at = NOW(), updated_at = NOW() WHERE offer_id = ? AND farm_key = ?',
                [offer.name, offer.income, offer.price, offer.eldoradoId, 'active', offer.code, FARM_KEY]
            );
            console.log(`offers ${offer.code}: ${r2.affectedRows} updated`);
        }
    }
    
    await pool.end();
    console.log('\nDone!');
})();
