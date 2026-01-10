/**
 * Eldorado Brainrots List API - v10.3.54
 * 
 * Returns cached list of brainrots available in Eldorado
 * Used by frontend to determine if brainrot is in Eldorado list for correct link generation
 * 
 * Cache TTL: 30 minutes
 * Refreshes from static file + dynamic API if available
 */

// Static list from file (fallback)
let staticBrainrots = [];
try {
    staticBrainrots = require('../data/eldorado-brainrot-ids.json');
    console.log(`📋 Loaded ${staticBrainrots.length} static Eldorado brainrots`);
} catch (e) {
    console.error('Failed to load eldorado-brainrot-ids.json:', e.message);
}

// Cache for combined list
let cachedList = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Get combined brainrot list (static + aliases)
 */
function getCombinedList() {
    const now = Date.now();
    
    // Return cache if valid
    if (cachedList && now - cacheTimestamp < CACHE_TTL) {
        return cachedList;
    }
    
    // Build list from static data
    const brainrotNames = new Set();
    
    // Add all static brainrots
    for (const item of staticBrainrots) {
        if (item.name) {
            brainrotNames.add(item.name.toLowerCase());
        }
    }
    
    // Add known aliases (same as in eldorado-price.js)
    const BRAINROT_NAME_ALIASES = {
        'ginger gerat': 'ginger girat',
        'giandante mozzarello': 'giandante mozzarella',
        'la taco 2 combinasion': 'la taco combinasion 2',
        'cagatto bombastico': 'cagatto',
        'boatito auratito': 'boatito',
        'cappuccino assassino golden': 'cappuccino assassino',
        'cappuccino assasino gold': 'cappuccino assassino',
        'cappuccino assassino gold': 'cappuccino assassino',
        'reinito slegito': 'reinitio slegito',
        'obunga': 'obunga classic',
        'la ginger': 'la ginger sekolah',
    };
    
    for (const alias of Object.keys(BRAINROT_NAME_ALIASES)) {
        brainrotNames.add(alias);
    }
    for (const target of Object.values(BRAINROT_NAME_ALIASES)) {
        brainrotNames.add(target.toLowerCase());
    }
    
    // Convert to sorted array
    cachedList = {
        brainrots: Array.from(brainrotNames).sort(),
        count: brainrotNames.size,
        cacheTimestamp: now,
        expiresAt: now + CACHE_TTL,
        source: 'static'
    };
    cacheTimestamp = now;
    
    console.log(`📋 Built Eldorado list cache: ${cachedList.count} brainrots`);
    
    return cachedList;
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=1800'); // Browser cache 30 min
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const list = getCombinedList();
        
        return res.status(200).json(list);
    } catch (error) {
        console.error('Error getting Eldorado list:', error);
        return res.status(500).json({ 
            error: 'Failed to get Eldorado list',
            message: error.message 
        });
    }
};
