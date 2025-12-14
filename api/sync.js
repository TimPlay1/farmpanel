const { connectToDatabase, generateAvatar, generateUsername } = require('./_lib/db');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');

        // POST - Sync data from Lua script
        if (req.method === 'POST') {
            const { farmKey, accounts, timestamp } = req.body;
            
            if (!farmKey || !accounts) {
                return res.status(400).json({ error: 'Missing farmKey or accounts' });
            }

            // Get existing farmer or create new
            let farmer = await farmersCollection.findOne({ farmKey });
            
            if (!farmer) {
                // Get all existing avatars to ensure uniqueness
                const allFarmers = await farmersCollection.find({}).toArray();
                const existingAvatars = allFarmers.map(f => f.avatar);
                
                farmer = {
                    farmKey,
                    username: generateUsername(),
                    avatar: generateAvatar(existingAvatars),
                    accounts: [],
                    createdAt: new Date(),
                    lastUpdate: new Date()
                };
            }

            // Update farmer data
            farmer.accounts = accounts;
            farmer.lastUpdate = new Date();
            farmer.lastTimestamp = timestamp;

            await farmersCollection.updateOne(
                { farmKey },
                { $set: farmer },
                { upsert: true }
            );

            return res.status(200).json({ 
                success: true, 
                username: farmer.username,
                avatar: farmer.avatar
            });
        }

        // GET - Get farmer data by key
        if (req.method === 'GET') {
            const { key } = req.query;
            
            if (!key) {
                return res.status(400).json({ error: 'Missing farm key' });
            }

            const farmer = await farmersCollection.findOne({ farmKey: key });
            
            if (!farmer) {
                return res.status(404).json({ error: 'Farm key not found' });
            }

            return res.status(200).json({
                success: true,
                farmKey: farmer.farmKey,
                username: farmer.username,
                avatar: farmer.avatar,
                accounts: farmer.accounts || [],
                lastUpdate: farmer.lastUpdate
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Sync error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
