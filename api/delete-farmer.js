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

        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');
        const accountsCollection = db.collection('accounts');

        // Find farmer by key to validate ownership
        const farmer = await farmersCollection.findOne({ farmKey: key });
        
        if (!farmer) {
            return res.status(401).json({ error: 'Invalid farm key' });
        }

        // Find and delete the account data for this player
        // Accounts are stored with playerName field
        const deleteResult = await accountsCollection.deleteMany({ 
            farmKey: key,
            playerName: playerName 
        });

        // Also try to remove from farmer's accounts array if it exists
        await farmersCollection.updateOne(
            { farmKey: key },
            { 
                $pull: { 
                    accounts: { playerName: playerName }
                }
            }
        );

        // Try removing brainrots associated with this player
        const brainrotsCollection = db.collection('brainrots');
        await brainrotsCollection.deleteMany({
            farmKey: key,
            playerName: playerName
        });

        console.log(`Deleted farmer ${playerName} for key ${key.substring(0, 10)}...`);

        return res.status(200).json({ 
            success: true, 
            message: `Farmer ${playerName} deleted successfully`,
            deletedAccounts: deleteResult.deletedCount
        });

    } catch (error) {
        console.error('Delete farmer error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
