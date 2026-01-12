/**
 * API endpoint для обновления last_seen_at пользователя
 * Вызывается клиентом при заходе на панель и когда страница становится видимой
 * 
 * v1.0.0: Initial implementation
 */

const { connectToDatabase } = require('./_lib/db');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { farmKey } = req.body;
        
        if (!farmKey) {
            return res.status(400).json({ error: 'farmKey is required' });
        }
        
        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');
        
        // Обновляем last_seen_at для пользователя
        const result = await farmersCollection.updateOne(
            { farmKey },
            { $set: { lastSeenAt: new Date() } }
        );
        
        if (result.matchedCount === 0) {
            // Фермер не найден - возможно это новый пользователь, не ошибка
            console.log(`⚠️ Heartbeat: farmer ${farmKey} not found`);
            return res.status(200).json({ success: true, found: false });
        }
        
        console.log(`💓 Heartbeat: ${farmKey} updated last_seen_at`);
        
        return res.status(200).json({ 
            success: true, 
            found: true,
            lastSeenAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Heartbeat error:', error);
        return res.status(500).json({ error: error.message });
    }
};
