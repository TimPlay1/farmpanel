const { connectToDatabase } = require('./_lib/db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { playerName, key } = req.query;
        
        if (!key) {
            return res.status(400).json({ error: 'Farm key required' });
        }
        
        if (!playerName) {
            return res.status(400).json({ error: 'Player name required' });
        }

        const { pool } = await connectToDatabase();

        // Find farmer by key to validate ownership
        const [farmerRows] = await pool.execute(
            'SELECT id FROM farmers WHERE farm_key = ?',
            [key]
        );
        
        if (farmerRows.length === 0) {
            return res.status(401).json({ error: 'Invalid farm key' });
        }

        const farmerId = farmerRows[0].id;

        // Find account by player_name and farmer_id
        const [accountRows] = await pool.execute(
            'SELECT id FROM farmer_accounts WHERE farmer_id = ? AND player_name = ?',
            [farmerId, playerName]
        );

        if (accountRows.length === 0) {
            return res.status(404).json({ error: `Farmer ${playerName} not found` });
        }

        const accountId = accountRows[0].id;

        // Delete brainrots for this account first (foreign key constraint)
        await pool.execute(
            'DELETE FROM farmer_brainrots WHERE account_id = ?',
            [accountId]
        );

        // Delete the account
        const [deleteResult] = await pool.execute(
            'DELETE FROM farmer_accounts WHERE id = ?',
            [accountId]
        );

        console.log(`Deleted farmer ${playerName} (account_id: ${accountId}) for key ${key.substring(0, 10)}...`);

        return res.status(200).json({ 
            success: true, 
            message: `Farmer ${playerName} deleted successfully`,
            deletedAccounts: deleteResult.affectedRows
        });

    } catch (error) {
        console.error('Delete farmer error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
