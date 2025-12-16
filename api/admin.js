const { connectToDatabase } = require('./_lib/db');

/**
 * API для администрирования базы данных
 * DELETE /api/admin?action=cleanup&secret=YOUR_SECRET
 */

const VALID_FARM_KEYS = [
    'FARM-KFRV-UPE4-U2WJ-JOE6',
    'FARM-7VZV-EY4Y-1OOX-IOQJ',
    'FARM-TAES-479W-XJJ8-4M0J'
];

// Простой секрет для защиты (в продакшене использовать env variable)
const ADMIN_SECRET = 'cleanup-farmpanel-2024';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, secret } = req.query;

    // Проверка секрета
    if (secret !== ADMIN_SECRET) {
        return res.status(403).json({ error: 'Invalid secret' });
    }

    try {
        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');

        if (req.method === 'GET' && action === 'list') {
            // Список всех фермеров
            const farmers = await farmersCollection.find({}).toArray();
            return res.status(200).json({
                total: farmers.length,
                valid: VALID_FARM_KEYS,
                farmers: farmers.map(f => ({
                    farmKey: f.farmKey,
                    username: f.username,
                    accountsCount: f.accounts?.length || 0,
                    isValid: VALID_FARM_KEYS.includes(f.farmKey)
                }))
            });
        }

        if (req.method === 'DELETE' && action === 'cleanup') {
            // Удаляем всех кроме валидных
            const before = await farmersCollection.countDocuments();
            
            const result = await farmersCollection.deleteMany({
                farmKey: { $nin: VALID_FARM_KEYS }
            });
            
            // Очищаем кэш топов
            const topCacheCollection = db.collection('top_cache');
            await topCacheCollection.deleteMany({});
            
            const after = await farmersCollection.countDocuments();
            
            return res.status(200).json({
                success: true,
                before,
                deleted: result.deletedCount,
                after,
                remaining: VALID_FARM_KEYS
            });
        }

        return res.status(400).json({ error: 'Invalid action. Use: list or cleanup' });

    } catch (error) {
        console.error('Admin API error:', error);
        return res.status(500).json({ error: error.message });
    }
};
