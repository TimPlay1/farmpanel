/**
 * API для управления очередью Eldorado
 * GET /api/queue?farmKey=XXX - получить очередь
 * POST /api/queue - сохранить очередь
 * DELETE /api/queue?farmKey=XXX - очистить очередь
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'farmpanel';

// Cache for queue data (short TTL - 5 minutes)
const queueCache = new Map();
const QUEUE_CACHE_TTL = 5 * 60 * 1000;

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    let client;
    
    try {
        const { farmKey } = req.query;
        
        if (req.method === 'GET') {
            if (!farmKey) {
                return res.status(400).json({ error: 'Missing farmKey' });
            }
            
            // Check cache first
            const cached = queueCache.get(farmKey);
            if (cached && Date.now() - cached.timestamp < QUEUE_CACHE_TTL) {
                return res.json({ success: true, queue: cached.queue, cached: true });
            }
            
            client = new MongoClient(uri);
            await client.connect();
            const db = client.db(DB_NAME);
            
            const queueDoc = await db.collection('queues').findOne({ farmKey });
            
            if (queueDoc && queueDoc.queue && queueDoc.queue.length > 0) {
                // Check if queue is not expired (1 hour max)
                const age = Date.now() - (queueDoc.timestamp || 0);
                if (age < 3600000) {
                    // Cache it
                    queueCache.set(farmKey, { queue: queueDoc.queue, timestamp: Date.now() });
                    return res.json({ success: true, queue: queueDoc.queue });
                }
            }
            
            return res.json({ success: false, queue: [], message: 'No active queue' });
        }
        
        if (req.method === 'POST') {
            const { farmKey: bodyFarmKey, queue } = req.body;
            const key = bodyFarmKey || farmKey;
            
            if (!key || !queue || !Array.isArray(queue)) {
                return res.status(400).json({ error: 'Missing farmKey or queue' });
            }
            
            client = new MongoClient(uri);
            await client.connect();
            const db = client.db(DB_NAME);
            
            await db.collection('queues').updateOne(
                { farmKey: key },
                { 
                    $set: { 
                        farmKey: key,
                        queue: queue,
                        timestamp: Date.now()
                    }
                },
                { upsert: true }
            );
            
            // Update cache
            queueCache.set(key, { queue: queue, timestamp: Date.now() });
            
            return res.json({ success: true, saved: queue.length });
        }
        
        if (req.method === 'DELETE') {
            if (!farmKey) {
                return res.status(400).json({ error: 'Missing farmKey' });
            }
            
            client = new MongoClient(uri);
            await client.connect();
            const db = client.db(DB_NAME);
            
            await db.collection('queues').deleteOne({ farmKey });
            
            // Clear cache
            queueCache.delete(farmKey);
            
            return res.json({ success: true, message: 'Queue cleared' });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Queue API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) {
            await client.close();
        }
    }
};
