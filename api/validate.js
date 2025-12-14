const { connectToDatabase } = require('./_lib/db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');

        // POST - Validate and add farm key
        if (req.method === 'POST') {
            const { farmKey } = req.body;
            
            if (!farmKey) {
                return res.status(400).json({ error: 'Missing farm key' });
            }

            // Validate key format
            const keyPattern = /^FARM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
            if (!keyPattern.test(farmKey)) {
                return res.status(400).json({ error: 'Invalid key format' });
            }

            const farmer = await farmersCollection.findOne({ farmKey });
            
            if (!farmer) {
                return res.status(404).json({ 
                    error: 'Farm key not found. Make sure your farm script is running and syncing.' 
                });
            }

            return res.status(200).json({
                success: true,
                farmKey: farmer.farmKey,
                username: farmer.username,
                avatar: farmer.avatar,
                lastUpdate: farmer.lastUpdate
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Validate error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
