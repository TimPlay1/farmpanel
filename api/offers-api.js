/**
 * Offers API Handler
 * Uses Eldorado personal API key for offer operations
 * Provides direct API access instead of web scraping
 */

const { getPool } = require('./_lib/db');
const eldoradoApi = require('./eldorado-api');

const ELDORADO_API_BASE = 'https://www.eldorado.gg';

/**
 * Make authenticated request to Eldorado API
 */
async function eldoradoRequest(apiKey, endpoint, options = {}) {
    const url = `${ELDORADO_API_BASE}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Api-Key ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'swagger': 'Swager request',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...options.headers
        }
    });
    
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Eldorado API error ${response.status}: ${text}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    }
    return null;
}

/**
 * Get all offers for a farm via API
 * GET /api/offers-api/list?farm_key=xxx
 */
async function handleGetOffers(req, res) {
    const { farm_key } = req.query;
    
    if (!farm_key) {
        return res.status(400).json({ success: false, error: 'farm_key required' });
    }
    
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farm_key);
        
        if (!apiKey) {
            return res.status(404).json({ 
                success: false, 
                error: 'No API key found',
                useWebScraping: true 
            });
        }
        
        // Fetch all pages of offers
        let allOffers = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
            const data = await eldoradoRequest(apiKey, `/api/predefinedOffers/me?page=${page}&pageSize=50`);
            
            if (data && data.items && data.items.length > 0) {
                allOffers = allOffers.concat(data.items);
                hasMore = allOffers.length < data.totalCount;
                page++;
            } else {
                hasMore = false;
            }
            
            // Safety limit
            if (page > 20) break;
        }
        
        // Transform to match existing offer format
        const offers = allOffers.map(offer => ({
            id: offer.id,
            eldoradoId: offer.id,
            title: offer.title,
            price: offer.price,
            minQuantity: offer.minQuantity,
            maxQuantity: offer.maxQuantity,
            description: offer.description,
            deliveryTime: offer.guaranteedDeliveryMinutes,
            status: offer.isPaused ? 'paused' : 'active',
            isPaused: offer.isPaused,
            created: offer.createdAt,
            updated: offer.updatedAt,
            gameId: offer.gameId,
            categoryId: offer.categoryId,
            source: 'api'
        }));
        
        res.json({
            success: true,
            offers,
            count: offers.length,
            source: 'api'
        });
        
    } catch (e) {
        console.error('[OffersAPI] Get offers error:', e.message);
        res.status(500).json({ 
            success: false, 
            error: e.message,
            useWebScraping: true
        });
    }
}

/**
 * Get single offer details via API
 * GET /api/offers-api/offer/:offerId?farm_key=xxx
 */
async function handleGetOffer(req, res) {
    const { offerId } = req.params;
    const { farm_key } = req.query;
    
    if (!farm_key || !offerId) {
        return res.status(400).json({ success: false, error: 'farm_key and offerId required' });
    }
    
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farm_key);
        
        if (!apiKey) {
            return res.status(404).json({ 
                success: false, 
                error: 'No API key found' 
            });
        }
        
        const offer = await eldoradoRequest(apiKey, `/api/predefinedOffers/${offerId}/private`);
        
        res.json({
            success: true,
            offer: {
                id: offer.id,
                eldoradoId: offer.id,
                title: offer.title,
                price: offer.price,
                minQuantity: offer.minQuantity,
                maxQuantity: offer.maxQuantity,
                description: offer.description,
                deliveryTime: offer.guaranteedDeliveryMinutes,
                status: offer.isPaused ? 'paused' : 'active',
                isPaused: offer.isPaused,
                gameId: offer.gameId,
                categoryId: offer.categoryId,
                source: 'api'
            }
        });
        
    } catch (e) {
        console.error('[OffersAPI] Get offer error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
}

/**
 * Update offer price via API
 * PUT /api/offers-api/offer/:offerId/price
 * Body: { farm_key, price }
 */
async function handleUpdatePrice(req, res) {
    const { offerId } = req.params;
    const { farm_key, price } = req.body;
    
    if (!farm_key || !offerId || price === undefined) {
        return res.status(400).json({ success: false, error: 'farm_key, offerId, and price required' });
    }
    
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farm_key);
        
        if (!apiKey) {
            return res.status(404).json({ success: false, error: 'No API key found' });
        }
        
        await eldoradoRequest(apiKey, `/api/predefinedOffersUser/me/${offerId}/changePrice`, {
            method: 'PUT',
            body: JSON.stringify({ price: parseFloat(price) })
        });
        
        // Log price change
        const pool = await getPool();
        await pool.execute(`
            INSERT INTO price_change_log (farm_key, offer_id, new_price, source, changed_at)
            VALUES (?, ?, ?, 'api', NOW())
        `, [farm_key, offerId, price]).catch(() => {});
        
        res.json({ success: true, message: 'Price updated' });
        
    } catch (e) {
        console.error('[OffersAPI] Update price error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
}

/**
 * Pause offer via API
 * PUT /api/offers-api/offer/:offerId/pause
 */
async function handlePauseOffer(req, res) {
    const { offerId } = req.params;
    const { farm_key } = req.body;
    
    if (!farm_key || !offerId) {
        return res.status(400).json({ success: false, error: 'farm_key and offerId required' });
    }
    
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farm_key);
        
        if (!apiKey) {
            return res.status(404).json({ success: false, error: 'No API key found' });
        }
        
        await eldoradoRequest(apiKey, `/api/predefinedOffersUser/me/${offerId}/pause`, {
            method: 'PUT'
        });
        
        res.json({ success: true, message: 'Offer paused' });
        
    } catch (e) {
        console.error('[OffersAPI] Pause offer error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
}

/**
 * Resume offer via API
 * PUT /api/offers-api/offer/:offerId/resume
 */
async function handleResumeOffer(req, res) {
    const { offerId } = req.params;
    const { farm_key } = req.body;
    
    if (!farm_key || !offerId) {
        return res.status(400).json({ success: false, error: 'farm_key and offerId required' });
    }
    
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farm_key);
        
        if (!apiKey) {
            return res.status(404).json({ success: false, error: 'No API key found' });
        }
        
        await eldoradoRequest(apiKey, `/api/predefinedOffersUser/me/${offerId}/resume`, {
            method: 'PUT'
        });
        
        res.json({ success: true, message: 'Offer resumed' });
        
    } catch (e) {
        console.error('[OffersAPI] Resume offer error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
}

/**
 * Delete offer via API
 * DELETE /api/offers-api/offer/:offerId
 */
async function handleDeleteOffer(req, res) {
    const { offerId } = req.params;
    const { farm_key } = req.query;
    
    if (!farm_key || !offerId) {
        return res.status(400).json({ success: false, error: 'farm_key and offerId required' });
    }
    
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farm_key);
        
        if (!apiKey) {
            return res.status(404).json({ success: false, error: 'No API key found' });
        }
        
        await eldoradoRequest(apiKey, `/api/predefinedOffersUser/me/${offerId}`, {
            method: 'DELETE'
        });
        
        res.json({ success: true, message: 'Offer deleted' });
        
    } catch (e) {
        console.error('[OffersAPI] Delete offer error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
}

/**
 * Create new offer via API
 * POST /api/offers-api/offer
 * Body: { farm_key, title, description, price, minQuantity, maxQuantity, deliveryTime, gameId, categoryId, ... }
 */
async function handleCreateOffer(req, res) {
    const { 
        farm_key, 
        title, 
        description, 
        price, 
        minQuantity = 1,
        maxQuantity = 1,
        deliveryTime = 15,
        gameId,
        categoryId,
        brainrotName
    } = req.body;
    
    if (!farm_key || !title || !price) {
        return res.status(400).json({ success: false, error: 'farm_key, title, and price required' });
    }
    
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farm_key);
        
        if (!apiKey) {
            return res.status(404).json({ success: false, error: 'No API key found' });
        }
        
        // Build offer data
        const offerData = {
            title,
            description: description || '',
            price: parseFloat(price),
            minQuantity: parseInt(minQuantity),
            maxQuantity: parseInt(maxQuantity),
            guaranteedDeliveryMinutes: parseInt(deliveryTime),
            gameId: gameId || 26403,  // Steal a Brainrot game ID
            categoryId: categoryId || 26413  // Items category
        };
        
        const result = await eldoradoRequest(apiKey, '/api/predefinedOffersUser/me', {
            method: 'POST',
            body: JSON.stringify(offerData)
        });
        
        // Log auto-creation
        if (brainrotName) {
            const pool = await getPool();
            await pool.execute(`
                INSERT INTO auto_created_offers (farm_key, brainrot_name, offer_id, price, created_at)
                VALUES (?, ?, ?, ?, NOW())
            `, [farm_key, brainrotName, result?.id || 'unknown', price]).catch(() => {});
        }
        
        res.json({ 
            success: true, 
            message: 'Offer created',
            offerId: result?.id
        });
        
    } catch (e) {
        console.error('[OffersAPI] Create offer error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
}

/**
 * Get recent orders via API
 * GET /api/offers-api/orders?farm_key=xxx&page=1&pageSize=10
 */
async function handleGetOrders(req, res) {
    const { farm_key, page = 1, pageSize = 10 } = req.query;
    
    if (!farm_key) {
        return res.status(400).json({ success: false, error: 'farm_key required' });
    }
    
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farm_key);
        
        if (!apiKey) {
            return res.status(404).json({ success: false, error: 'No API key found' });
        }
        
        const data = await eldoradoRequest(apiKey, 
            `/api/orders/me/seller/orders?page=${page}&pageSize=${pageSize}`
        );
        
        // Transform to simpler format
        const orders = (data.items || []).map(order => ({
            id: order.id,
            orderId: order.orderNumber || order.id,
            offerTitle: order.offerTitle,
            totalPrice: order.totalPrice,
            quantity: order.quantity,
            state: order.state,
            buyerName: order.buyerDisplayName,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        }));
        
        res.json({
            success: true,
            orders,
            totalCount: data.totalCount,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
        });
        
    } catch (e) {
        console.error('[OffersAPI] Get orders error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
}

/**
 * Check for new orders (for notifications)
 * GET /api/offers-api/new-orders?farm_key=xxx
 */
async function handleCheckNewOrders(req, res) {
    const { farm_key } = req.query;
    
    if (!farm_key) {
        return res.status(400).json({ success: false, error: 'farm_key required' });
    }
    
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farm_key);
        
        if (!apiKey) {
            return res.status(404).json({ success: false, error: 'No API key found' });
        }
        
        const pool = await getPool();
        
        // Get last checked order ID
        const [lastRows] = await pool.execute(`
            SELECT last_order_id FROM eldorado_orders_cache WHERE farm_key = ?
        `, [farm_key]);
        
        const lastOrderId = lastRows[0]?.last_order_id || '0';
        
        // Fetch recent orders
        const data = await eldoradoRequest(apiKey, '/api/orders/me/seller/orders?page=1&pageSize=5');
        
        const orders = data.items || [];
        const newOrders = [];
        
        for (const order of orders) {
            if (order.id > lastOrderId) {
                newOrders.push({
                    id: order.id,
                    orderId: order.orderNumber || order.id,
                    offerTitle: order.offerTitle,
                    totalPrice: order.totalPrice,
                    quantity: order.quantity,
                    state: order.state,
                    buyerName: order.buyerDisplayName
                });
            }
        }
        
        // Update last checked order ID
        if (orders.length > 0) {
            const newestOrderId = orders[0].id;
            await pool.execute(`
                INSERT INTO eldorado_orders_cache (farm_key, last_order_id, last_check_at)
                VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                    last_order_id = VALUES(last_order_id),
                    last_check_at = NOW()
            `, [farm_key, newestOrderId]);
        }
        
        res.json({
            success: true,
            newOrders,
            hasNew: newOrders.length > 0
        });
        
    } catch (e) {
        console.error('[OffersAPI] Check new orders error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
}

module.exports = {
    handleGetOffers,
    handleGetOffer,
    handleUpdatePrice,
    handlePauseOffer,
    handleResumeOffer,
    handleDeleteOffer,
    handleCreateOffer,
    handleGetOrders,
    handleCheckNewOrders
};
