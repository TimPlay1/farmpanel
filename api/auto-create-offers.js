/**
 * Auto-Create Offers Handler
 * Automatically creates Eldorado offers for brainrots that don't have offers yet
 * Uses personal API key for authenticated users
 */

const { getPool } = require('./_lib/db');
const eldoradoApi = require('./eldorado-api');

const ELDORADO_API_BASE = 'https://www.eldorado.gg';

// Steal a Brainrot game configuration
const GAME_ID = 26403;
const CATEGORY_ID = 26413;  // Items category
const DEFAULT_DELIVERY_TIME = 15;  // 15 minutes

/**
 * Get brainrots that don't have offers yet
 * @param {string} farmKey - Farm key
 * @returns {Array} List of brainrots without offers
 */
async function getBrainrotsWithoutOffers(farmKey) {
    const pool = await getPool();
    
    try {
        // Get all brainrots for this farm
        const [brainrotRows] = await pool.execute(`
            SELECT DISTINCT 
                fb.name, 
                fb.income,
                fb.mutation,
                fa.username as account_name
            FROM farmer_brainrots fb
            JOIN farmer_accounts fa ON fb.account_id = fa.id
            JOIN farmers f ON fa.farmer_id = f.id
            WHERE f.farm_key = ?
            ORDER BY fb.income DESC
        `, [farmKey]);
        
        if (brainrotRows.length === 0) {
            return [];
        }
        
        // Get existing offers for this farm
        const [offerRows] = await pool.execute(`
            SELECT DISTINCT brainrot_name FROM offers WHERE farm_key = ?
        `, [farmKey]);
        
        const existingOfferNames = new Set(offerRows.map(r => r.brainrot_name?.toLowerCase()));
        
        // Filter brainrots that don't have offers
        const withoutOffers = brainrotRows.filter(b => {
            const key = b.name.toLowerCase();
            return !existingOfferNames.has(key);
        });
        
        // Group by name to avoid duplicates
        const uniqueBrainrots = new Map();
        for (const b of withoutOffers) {
            const key = b.name.toLowerCase();
            if (!uniqueBrainrots.has(key) || b.income > uniqueBrainrots.get(key).income) {
                uniqueBrainrots.set(key, b);
            }
        }
        
        return Array.from(uniqueBrainrots.values());
        
    } catch (e) {
        console.error('[AutoCreate] Error getting brainrots without offers:', e.message);
        return [];
    }
}

/**
 * Get suggested price for a brainrot from cache
 */
async function getSuggestedPrice(brainrotName, income) {
    const pool = await getPool();
    
    try {
        // Try to find cached price
        const [rows] = await pool.execute(`
            SELECT price, source FROM price_cache 
            WHERE brainrot_name = ? 
            ORDER BY updated_at DESC 
            LIMIT 1
        `, [brainrotName]);
        
        if (rows.length > 0 && rows[0].price) {
            return parseFloat(rows[0].price);
        }
        
        // Fallback: estimate based on income
        // Formula: $1 per 1M income/s (very rough estimate)
        const incomeMs = parseFloat(income) || 0;
        if (incomeMs > 0) {
            return Math.max(0.50, incomeMs * 0.5);  // At least $0.50
        }
        
        return 1.00;  // Default $1.00
        
    } catch (e) {
        console.warn('[AutoCreate] Price lookup error:', e.message);
        return 1.00;
    }
}

/**
 * Create offer on Eldorado via API
 */
async function createOfferOnEldorado(apiKey, brainrot, price) {
    const title = `Steal a Brainrot - ${brainrot.name}`;
    const description = `${brainrot.name} brainrot from Steal a Brainrot Roblox game.\n` +
        `Income: ${brainrot.income || 'N/A'}/s\n` +
        (brainrot.mutation && brainrot.mutation !== 'None' ? `Mutation: ${brainrot.mutation}\n` : '') +
        `Fast delivery - usually within 15 minutes!`;
    
    const offerData = {
        title,
        description,
        price: parseFloat(price),
        minQuantity: 1,
        maxQuantity: 1,
        guaranteedDeliveryMinutes: DEFAULT_DELIVERY_TIME,
        gameId: GAME_ID,
        categoryId: CATEGORY_ID
    };
    
    const response = await fetch(`${ELDORADO_API_BASE}/api/predefinedOffersUser/me`, {
        method: 'POST',
        headers: {
            'Authorization': `Api-Key ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'swagger': 'Swager request',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify(offerData)
    });
    
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Eldorado API error ${response.status}: ${text}`);
    }
    
    const result = await response.json();
    return result;
}

/**
 * Handle auto-create offers request
 * POST /api/auto-create-offers
 * Body: { farm_key, brainrot_names: ['name1', 'name2'] } OR { farm_key, all: true }
 */
async function handleAutoCreate(req, res) {
    const { farm_key, brainrot_names, all = false, dry_run = false } = req.body;
    
    if (!farm_key) {
        return res.status(400).json({ success: false, error: 'farm_key required' });
    }
    
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farm_key);
        
        if (!apiKey) {
            return res.status(404).json({ 
                success: false, 
                error: 'No API key found. Please connect your Eldorado API key first.' 
            });
        }
        
        // Get brainrots without offers
        const allWithoutOffers = await getBrainrotsWithoutOffers(farm_key);
        
        if (allWithoutOffers.length === 0) {
            return res.json({ 
                success: true, 
                message: 'All brainrots already have offers',
                created: 0 
            });
        }
        
        // Filter by specified names if not "all"
        let toCreate = allWithoutOffers;
        if (!all && brainrot_names && brainrot_names.length > 0) {
            const nameSet = new Set(brainrot_names.map(n => n.toLowerCase()));
            toCreate = allWithoutOffers.filter(b => nameSet.has(b.name.toLowerCase()));
        }
        
        if (toCreate.length === 0) {
            return res.json({ 
                success: true, 
                message: 'No matching brainrots found to create offers for',
                created: 0 
            });
        }
        
        // If dry run - just return what would be created
        if (dry_run) {
            const preview = [];
            for (const b of toCreate) {
                const price = await getSuggestedPrice(b.name, b.income);
                preview.push({
                    name: b.name,
                    income: b.income,
                    mutation: b.mutation,
                    suggestedPrice: price
                });
            }
            
            return res.json({
                success: true,
                dry_run: true,
                would_create: toCreate.length,
                offers: preview
            });
        }
        
        // Create offers
        const pool = await getPool();
        const created = [];
        const errors = [];
        
        for (const brainrot of toCreate) {
            try {
                const price = await getSuggestedPrice(brainrot.name, brainrot.income);
                
                const result = await createOfferOnEldorado(apiKey, brainrot, price);
                
                // Log the created offer
                await pool.execute(`
                    INSERT INTO auto_created_offers 
                    (farm_key, brainrot_name, offer_id, price, created_at)
                    VALUES (?, ?, ?, ?, NOW())
                `, [farm_key, brainrot.name, result?.id || 'unknown', price]).catch(() => {});
                
                created.push({
                    name: brainrot.name,
                    offerId: result?.id,
                    price
                });
                
                // Rate limit - wait 1 second between creates
                await new Promise(r => setTimeout(r, 1000));
                
            } catch (e) {
                console.error(`[AutoCreate] Failed to create offer for ${brainrot.name}:`, e.message);
                errors.push({
                    name: brainrot.name,
                    error: e.message
                });
            }
        }
        
        res.json({
            success: true,
            created: created.length,
            errors: errors.length,
            offers: created,
            failed: errors
        });
        
    } catch (e) {
        console.error('[AutoCreate] Error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
}

/**
 * Handle get brainrots without offers
 * GET /api/auto-create-offers/available?farm_key=xxx
 */
async function handleGetAvailable(req, res) {
    const { farm_key } = req.query;
    
    if (!farm_key) {
        return res.status(400).json({ success: false, error: 'farm_key required' });
    }
    
    try {
        const hasApiKey = await eldoradoApi.hasActiveApiKey(farm_key);
        
        if (!hasApiKey) {
            return res.status(404).json({ 
                success: false, 
                error: 'No API key found' 
            });
        }
        
        const available = await getBrainrotsWithoutOffers(farm_key);
        
        // Get suggested prices for each
        const withPrices = [];
        for (const b of available) {
            const price = await getSuggestedPrice(b.name, b.income);
            withPrices.push({
                name: b.name,
                income: b.income,
                mutation: b.mutation,
                suggestedPrice: price
            });
        }
        
        res.json({
            success: true,
            count: withPrices.length,
            brainrots: withPrices
        });
        
    } catch (e) {
        console.error('[AutoCreate] Get available error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
}

module.exports = {
    handleAutoCreate,
    handleGetAvailable,
    getBrainrotsWithoutOffers,
    getSuggestedPrice,
    createOfferOnEldorado
};
