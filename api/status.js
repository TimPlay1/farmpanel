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
    // NO CACHING - always fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
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
        // MySQL doesn't support MongoDB-style projections, so just get full document
        const farmer = await db.collection('farmers').findOne({ farmKey: key });
        
        console.log(`[status] farmKey=${key}, farmer found=${!!farmer}, accounts=${farmer?.accounts?.length || 0}`);

        if (!farmer) {
            return res.status(404).json({ error: 'Farm not found' });
        }

        // Calculate isOnline on server based on lastUpdate
        // Account is online if lastUpdate is within last 3 minutes
        const now = Date.now();
        const ONLINE_THRESHOLD = 180 * 1000; // 3 minutes in ms
        
        const accounts = (farmer.accounts || []).map(acc => {
            let isOnline = false;
            if (acc.lastUpdate) {
                try {
                    const lastUpdateTime = new Date(acc.lastUpdate).getTime();
                    isOnline = (now - lastUpdateTime) <= ONLINE_THRESHOLD;
                } catch (e) {}
            }
            
            // Calculate totalIncome from brainrots
            const brainrots = acc.brainrots || [];
            let totalIncome = 0;
            for (const br of brainrots) {
                if (typeof br.income === 'number') {
                    totalIncome += br.income;
                } else if (typeof br.income === 'string') {
                    const num = parseFloat(br.income.replace(/[^\d.]/g, ''));
                    if (!isNaN(num)) totalIncome += num;
                }
            }
            
            // Format income
            let totalIncomeFormatted = '0/s';
            if (totalIncome > 0) {
                if (totalIncome >= 1e9) {
                    totalIncomeFormatted = `$${(totalIncome / 1e9).toFixed(1)}B/s`;
                } else if (totalIncome >= 1e6) {
                    totalIncomeFormatted = `$${(totalIncome / 1e6).toFixed(1)}M/s`;
                } else if (totalIncome >= 1e3) {
                    totalIncomeFormatted = `$${(totalIncome / 1e3).toFixed(1)}K/s`;
                } else {
                    totalIncomeFormatted = `$${totalIncome.toFixed(0)}/s`;
                }
            }
            
            return {
                playerName: acc.playerName,
                userId: acc.userId,
                isOnline: isOnline,
                lastUpdate: acc.lastUpdate,
                // status = действие фермера (idle, searching, walking и т.д.)
                // НЕ "offline" - online/offline определяется по isOnline
                status: acc.status || 'idle',
                action: acc.action || '',
                totalIncome: totalIncome,
                totalIncomeFormatted: totalIncomeFormatted,
                totalBrainrots: brainrots.length,
                maxSlots: acc.maxSlots || 10,
                brainrots: brainrots
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
