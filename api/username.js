const { connectToDatabase } = require('./_lib/db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');

        const { farmKey, username } = req.body;
        
        if (!farmKey || !username) {
            return res.status(400).json({ error: 'Missing farmKey or username' });
        }

        // Validate username (3-20 chars, alphanumeric + underscore)
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            return res.status(400).json({ 
                error: 'Username must be 3-20 characters, alphanumeric and underscore only' 
            });
        }

        const result = await farmersCollection.updateOne(
            { farmKey },
            { $set: { username, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Farm key not found' });
        }

        return res.status(200).json({ success: true, username });
    } catch (error) {
        console.error('Update username error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
