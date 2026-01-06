/**
 * API for storing price adjustment queue
 * Used to pass bulk adjustment data from Farmpanel to Tampermonkey script
 * 
 * POST - Store adjustment data (returns adjustmentId)
 * GET - Retrieve adjustment data by adjustmentId
 * DELETE - Clear adjustment data after processing
 */

const { connectToDatabase } = require('./_lib/db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { db } = await connectToDatabase();
        const collection = db.collection('adjustment_queue');
        
        // POST - Store adjustment data
        if (req.method === 'POST') {
            const { farmKey, adjustmentData } = req.body;
            
            if (!farmKey || !adjustmentData) {
                return res.status(400).json({ error: 'farmKey and adjustmentData required' });
            }
            
            // Generate unique ID
            const adjustmentId = `adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Store with TTL (auto-delete after 10 minutes)
            await collection.insertOne({
                _id: adjustmentId,
                farmKey,
                data: adjustmentData,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes TTL
            });
            
            // Create TTL index if not exists (MongoDB will auto-delete expired docs)
            try {
                await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
            } catch (e) {
                // Index may already exist
            }
            
            console.log(`[adjustment-queue] Stored ${adjustmentData.offers?.length || 0} offers, id=${adjustmentId}`);
            
            return res.json({ 
                success: true, 
                adjustmentId,
                offersCount: adjustmentData.offers?.length || 0
            });
        }
        
        // GET - Retrieve adjustment data
        if (req.method === 'GET') {
            const { adjustmentId, farmKey } = req.query;
            
            if (!adjustmentId) {
                return res.status(400).json({ error: 'adjustmentId required' });
            }
            
            const doc = await collection.findOne({ _id: adjustmentId });
            
            if (!doc) {
                return res.json({ success: false, error: 'Not found or expired' });
            }
            
            // Optional farmKey verification
            if (farmKey && doc.farmKey !== farmKey) {
                return res.json({ success: false, error: 'Farm key mismatch' });
            }
            
            return res.json({ 
                success: true, 
                adjustmentData: doc.data,
                createdAt: doc.createdAt
            });
        }
        
        // DELETE - Clear adjustment data
        if (req.method === 'DELETE') {
            const { adjustmentId } = req.query;
            
            if (!adjustmentId) {
                return res.status(400).json({ error: 'adjustmentId required' });
            }
            
            await collection.deleteOne({ _id: adjustmentId });
            
            return res.json({ success: true });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('[adjustment-queue] Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
