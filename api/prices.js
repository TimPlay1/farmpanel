const { connectToDatabase } = require('./_lib/db');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (!process.env.MONGODB_URI) {
            return res.status(500).json({ error: 'Database not configured' });
        }

        const { db } = await connectToDatabase();
        const pricesCollection = db.collection('brainrot_prices');

        // POST - Save prices cache
        if (req.method === 'POST') {
            const { farmKey, prices } = req.body;
            
            if (!farmKey || !prices) {
                return res.status(400).json({ error: 'Missing farmKey or prices' });
            }

            // Сохраняем цены с timestamp
            await pricesCollection.updateOne(
                { farmKey },
                { 
                    $set: { 
                        farmKey,
                        prices,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );

            return res.status(200).json({ success: true });
        }

        // GET - Get cached prices
        if (req.method === 'GET') {
            const { farmKey } = req.query;
            
            if (!farmKey) {
                return res.status(400).json({ error: 'Missing farmKey' });
            }

            const cached = await pricesCollection.findOne({ farmKey });
            
            if (!cached) {
                return res.status(200).json({ prices: {} });
            }

            // Проверяем TTL (5 минут)
            const age = Date.now() - new Date(cached.updatedAt).getTime();
            if (age > 5 * 60 * 1000) {
                return res.status(200).json({ prices: {}, expired: true });
            }

            return res.status(200).json({ 
                prices: cached.prices || {},
                updatedAt: cached.updatedAt
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Prices API error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
