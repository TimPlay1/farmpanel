/**
 * API для управления очередью удаления офферов на Eldorado
 * GET /api/delete-queue?farmKey=XXX - получить очередь на удаление
 * POST /api/delete-queue - сохранить очередь на удаление
 * DELETE /api/delete-queue?farmKey=XXX - очистить очередь
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MYSQL_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'farmpanel';

// Cache for delete queue data (short TTL - 5 minutes)
const deleteQueueCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

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
            const cached = deleteQueueCache.get(farmKey);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                return res.json({ success: true, ...cached.data, cached: true });
            }
            
            client = new MongoClient(uri);
            await client.connect();
            const db = client.db(DB_NAME);
            
            const queueDoc = await db.collection('delete_queues').findOne({ farmKey });
            
            if (queueDoc && queueDoc.offerCodes && queueDoc.offerCodes.length > 0) {
                // Check if queue is not expired (10 minutes max)
                const age = Date.now() - (queueDoc.timestamp || 0);
                if (age < 600000) {
                    const data = {
                        offerCodes: queueDoc.offerCodes,
                        offerNames: queueDoc.offerNames || [],
                        timestamp: queueDoc.timestamp
                    };
                    // Cache it
                    deleteQueueCache.set(farmKey, { data, timestamp: Date.now() });
                    return res.json({ success: true, ...data });
                }
            }
            
            return res.json({ success: false, offerCodes: [], offerNames: [], message: 'No active delete queue' });
        }
        
        if (req.method === 'POST') {
            const { farmKey: bodyFarmKey, offerCodes, offerNames } = req.body;
            const key = bodyFarmKey || farmKey;
            
            if (!key || !offerCodes || !Array.isArray(offerCodes) || offerCodes.length === 0) {
                return res.status(400).json({ error: 'Missing farmKey or offerCodes' });
            }
            
            client = new MongoClient(uri);
            await client.connect();
            const db = client.db(DB_NAME);
            
            await db.collection('delete_queues').updateOne(
                { farmKey: key },
                { 
                    $set: { 
                        farmKey: key,
                        offerCodes: offerCodes,
                        offerNames: offerNames || [],
                        timestamp: Date.now()
                    }
                },
                { upsert: true }
            );
            
            // Update cache
            deleteQueueCache.set(key, { 
                data: { offerCodes, offerNames: offerNames || [], timestamp: Date.now() },
                timestamp: Date.now() 
            });
            
            return res.json({ success: true, message: `Delete queue saved: ${offerCodes.length} offers` });
        }
        
        if (req.method === 'DELETE') {
            if (!farmKey) {
                return res.status(400).json({ error: 'Missing farmKey' });
            }
            
            client = new MongoClient(uri);
            await client.connect();
            const db = client.db(DB_NAME);
            
            await db.collection('delete_queues').deleteOne({ farmKey });
            
            // Clear cache
            deleteQueueCache.delete(farmKey);
            
            return res.json({ success: true, message: 'Delete queue cleared' });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Delete queue API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
        if (client) {
            await client.close();
        }
    }
};
