/**
 * API для проверки состояния cron сканера
 * GET /api/scan-status
 */

const { connectToDatabase } = require('./_lib/db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { db } = await connectToDatabase();
        
        // 1. Состояние сканера
        const scanState = await db.collection('scan_state').findOne({ _id: 'price_scanner' });
        
        // 2. Последние обновлённые цены
        const recentPrices = await db.collection('price_cache')
            .find({})
            .sort({ updatedAt: -1 })
            .limit(10)
            .project({ _id: 1, updatedAt: 1, cycleId: 1, suggestedPrice: 1 })
            .toArray();
        
        // 3. Самые старые цены (которые давно не обновлялись)
        const oldestPrices = await db.collection('price_cache')
            .find({})
            .sort({ updatedAt: 1 })
            .limit(10)
            .project({ _id: 1, updatedAt: 1, cycleId: 1, suggestedPrice: 1 })
            .toArray();
        
        // 4. Статистика
        const totalPrices = await db.collection('price_cache').countDocuments();
        const now = new Date();
        const oneMinuteAgo = new Date(now - 60 * 1000);
        const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
        const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
        
        const updatedLastMinute = await db.collection('price_cache').countDocuments({ updatedAt: { $gt: oneMinuteAgo } });
        const updatedLast5Min = await db.collection('price_cache').countDocuments({ updatedAt: { $gt: fiveMinutesAgo } });
        const updatedLast10Min = await db.collection('price_cache').countDocuments({ updatedAt: { $gt: tenMinutesAgo } });
        
        return res.status(200).json({
            success: true,
            serverTime: now.toISOString(),
            scanState: {
                cycleId: scanState?.cycleId,
                lastScanAt: scanState?.lastScanAt,
                totalScanned: scanState?.totalScanned,
                timeSinceLastScan: scanState?.lastScanAt 
                    ? Math.round((now - new Date(scanState.lastScanAt)) / 1000) + 's'
                    : 'never'
            },
            stats: {
                totalPrices,
                updatedLastMinute,
                updatedLast5Min,
                updatedLast10Min
            },
            recentPrices: recentPrices.map(p => ({
                key: p._id,
                updatedAt: p.updatedAt,
                ago: Math.round((now - new Date(p.updatedAt)) / 1000) + 's',
                cycleId: p.cycleId,
                price: p.suggestedPrice
            })),
            oldestPrices: oldestPrices.map(p => ({
                key: p._id,
                updatedAt: p.updatedAt,
                ago: Math.round((now - new Date(p.updatedAt)) / 1000) + 's',
                cycleId: p.cycleId,
                price: p.suggestedPrice
            }))
        });
        
    } catch (e) {
        console.error('scan-status error:', e);
        return res.status(500).json({ error: e.message });
    }
};
