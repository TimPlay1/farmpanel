/**
 * Fast sync endpoint with in-memory caching
 * Returns cached data immediately, updates in background
 * v1.0.0
 */

const { connectToDatabase } = require('./_lib/db');

// In-memory cache with 5 second TTL for instant responses
const syncCache = new Map();
const CACHE_TTL = 5000; // 5 seconds - returns cached data
const STALE_TTL = 60000; // 60 seconds - still usable while refreshing

// Background refresh tracking
const refreshingKeys = new Set();

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
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

    const cacheKey = `sync_${key}`;
    const cached = syncCache.get(cacheKey);
    const now = Date.now();

    // If we have fresh cache - return immediately
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Age', Math.round((now - cached.timestamp) / 1000));
        return res.status(200).json(cached.data);
    }

    // If we have stale cache - return it but refresh in background
    if (cached && (now - cached.timestamp) < STALE_TTL) {
        // Start background refresh if not already in progress
        if (!refreshingKeys.has(key)) {
            refreshingKeys.add(key);
            refreshCacheInBackground(key, cacheKey).finally(() => {
                refreshingKeys.delete(key);
            });
        }
        
        res.setHeader('X-Cache', 'STALE');
        res.setHeader('X-Cache-Age', Math.round((now - cached.timestamp) / 1000));
        return res.status(200).json(cached.data);
    }

    // No cache or too old - fetch fresh data
    try {
        const startTime = Date.now();
        const { db } = await connectToDatabase();
        const farmer = await db.collection('farmers').findOne({ farmKey: key });
        
        if (!farmer) {
            return res.status(404).json({ error: 'Farm key not found' });
        }

        // Process accounts with online status and calculated income
        const ONLINE_THRESHOLD = 180 * 1000; // 3 minutes
        const accountsWithStatus = (farmer.accounts || []).map(acc => {
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
                ...acc,
                isOnline: isOnline,
                status: acc.status || 'idle',
                action: acc.action || '',
                totalIncome: totalIncome,
                totalIncomeFormatted: totalIncomeFormatted,
                totalBrainrots: brainrots.length,
                maxSlots: acc.maxSlots || 10
            };
        });

        const responseData = {
            success: true,
            farmKey: farmer.farmKey,
            username: farmer.username,
            avatar: farmer.avatar,
            accounts: accountsWithStatus,
            accountAvatars: farmer.accountAvatars || {},
            playerUserIdMap: farmer.playerUserIdMap || {},
            lastUpdate: farmer.lastUpdate,
            totalValue: farmer.totalValue || 0,
            valueUpdatedAt: farmer.valueUpdatedAt || null
        };

        // Cache the result
        syncCache.set(cacheKey, {
            timestamp: now,
            data: responseData
        });

        const duration = Date.now() - startTime;
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Response-Time', duration);
        console.log(`[sync-fast] MISS for ${key}: ${duration}ms`);

        return res.status(200).json(responseData);
    } catch (error) {
        console.error('[sync-fast] Error:', error.message);
        
        // If we have any cached data, return it even if very stale
        if (cached) {
            res.setHeader('X-Cache', 'ERROR-FALLBACK');
            return res.status(200).json(cached.data);
        }
        
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// Background refresh function
async function refreshCacheInBackground(key, cacheKey) {
    try {
        const { db } = await connectToDatabase();
        const farmer = await db.collection('farmers').findOne({ farmKey: key });
        
        if (!farmer) return;

        const now = Date.now();
        const ONLINE_THRESHOLD = 180 * 1000;
        
        const accountsWithStatus = (farmer.accounts || []).map(acc => {
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
                ...acc,
                isOnline: isOnline,
                status: acc.status || 'idle',
                action: acc.action || '',
                totalIncome: totalIncome,
                totalIncomeFormatted: totalIncomeFormatted,
                totalBrainrots: brainrots.length,
                maxSlots: acc.maxSlots || 10
            };
        });

        const responseData = {
            success: true,
            farmKey: farmer.farmKey,
            username: farmer.username,
            avatar: farmer.avatar,
            accounts: accountsWithStatus,
            accountAvatars: farmer.accountAvatars || {},
            playerUserIdMap: farmer.playerUserIdMap || {},
            lastUpdate: farmer.lastUpdate,
            totalValue: farmer.totalValue || 0,
            valueUpdatedAt: farmer.valueUpdatedAt || null
        };

        syncCache.set(cacheKey, {
            timestamp: now,
            data: responseData
        });
        
        console.log(`[sync-fast] Background refresh for ${key} complete`);
    } catch (error) {
        console.error('[sync-fast] Background refresh error:', error.message);
    }
}
