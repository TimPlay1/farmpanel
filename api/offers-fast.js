/**
 * Fast offers endpoint - Returns pre-scanned offers from database
 * Version 1.0.0
 * 
 * This endpoint returns offers that were already scanned by cron-price-scanner
 * or universal-scan. It does NOT query Eldorado API directly.
 * 
 * Used by "Scan All" button for instant results.
 */

const { connectToDatabase } = require('./_lib/db');

// In-memory cache for instant responses
const offersCache = new Map();
const CACHE_TTL = 5000; // 5 seconds

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

    const { farmKey, includeAll } = req.query;
    
    if (!farmKey) {
        return res.status(400).json({ error: 'farmKey is required' });
    }

    try {
        // Check cache first
        const cacheKey = `offers_${farmKey}_${includeAll || 'false'}`;
        const cached = offersCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            res.setHeader('X-Cache', 'HIT');
            return res.status(200).json(cached.data);
        }

        const { db } = await connectToDatabase();
        
        // Get user's registered offer codes
        const codesCollection = db.collection('offer_codes');
        const registeredCodes = await codesCollection.find({ farmKey }).toArray();
        
        // Get offers from database
        const offersCollection = db.collection('offers');
        const offers = await offersCollection.find({ farmKey }).sort({ updatedAt: -1 }).toArray();
        
        // Get price cache for recommended prices
        const priceCache = db.collection('price_cache');
        
        // v10.4.0: Helper function for smart rounding (same logic as app.js getPriceCacheKey)
        const getSmartRoundedIncome = (income) => {
            if (income < 25) return Math.round(income);
            if (income < 100) return Math.round(income / 5) * 5;
            return Math.round(income / 10) * 10;
        };
        
        const priceKeys = offers.map(o => {
            if (!o.brainrotName || !o.income) return null;
            const name = o.brainrotName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            let inc = o.income;
            if (typeof inc === 'number' && inc > 10000) inc = inc / 1000000;
            const roundedIncome = getSmartRoundedIncome(parseFloat(inc));
            return `${name}_${roundedIncome}`;
        }).filter(k => k);
        
        const prices = priceKeys.length > 0 
            ? await priceCache.find({ _id: { $in: priceKeys } }).toArray()
            : [];
        const pricesMap = new Map(prices.map(p => [p._id, p]));
        
        // Enrich offers with prices
        for (const offer of offers) {
            if (!offer.brainrotName || !offer.income) continue;
            
            const name = offer.brainrotName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            let inc = offer.income;
            if (typeof inc === 'number' && inc > 10000) inc = inc / 1000000;
            const roundedIncome = getSmartRoundedIncome(parseFloat(inc));  // v10.4.0: Use smart rounding
            const key = `${name}_${roundedIncome}`;
            
            const priceData = pricesMap.get(key);
            if (priceData && priceData.suggestedPrice) {
                offer.recommendedPrice = priceData.suggestedPrice;
                offer.medianPrice = priceData.medianPrice;
                offer.nextCompetitorPrice = priceData.nextCompetitorPrice;
            }
        }
        
        // Build response
        const response = {
            success: true,
            offers: offers,
            registeredCodes: registeredCodes.map(c => ({
                code: c.code,
                brainrotName: c.brainrotName,
                status: c.status,
                mutation: c.mutation,
                lastSeenAt: c.lastSeenAt
            })),
            stats: {
                totalOffers: offers.length,
                activeOffers: offers.filter(o => o.status === 'active').length,
                pausedOffers: offers.filter(o => o.status === 'paused').length,
                pendingOffers: offers.filter(o => o.status === 'pending').length,
                registeredCodes: registeredCodes.length
            },
            timestamp: Date.now()
        };
        
        // Cache the response
        offersCache.set(cacheKey, {
            timestamp: Date.now(),
            data: response
        });
        
        res.setHeader('X-Cache', 'MISS');
        return res.status(200).json(response);
        
    } catch (error) {
        console.error('[offers-fast] Error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
