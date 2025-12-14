module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const uri = process.env.MONGODB_URI;
        
        // Check if URI exists
        if (!uri) {
            return res.status(200).json({ 
                status: 'error',
                message: 'MONGODB_URI is not set',
                envKeys: Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('DB'))
            });
        }
        
        // Mask the password in URI for security
        const maskedUri = uri.replace(/:([^@]+)@/, ':****@');
        
        // Try to connect
        const { MongoClient } = require('mongodb');
        const client = new MongoClient(uri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        
        await client.connect();
        const db = client.db('farmerpanel');
        
        // Try to list collections
        const collections = await db.listCollections().toArray();
        
        // Try to count farmers
        const farmersCount = await db.collection('farmers').countDocuments();
        
        await client.close();
        
        return res.status(200).json({
            status: 'success',
            message: 'MongoDB connected successfully',
            maskedUri: maskedUri,
            collections: collections.map(c => c.name),
            farmersCount: farmersCount
        });
    } catch (error) {
        return res.status(200).json({
            status: 'error',
            message: error.message,
            stack: error.stack
        });
    }
};
