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
            // MySQL stores JSON in 'data' column
            const generations = doc?.data || doc?.generations || {};
            
            return res.json({ generations });
        }

        // POST - save a generation
        if (req.method === 'POST') {
            const { farmKey, brainrotName, accountId, income, resultUrl, timestamp } = req.body;

            if (!farmKey || !brainrotName || !accountId) {
                return res.status(400).json({ error: 'farmKey, brainrotName, and accountId are required' });
            }

            // Уникальный ключ: accountId_name_income
            // ВАЖНО: Заменяем точки на подчёркивания (MySQL JSON keys can have dots but we avoid for consistency)
            const normalizedIncome = String(income || '0').replace(/\./g, '_');
            const brainrotKey = `${accountId}_${brainrotName.toLowerCase().trim().replace(/\./g, '_')}_${normalizedIncome}`;
            
            console.log('Saving generation with key:', brainrotKey);
            
            // Get current data (MySQL stores in 'data' JSON column)
            const existing = await collection.findOne({ farmKey });
            const currentData = existing?.data || existing?.generations || {};
            const currentCount = currentData[brainrotKey]?.count || 0;

            const generation = {
                name: brainrotName,
                accountId: accountId,
                income: income || '0', // Храним оригинальное значение
                resultUrl: resultUrl || null,
                generatedAt: timestamp || new Date().toISOString(),
                count: currentCount + 1
            };

            // Update the data object
            currentData[brainrotKey] = generation;
            
            // For MySQL: upsert with full data replacement
            if (existing) {
                await collection.updateOne(
                    { farmKey },
                    { $set: { data: currentData } }
                );
            } else {
                await collection.insertOne({
                    farmKey,
                    data: currentData
                });
            }

            return res.json({ success: true, generation, key: brainrotKey });
        }

        // DELETE - remove a generation
        if (req.method === 'DELETE') {
            const { farmKey, brainrotName } = req.query;

            if (!farmKey || !brainrotName) {
                return res.status(400).json({ error: 'farmKey and brainrotName are required' });
            }

            const brainrotKey = brainrotName.toLowerCase().trim();

            // Get current data and remove the key
            const existing = await collection.findOne({ farmKey });
            if (existing) {
                const currentData = existing.data || existing.generations || {};
                delete currentData[brainrotKey];
                await collection.updateOne(
                    { farmKey },
                    { $set: { data: currentData } }
                );
            }

            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Generations API error:', error);
        res.status(500).json({ error: error.message });
    }
};
