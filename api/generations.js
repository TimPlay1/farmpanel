const { connectToDatabase } = require('./_lib/db');

// Generate unique color for account based on account ID
function getAccountColor(accountId) {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8B500', '#00CED1', '#FF69B4', '#7FFF00', '#FF4500'
    ];
    
    let hash = 0;
    const str = String(accountId);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    
    return colors[Math.abs(hash) % colors.length];
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { db } = await connectToDatabase();
        const collection = db.collection('generations');

        // GET - fetch generations for a farm key
        if (req.method === 'GET') {
            const { farmKey } = req.query;
            
            if (!farmKey) {
                return res.status(400).json({ error: 'farmKey is required' });
            }

            const doc = await collection.findOne({ farmKey });
            const generations = doc?.generations || {};
            
            return res.json({ generations });
        }

        // POST - save a generation
        if (req.method === 'POST') {
            const { farmKey, brainrotName, accountId, income, resultUrl, timestamp } = req.body;

            if (!farmKey || !brainrotName || !accountId) {
                return res.status(400).json({ error: 'farmKey, brainrotName, and accountId are required' });
            }

            // Уникальный ключ: accountId_name_income
            const normalizedIncome = income || '0';
            const brainrotKey = `${accountId}_${brainrotName.toLowerCase().trim()}_${normalizedIncome}`;
            
            // Get current count for this specific brainrot
            const existing = await collection.findOne({ farmKey });
            const currentCount = existing?.generations?.[brainrotKey]?.count || 0;

            const generation = {
                name: brainrotName,
                accountId: accountId,
                income: normalizedIncome,
                resultUrl: resultUrl || null,
                generatedAt: timestamp || new Date().toISOString(),
                count: currentCount + 1
            };

            // Upsert the generation
            await collection.updateOne(
                { farmKey },
                { 
                    $set: { 
                        [`generations.${brainrotKey}`]: generation,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );

            return res.json({ success: true, generation });
        }

        // DELETE - remove a generation
        if (req.method === 'DELETE') {
            const { farmKey, brainrotName } = req.query;

            if (!farmKey || !brainrotName) {
                return res.status(400).json({ error: 'farmKey and brainrotName are required' });
            }

            const brainrotKey = brainrotName.toLowerCase().trim();

            await collection.updateOne(
                { farmKey },
                { $unset: { [`generations.${brainrotKey}`]: "" } }
            );

            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Generations API error:', error);
        res.status(500).json({ error: error.message });
    }
};
