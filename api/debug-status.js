/**
 * Debug endpoint - Check what's happening with status
 */

const { connectToDatabase } = require('./_lib/db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const { key } = req.query;
    
    if (!key) {
        return res.status(400).json({ error: 'key required' });
    }

    try {
        const { db, pool } = await connectToDatabase();
        
        // 1. Check farmers table directly
        const [farmersRaw] = await pool.execute(
            'SELECT id, farm_key, display_balance FROM farmers WHERE farm_key = ?',
            [key]
        );
        
        const debug = {
            farmersCount: farmersRaw.length,
            farmer: farmersRaw[0] || null,
            farmerId: farmersRaw[0]?.id || null
        };
        
        // 2. Check farmer_accounts if farmer exists
        if (debug.farmerId) {
            const [accountsRaw] = await pool.execute(
                'SELECT id, player_name, user_id FROM farmer_accounts WHERE farmer_id = ?',
                [debug.farmerId]
            );
            debug.accountsCount = accountsRaw.length;
            debug.accounts = accountsRaw.slice(0, 5); // First 5
        }
        
        // 3. Test via collection API
        const farmer = await db.collection('farmers').findOne({ farmKey: key });
        debug.viaCollection = {
            found: !!farmer,
            accountsCount: farmer?.accounts?.length || 0
        };
        
        return res.status(200).json(debug);
        
    } catch (error) {
        return res.status(500).json({ 
            error: error.message,
            stack: error.stack 
        });
    }
};
