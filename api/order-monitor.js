/**
 * Order Monitor - Checks for new orders and sends Telegram notifications
 * Runs periodically to detect new sales for users with API keys
 */

const { getPool } = require('./_lib/db');
const eldoradoApi = require('./eldorado-api');

const ELDORADO_API_BASE = 'https://www.eldorado.gg';

// Check interval - 60 seconds
const CHECK_INTERVAL_MS = 60 * 1000;

// Track if monitor is running
let isRunning = false;
let checkInterval = null;
let telegramBot = null;

/**
 * Start the order monitor
 */
function startOrderMonitor(bot) {
    if (isRunning) {
        console.log('[OrderMonitor] Already running');
        return;
    }
    
    telegramBot = bot;
    isRunning = true;
    
    console.log('[OrderMonitor] Started - checking every 60s');
    
    // Initial check after 10 seconds
    setTimeout(() => checkAllFarmsForNewOrders(), 10000);
    
    // Regular checks
    checkInterval = setInterval(() => checkAllFarmsForNewOrders(), CHECK_INTERVAL_MS);
}

/**
 * Stop the order monitor
 */
function stopOrderMonitor() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
    isRunning = false;
    console.log('[OrderMonitor] Stopped');
}

/**
 * Check all farms with API keys for new orders
 */
async function checkAllFarmsForNewOrders() {
    if (!telegramBot) {
        console.warn('[OrderMonitor] No Telegram bot instance');
        return;
    }
    
    try {
        const pool = await getPool();
        
        // Get all farms with active API keys and linked Telegram
        const [rows] = await pool.execute(`
            SELECT farm_key, telegram_user_id, seller_name
            FROM eldorado_api_keys 
            WHERE is_active = TRUE 
              AND telegram_verified = TRUE 
              AND telegram_user_id IS NOT NULL
        `);
        
        if (rows.length === 0) {
            return; // No farms to check
        }
        
        console.log(`[OrderMonitor] Checking ${rows.length} farms for new orders...`);
        
        for (const row of rows) {
            try {
                await checkFarmForNewOrders(row.farm_key, row.telegram_user_id, row.seller_name);
                
                // Rate limit - wait 1 second between farms
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                console.warn(`[OrderMonitor] Error checking ${row.farm_key}: ${e.message}`);
            }
        }
        
    } catch (e) {
        console.error('[OrderMonitor] Check all farms error:', e.message);
    }
}

/**
 * Check single farm for new orders
 */
async function checkFarmForNewOrders(farmKey, telegramUserId, sellerName) {
    const apiKey = await eldoradoApi.getApiKeyForFarm(farmKey);
    if (!apiKey) return;
    
    const pool = await getPool();
    
    // Get last checked order
    const [cacheRows] = await pool.execute(`
        SELECT last_order_id, last_check_at FROM eldorado_orders_cache 
        WHERE farm_key = ?
    `, [farmKey]);
    
    const lastOrderId = cacheRows[0]?.last_order_id || '0';
    
    // Fetch recent orders from Eldorado
    const response = await fetch(`${ELDORADO_API_BASE}/api/orders/me/seller/orders?page=1&pageSize=5`, {
        headers: {
            'Authorization': `Api-Key ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const orders = data.items || [];
    
    if (orders.length === 0) return;
    
    // Find new orders
    const newOrders = orders.filter(order => order.id > lastOrderId);
    
    if (newOrders.length > 0) {
        // Update last checked order
        const newestOrderId = orders[0].id;
        await pool.execute(`
            INSERT INTO eldorado_orders_cache (farm_key, last_order_id, last_check_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
                last_order_id = VALUES(last_order_id),
                last_check_at = NOW()
        `, [farmKey, newestOrderId]);
        
        // Send notifications for each new order
        for (const order of newOrders.reverse()) { // oldest first
            await sendOrderNotification(telegramUserId, order, sellerName);
            
            // Wait between notifications
            await new Promise(r => setTimeout(r, 500));
        }
    } else {
        // Just update check time
        await pool.execute(`
            INSERT INTO eldorado_orders_cache (farm_key, last_order_id, last_check_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE last_check_at = NOW()
        `, [farmKey, lastOrderId]);
    }
}

/**
 * Send Telegram notification about new order
 */
async function sendOrderNotification(telegramUserId, order, sellerName) {
    if (!telegramBot) return;
    
    try {
        const price = order.totalPrice ? `$${order.totalPrice.toFixed(2)}` : 'N/A';
        const quantity = order.quantity || 1;
        const buyer = order.buyerDisplayName || 'Unknown';
        const title = order.offerTitle || 'Item';
        
        // Compact notification format
        let text = `🛒 <b>New Sale!</b>\n\n`;
        text += `<b>${title.substring(0, 40)}${title.length > 40 ? '...' : ''}</b>\n`;
        text += `💰 ${price}`;
        if (quantity > 1) text += ` (x${quantity})`;
        text += `\n👤 ${buyer}\n`;
        
        // Order link
        if (order.id) {
            text += `\n🔗 <a href="https://www.eldorado.gg/orders/${order.id}">View Order</a>`;
        }
        
        await telegramBot.sendMessage(telegramUserId, text, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
        
        console.log(`[OrderMonitor] Sent notification to ${telegramUserId}: ${title} - ${price}`);
        
    } catch (e) {
        console.error(`[OrderMonitor] Failed to send notification: ${e.message}`);
    }
}

/**
 * Manually trigger check for a specific farm (for testing)
 */
async function triggerCheckForFarm(farmKey) {
    const pool = await getPool();
    
    const [rows] = await pool.execute(`
        SELECT telegram_user_id, seller_name FROM eldorado_api_keys 
        WHERE farm_key = ? AND is_active = TRUE AND telegram_user_id IS NOT NULL
    `, [farmKey]);
    
    if (rows.length > 0) {
        await checkFarmForNewOrders(farmKey, rows[0].telegram_user_id, rows[0].seller_name);
        return { success: true };
    }
    
    return { success: false, error: 'Farm not found or not linked to Telegram' };
}

module.exports = {
    startOrderMonitor,
    stopOrderMonitor,
    triggerCheckForFarm
};
