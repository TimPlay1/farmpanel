/**
 * Lightweight status endpoint - FAST!
 * Only returns account statuses without heavy operations like avatar fetching
 * Used for real-time status updates in dashboard cards
 */

const { connectToDatabase } = require('./_lib/db');

// Simple in-memory cache with 2 second TTL
const statusCache = new Map();
const CACHE_TTL = 2000; // 2 seconds

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    // Short cache for edge
    res.setHeader('Cache-Control', 'public, s-maxage=1, stale-while-revalidate=2');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { key } = req.query;
    
    if (!key) {
        return res.status(400).json({ error: 'Farm key required' });
    }

    try {
        // Check cache first
        const cacheKey = `status_${key}`;
        const cached = statusCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            return res.status(200).json(cached.data);
        }

        // Quick database lookup - only get what we need
        const { db } = await connectToDatabase();
        const farmer = await db.collection('farmers').findOne(
            { farmKey: key },
            { 
                projection: { 
                    'accounts.playerName': 1,
                    'accounts.isOnline': 1,
                    'accounts.lastUpdate': 1,
                    'accounts.status': 1,
                    'accounts.action': 1,
                    'accounts.totalIncome': 1,
                    'accounts.totalIncomeFormatted': 1,
                    'accounts.totalBrainrots': 1,
                    'accounts.maxSlots': 1
                } 
            }
        );

        if (!farmer) {
            return res.status(404).json({ error: 'Farm not found' });
        }

        // Calculate isOnline based on lastUpdate (180 second threshold)
        const now = Date.now();
        const accounts = (farmer.accounts || []).map(acc => {
            let isOnline = false;
            if (acc.lastUpdate) {
                try {
                    const lastUpdateTime = new Date(acc.lastUpdate).getTime();
                    const diffSeconds = (now - lastUpdateTime) / 1000;
                    isOnline = diffSeconds <= 180;
                } catch (e) {
                    isOnline = false;
                }
            }
            
            return {
                playerName: acc.playerName,
                isOnline: isOnline,
                lastUpdate: acc.lastUpdate,
                status: isOnline ? (acc.status || 'idle') : 'offline',
                action: isOnline ? (acc.action || '') : '',
                totalIncome: acc.totalIncome || 0,
                totalIncomeFormatted: acc.totalIncomeFormatted || '0/s',
                totalBrainrots: acc.totalBrainrots || 0,
                maxSlots: acc.maxSlots || 10
            };
        });

        const response = {
            timestamp: Date.now(),
            accounts: accounts
        };

        // Cache the response
        statusCache.set(cacheKey, {
            timestamp: Date.now(),
            data: response
        });

        return res.status(200).json(response);
        
    } catch (error) {
        console.error('Status endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
