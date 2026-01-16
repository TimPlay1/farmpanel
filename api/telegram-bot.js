/**
 * FarmerPanel Telegram Bot
 * Provides Eldorado offer management via Telegram inline buttons
 * Bot Token: 7697571519:AAF8_Kd-3nvQrzoja7EV6v9kXQi4ewNA2S4
 */

const TelegramBot = require('node-telegram-bot-api');
const { getPool } = require('./_lib/db');
const eldoradoApi = require('./eldorado-api');

// Order monitor for sale notifications
let orderMonitor = null;
try {
    orderMonitor = require('./order-monitor');
} catch (e) {
    console.warn('[TelegramBot] Order monitor not available');
}

// Bot configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7697571519:AAF8_Kd-3nvQrzoja7EV6v9kXQi4ewNA2S4';
const ELDORADO_API_BASE = 'https://www.eldorado.gg';

// Rate limiting
const userCooldowns = new Map();
const COMMAND_COOLDOWN_MS = 1000;

let bot = null;

// Custom emoji icons (using unicode symbols for better compatibility)
const ICONS = {
    offers: '📦',
    collection: '🎮',
    prices: '💰',
    notifications: '🔔',
    settings: '⚙️',
    back: '◀️',
    refresh: '🔄',
    check: '✓',
    cross: '✗',
    edit: '✏️',
    delete: '🗑️',
    pause: '⏸️',
    play: '▶️',
    up: '↑',
    down: '↓',
    money: '$',
    brain: '🧠',
    store: '🏪',
    sale: '🛒',
    link: '🔗'
};

/**
 * Initialize Telegram Bot
 */
function initBot() {
    if (bot) return bot;
    
    try {
        bot = new TelegramBot(BOT_TOKEN, { polling: true });
        
        setupCommandHandlers();
        setupCallbackHandlers();
        
        // Start order monitor for sale notifications
        if (orderMonitor) {
            orderMonitor.startOrderMonitor(bot);
        }
        
        console.log('[TelegramBot] Bot initialized and polling');
        return bot;
    } catch (e) {
        console.error('[TelegramBot] Failed to initialize:', e.message);
        return null;
    }
}

/**
 * Check if user is rate limited
 */
function isRateLimited(userId) {
    const lastCommand = userCooldowns.get(userId);
    if (lastCommand && Date.now() - lastCommand < COMMAND_COOLDOWN_MS) {
        return true;
    }
    userCooldowns.set(userId, Date.now());
    return false;
}

/**
 * Get or create session for user
 */
async function getSession(telegramUserId, telegramUsername = null) {
    const pool = await getPool();
    
    const [rows] = await pool.execute(`
        SELECT * FROM telegram_bot_sessions WHERE telegram_user_id = ?
    `, [telegramUserId]);
    
    if (rows.length > 0) {
        // Update last activity
        await pool.execute(`
            UPDATE telegram_bot_sessions 
            SET last_activity_at = NOW(), telegram_username = COALESCE(?, telegram_username)
            WHERE telegram_user_id = ?
        `, [telegramUsername, telegramUserId]);
        
        return rows[0];
    }
    
    return null;
}

/**
 * Create session after authentication
 */
async function createSession(telegramUserId, telegramUsername, farmKey) {
    const pool = await getPool();
    
    await pool.execute(`
        INSERT INTO telegram_bot_sessions 
        (telegram_user_id, telegram_username, farm_key, is_authenticated, last_activity_at)
        VALUES (?, ?, ?, TRUE, NOW())
        ON DUPLICATE KEY UPDATE
            farm_key = VALUES(farm_key),
            telegram_username = VALUES(telegram_username),
            is_authenticated = TRUE,
            last_activity_at = NOW()
    `, [telegramUserId, telegramUsername, farmKey]);
    
    // Link telegram to API key
    await pool.execute(`
        UPDATE eldorado_api_keys 
        SET telegram_user_id = ?, telegram_username = ?, telegram_verified = TRUE
        WHERE farm_key = ?
    `, [telegramUserId, telegramUsername, farmKey]);
}

/**
 * Authenticate user with API key
 */
async function authenticateWithApiKey(apiKey, telegramUserId, telegramUsername) {
    const pool = await getPool();
    
    // Hash the API key for comparison
    const keyHash = require('crypto').createHash('sha256').update(apiKey).digest('hex').substring(0, 32);
    
    // Find matching API key
    const [rows] = await pool.execute(`
        SELECT farm_key, seller_name FROM eldorado_api_keys 
        WHERE api_key_hash = ? AND is_active = TRUE
    `, [keyHash]);
    
    if (rows.length === 0) {
        // Try to validate with Eldorado directly
        const validation = await eldoradoApi.validateEldoradoApiKey(apiKey);
        if (!validation.valid) {
            return { success: false, error: 'Invalid API key' };
        }
        
        // Key is valid but not in our system yet
        return { success: false, error: 'API key not registered in FarmerPanel. Please add it via the web panel first.' };
    }
    
    const { farm_key, seller_name } = rows[0];
    
    // Create session
    await createSession(telegramUserId, telegramUsername, farm_key);
    
    return { success: true, farmKey: farm_key, sellerName: seller_name };
}

/**
 * Get authenticated farm key for user
 */
async function getAuthenticatedFarmKey(telegramUserId) {
    const session = await getSession(telegramUserId);
    if (session && session.is_authenticated) {
        return session.farm_key;
    }
    return null;
}

/**
 * Setup command handlers
 */
function setupCommandHandlers() {
    // /start command
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const username = msg.from.username;
        
        if (isRateLimited(userId)) return;
        
        const session = await getSession(userId, username);
        
        if (session && session.is_authenticated) {
            // Already authenticated - show main menu
            await sendMainMenu(chatId, session.farm_key);
        } else {
            // Show authentication prompt
            await sendAuthPrompt(chatId);
        }
    });
    
    // /auth command
    bot.onText(/\/auth (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const username = msg.from.username;
        const apiKey = match[1].trim();
        
        if (isRateLimited(userId)) return;
        
        // Delete the message with API key for security
        try {
            await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {
            // May fail if already deleted
        }
        
        await bot.sendMessage(chatId, 'Authenticating...');
        
        const result = await authenticateWithApiKey(apiKey, userId, username);
        
        if (result.success) {
            await bot.sendMessage(chatId, 
                `${ICONS.check} Authentication successful!\n\nWelcome, ${result.sellerName || 'Seller'}!`,
                { parse_mode: 'HTML' }
            );
            await sendMainMenu(chatId, result.farmKey);
        } else {
            await bot.sendMessage(chatId, 
                `${ICONS.cross} ${result.error}\n\nUse /auth YOUR-API-KEY to try again.`
            );
        }
    });
    
    // /menu command
    bot.onText(/\/menu/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        if (isRateLimited(userId)) return;
        
        const farmKey = await getAuthenticatedFarmKey(userId);
        if (!farmKey) {
            await sendAuthPrompt(chatId);
            return;
        }
        
        await sendMainMenu(chatId, farmKey);
    });
    
    // /offers command
    bot.onText(/\/offers/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        if (isRateLimited(userId)) return;
        
        const farmKey = await getAuthenticatedFarmKey(userId);
        if (!farmKey) {
            await sendAuthPrompt(chatId);
            return;
        }
        
        await sendOffersList(chatId, farmKey, 0);
    });
    
    // /logout command
    bot.onText(/\/logout/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        if (isRateLimited(userId)) return;
        
        const pool = await getPool();
        await pool.execute(`
            UPDATE telegram_bot_sessions 
            SET is_authenticated = FALSE 
            WHERE telegram_user_id = ?
        `, [userId]);
        
        await bot.sendMessage(chatId, 
            `${ICONS.check} Logged out successfully.\n\nUse /start to authenticate again.`
        );
    });
}

/**
 * Setup callback query handlers for inline buttons
 */
function setupCallbackHandlers() {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const userId = query.from.id;
        const data = query.data;
        
        if (isRateLimited(userId)) {
            await bot.answerCallbackQuery(query.id);
            return;
        }
        
        const farmKey = await getAuthenticatedFarmKey(userId);
        if (!farmKey && !data.startsWith('auth_')) {
            await bot.answerCallbackQuery(query.id, { text: 'Please authenticate first' });
            await sendAuthPrompt(chatId);
            return;
        }
        
        try {
            // Parse callback data
            const [action, ...params] = data.split(':');
            
            switch (action) {
                case 'menu':
                    await sendMainMenu(chatId, farmKey, messageId);
                    break;
                    
                case 'offers':
                    const page = parseInt(params[0]) || 0;
                    await sendOffersList(chatId, farmKey, page, messageId);
                    break;
                    
                case 'offer':
                    await sendOfferDetails(chatId, farmKey, params[0], messageId);
                    break;
                    
                case 'offer_price':
                    await sendPriceOptions(chatId, farmKey, params[0], messageId);
                    break;
                    
                case 'set_price':
                    await setOfferPrice(chatId, farmKey, params[0], params[1], messageId);
                    break;
                    
                case 'delete_offer':
                    await deleteOffer(chatId, farmKey, params[0], messageId);
                    break;
                    
                case 'confirm_delete':
                    await confirmDeleteOffer(chatId, farmKey, params[0], messageId);
                    break;
                    
                case 'pause_offer':
                    await pauseOffer(chatId, farmKey, params[0], messageId);
                    break;
                    
                case 'resume_offer':
                    await resumeOffer(chatId, farmKey, params[0], messageId);
                    break;
                    
                case 'collection':
                    await sendCollectionSummary(chatId, farmKey, messageId);
                    break;
                    
                case 'orders':
                    await sendRecentOrders(chatId, farmKey, messageId);
                    break;
                    
                case 'autocreate':
                    await sendAutoCreateMenu(chatId, farmKey, messageId);
                    break;
                    
                case 'autocreate_all':
                    await executeAutoCreate(chatId, farmKey, true, messageId);
                    break;
                    
                case 'refresh':
                    // Refresh current view
                    if (params[0] === 'offers') {
                        await sendOffersList(chatId, farmKey, parseInt(params[1]) || 0, messageId);
                    }
                    break;
                    
                default:
                    await bot.answerCallbackQuery(query.id, { text: 'Unknown action' });
            }
            
            await bot.answerCallbackQuery(query.id);
            
        } catch (e) {
            console.error('[TelegramBot] Callback error:', e.message);
            await bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
        }
    });
}

/**
 * Send authentication prompt
 */
async function sendAuthPrompt(chatId) {
    const text = `
${ICONS.brain} <b>FarmerPanel Bot</b>

Welcome! This bot helps you manage your Eldorado offers.

To get started, authenticate with your Eldorado API key:

<code>/auth YOUR-API-KEY</code>

${ICONS.link} Get your API key from the FarmerPanel web interface or Eldorado Dashboard.
`;
    
    await bot.sendMessage(chatId, text, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true
    });
}

/**
 * Send main menu
 */
async function sendMainMenu(chatId, farmKey, editMessageId = null) {
    // Get quick stats
    let stats = { offers: 0, brainrots: 0 };
    try {
        const pool = await getPool();
        
        // Count offers
        const [offerRows] = await pool.execute(`
            SELECT COUNT(*) as count FROM offers WHERE farm_key = ? AND status IN ('active', 'paused')
        `, [farmKey]);
        stats.offers = offerRows[0]?.count || 0;
        
        // Count brainrots
        const [brainrotRows] = await pool.execute(`
            SELECT COUNT(*) as count FROM farmer_brainrots fb
            JOIN farmer_accounts fa ON fb.account_id = fa.id
            JOIN farmers f ON fa.farmer_id = f.id
            WHERE f.farm_key = ?
        `, [farmKey]);
        stats.brainrots = brainrotRows[0]?.count || 0;
        
    } catch (e) {
        console.warn('[TelegramBot] Stats fetch error:', e.message);
    }
    
    const text = `
${ICONS.store} <b>FarmerPanel</b>

${ICONS.offers} Offers: <b>${stats.offers}</b>
${ICONS.brain} Brainrots: <b>${stats.brainrots}</b>

Select an option:
`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: `${ICONS.offers} My Offers`, callback_data: 'offers:0' },
                { text: `${ICONS.collection} Collection`, callback_data: 'collection' }
            ],
            [
                { text: `${ICONS.sale} Recent Orders`, callback_data: 'orders' },
                { text: `✨ Auto-Create`, callback_data: 'autocreate' }
            ],
            [
                { text: `${ICONS.refresh} Refresh`, callback_data: 'menu' }
            ]
        ]
    };
    
    if (editMessageId) {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: editMessageId,
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    } else {
        await bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    }
}

/**
 * Send offers list with pagination
 */
async function sendOffersList(chatId, farmKey, page = 0, editMessageId = null) {
    const pageSize = 5;
    const offset = page * pageSize;
    
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farmKey);
        
        if (!apiKey) {
            const text = `${ICONS.cross} API key not found. Please set up your API key in FarmerPanel.`;
            if (editMessageId) {
                await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId });
            } else {
                await bot.sendMessage(chatId, text);
            }
            return;
        }
        
        // Fetch offers from Eldorado API
        const response = await fetch(`${ELDORADO_API_BASE}/api/predefinedOffers/me?page=${page + 1}&pageSize=${pageSize}`, {
            headers: {
                'Authorization': `Api-Key ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const offers = data.items || [];
        const totalCount = data.totalCount || 0;
        const totalPages = Math.ceil(totalCount / pageSize);
        
        if (offers.length === 0) {
            const text = `${ICONS.offers} <b>My Offers</b>\n\nNo offers found.`;
            const keyboard = {
                inline_keyboard: [
                    [{ text: `${ICONS.back} Back to Menu`, callback_data: 'menu' }]
                ]
            };
            
            if (editMessageId) {
                await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, parse_mode: 'HTML', reply_markup: keyboard });
            } else {
                await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
            }
            return;
        }
        
        // Build offers list
        let text = `${ICONS.offers} <b>My Offers</b> (${totalCount} total)\n\n`;
        
        const offerButtons = [];
        
        for (const offer of offers) {
            const status = offer.isPaused ? '⏸️' : '✓';
            const price = offer.price ? `$${offer.price.toFixed(2)}` : 'N/A';
            text += `${status} <b>${offer.title?.substring(0, 30) || 'Offer'}...</b>\n   ${ICONS.money}${price}\n\n`;
            
            offerButtons.push([{
                text: `${offer.title?.substring(0, 25) || 'View'} - ${price}`,
                callback_data: `offer:${offer.id}`
            }]);
        }
        
        // Navigation buttons
        const navButtons = [];
        if (page > 0) {
            navButtons.push({ text: `${ICONS.back} Prev`, callback_data: `offers:${page - 1}` });
        }
        navButtons.push({ text: `${page + 1}/${totalPages}`, callback_data: 'noop' });
        if (page < totalPages - 1) {
            navButtons.push({ text: `Next ▶️`, callback_data: `offers:${page + 1}` });
        }
        
        const keyboard = {
            inline_keyboard: [
                ...offerButtons,
                navButtons,
                [
                    { text: `${ICONS.refresh} Refresh`, callback_data: `refresh:offers:${page}` },
                    { text: `${ICONS.back} Menu`, callback_data: 'menu' }
                ]
            ]
        };
        
        if (editMessageId) {
            await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, parse_mode: 'HTML', reply_markup: keyboard });
        } else {
            await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        
    } catch (e) {
        console.error('[TelegramBot] Offers list error:', e.message);
        const text = `${ICONS.cross} Failed to load offers: ${e.message}`;
        if (editMessageId) {
            await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId });
        } else {
            await bot.sendMessage(chatId, text);
        }
    }
}

/**
 * Send offer details
 */
async function sendOfferDetails(chatId, farmKey, offerId, editMessageId = null) {
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farmKey);
        if (!apiKey) {
            await bot.editMessageText(`${ICONS.cross} API key not found.`, { chat_id: chatId, message_id: editMessageId });
            return;
        }
        
        // Fetch offer details
        const response = await fetch(`${ELDORADO_API_BASE}/api/predefinedOffers/${offerId}/private`, {
            headers: {
                'Authorization': `Api-Key ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const offer = await response.json();
        
        const status = offer.isPaused ? 'Paused' : 'Active';
        const price = offer.price ? `$${offer.price.toFixed(2)}` : 'N/A';
        
        const text = `
${ICONS.offers} <b>Offer Details</b>

<b>${offer.title || 'Untitled'}</b>

${ICONS.money} Price: <b>${price}</b>
Status: ${offer.isPaused ? '⏸️ Paused' : '✓ Active'}
Delivery: ${offer.guaranteedDeliveryMinutes || 'N/A'} min

${offer.description ? `\n${offer.description.substring(0, 200)}...` : ''}
`;
        
        const pauseResumeBtn = offer.isPaused 
            ? { text: `${ICONS.play} Resume`, callback_data: `resume_offer:${offerId}` }
            : { text: `${ICONS.pause} Pause`, callback_data: `pause_offer:${offerId}` };
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: `${ICONS.edit} Change Price`, callback_data: `offer_price:${offerId}` },
                    pauseResumeBtn
                ],
                [
                    { text: `${ICONS.delete} Delete`, callback_data: `delete_offer:${offerId}` }
                ],
                [
                    { text: `${ICONS.back} Back to Offers`, callback_data: 'offers:0' },
                    { text: `${ICONS.back} Menu`, callback_data: 'menu' }
                ]
            ]
        };
        
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: editMessageId,
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
        
    } catch (e) {
        console.error('[TelegramBot] Offer details error:', e.message);
        await bot.editMessageText(`${ICONS.cross} Failed to load offer details.`, { chat_id: chatId, message_id: editMessageId });
    }
}

/**
 * Send price options for offer
 */
async function sendPriceOptions(chatId, farmKey, offerId, editMessageId) {
    const text = `
${ICONS.edit} <b>Change Price</b>

Select new price option:
`;
    
    // Price adjustment options
    const keyboard = {
        inline_keyboard: [
            [
                { text: '-$0.50', callback_data: `set_price:${offerId}:-0.50` },
                { text: '-$0.25', callback_data: `set_price:${offerId}:-0.25` },
                { text: '-$0.10', callback_data: `set_price:${offerId}:-0.10` }
            ],
            [
                { text: '+$0.10', callback_data: `set_price:${offerId}:+0.10` },
                { text: '+$0.25', callback_data: `set_price:${offerId}:+0.25` },
                { text: '+$0.50', callback_data: `set_price:${offerId}:+0.50` }
            ],
            [
                { text: `${ICONS.back} Back`, callback_data: `offer:${offerId}` }
            ]
        ]
    };
    
    await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: editMessageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
    });
}

/**
 * Set offer price
 */
async function setOfferPrice(chatId, farmKey, offerId, priceChange, editMessageId) {
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farmKey);
        if (!apiKey) {
            await bot.editMessageText(`${ICONS.cross} API key not found.`, { chat_id: chatId, message_id: editMessageId });
            return;
        }
        
        // Get current price
        const getResponse = await fetch(`${ELDORADO_API_BASE}/api/predefinedOffers/${offerId}/private`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        
        if (!getResponse.ok) {
            throw new Error('Failed to get offer');
        }
        
        const offer = await getResponse.json();
        const currentPrice = offer.price || 0;
        const change = parseFloat(priceChange);
        const newPrice = Math.max(0.01, currentPrice + change);
        
        // Update price
        const updateResponse = await fetch(`${ELDORADO_API_BASE}/api/predefinedOffersUser/me/${offerId}/changePrice`, {
            method: 'PUT',
            headers: {
                'Authorization': `Api-Key ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ price: newPrice })
        });
        
        if (!updateResponse.ok) {
            throw new Error('Failed to update price');
        }
        
        await bot.editMessageText(
            `${ICONS.check} Price updated!\n\n$${currentPrice.toFixed(2)} → $${newPrice.toFixed(2)}`,
            { chat_id: chatId, message_id: editMessageId }
        );
        
        // Show offer details after 1 second
        setTimeout(() => sendOfferDetails(chatId, farmKey, offerId, editMessageId), 1500);
        
    } catch (e) {
        console.error('[TelegramBot] Set price error:', e.message);
        await bot.editMessageText(`${ICONS.cross} Failed to update price.`, { chat_id: chatId, message_id: editMessageId });
    }
}

/**
 * Delete offer confirmation
 */
async function deleteOffer(chatId, farmKey, offerId, editMessageId) {
    const text = `
${ICONS.delete} <b>Delete Offer?</b>

Are you sure you want to delete this offer?
This action cannot be undone.
`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: `${ICONS.check} Yes, Delete`, callback_data: `confirm_delete:${offerId}` },
                { text: `${ICONS.cross} Cancel`, callback_data: `offer:${offerId}` }
            ]
        ]
    };
    
    await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: editMessageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
    });
}

/**
 * Confirm and execute offer deletion
 */
async function confirmDeleteOffer(chatId, farmKey, offerId, editMessageId) {
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farmKey);
        if (!apiKey) {
            await bot.editMessageText(`${ICONS.cross} API key not found.`, { chat_id: chatId, message_id: editMessageId });
            return;
        }
        
        const response = await fetch(`${ELDORADO_API_BASE}/api/predefinedOffersUser/me/${offerId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete offer');
        }
        
        await bot.editMessageText(`${ICONS.check} Offer deleted successfully.`, { chat_id: chatId, message_id: editMessageId });
        
        // Go back to offers list
        setTimeout(() => sendOffersList(chatId, farmKey, 0, editMessageId), 1500);
        
    } catch (e) {
        console.error('[TelegramBot] Delete offer error:', e.message);
        await bot.editMessageText(`${ICONS.cross} Failed to delete offer.`, { chat_id: chatId, message_id: editMessageId });
    }
}

/**
 * Pause offer
 */
async function pauseOffer(chatId, farmKey, offerId, editMessageId) {
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farmKey);
        if (!apiKey) {
            await bot.editMessageText(`${ICONS.cross} API key not found.`, { chat_id: chatId, message_id: editMessageId });
            return;
        }
        
        const response = await fetch(`${ELDORADO_API_BASE}/api/predefinedOffersUser/me/${offerId}/pause`, {
            method: 'PUT',
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to pause offer');
        }
        
        await bot.editMessageText(`${ICONS.pause} Offer paused.`, { chat_id: chatId, message_id: editMessageId });
        setTimeout(() => sendOfferDetails(chatId, farmKey, offerId, editMessageId), 1500);
        
    } catch (e) {
        console.error('[TelegramBot] Pause offer error:', e.message);
        await bot.editMessageText(`${ICONS.cross} Failed to pause offer.`, { chat_id: chatId, message_id: editMessageId });
    }
}

/**
 * Resume offer
 */
async function resumeOffer(chatId, farmKey, offerId, editMessageId) {
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farmKey);
        if (!apiKey) {
            await bot.editMessageText(`${ICONS.cross} API key not found.`, { chat_id: chatId, message_id: editMessageId });
            return;
        }
        
        const response = await fetch(`${ELDORADO_API_BASE}/api/predefinedOffersUser/me/${offerId}/resume`, {
            method: 'PUT',
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to resume offer');
        }
        
        await bot.editMessageText(`${ICONS.play} Offer resumed.`, { chat_id: chatId, message_id: editMessageId });
        setTimeout(() => sendOfferDetails(chatId, farmKey, offerId, editMessageId), 1500);
        
    } catch (e) {
        console.error('[TelegramBot] Resume offer error:', e.message);
        await bot.editMessageText(`${ICONS.cross} Failed to resume offer.`, { chat_id: chatId, message_id: editMessageId });
    }
}

/**
 * Send collection summary
 */
async function sendCollectionSummary(chatId, farmKey, editMessageId = null) {
    try {
        const pool = await getPool();
        
        // Get brainrot summary
        const [rows] = await pool.execute(`
            SELECT 
                fb.name,
                COUNT(*) as count,
                SUM(fb.income) as total_income
            FROM farmer_brainrots fb
            JOIN farmer_accounts fa ON fb.account_id = fa.id
            JOIN farmers f ON fa.farmer_id = f.id
            WHERE f.farm_key = ?
            GROUP BY fb.name
            ORDER BY total_income DESC
            LIMIT 10
        `, [farmKey]);
        
        if (rows.length === 0) {
            const text = `${ICONS.collection} <b>Collection</b>\n\nNo brainrots found.`;
            const keyboard = {
                inline_keyboard: [[{ text: `${ICONS.back} Menu`, callback_data: 'menu' }]]
            };
            
            if (editMessageId) {
                await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, parse_mode: 'HTML', reply_markup: keyboard });
            } else {
                await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
            }
            return;
        }
        
        let text = `${ICONS.collection} <b>Top Brainrots</b>\n\n`;
        
        for (const row of rows) {
            const income = formatIncome(row.total_income);
            text += `<b>${row.name}</b> x${row.count}\n   ${ICONS.money}${income}/s\n\n`;
        }
        
        const keyboard = {
            inline_keyboard: [
                [{ text: `${ICONS.back} Menu`, callback_data: 'menu' }]
            ]
        };
        
        if (editMessageId) {
            await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, parse_mode: 'HTML', reply_markup: keyboard });
        } else {
            await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        
    } catch (e) {
        console.error('[TelegramBot] Collection error:', e.message);
    }
}

/**
 * Send recent orders
 */
async function sendRecentOrders(chatId, farmKey, editMessageId = null) {
    try {
        const apiKey = await eldoradoApi.getApiKeyForFarm(farmKey);
        if (!apiKey) {
            const text = `${ICONS.cross} API key not found.`;
            if (editMessageId) {
                await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId });
            } else {
                await bot.sendMessage(chatId, text);
            }
            return;
        }
        
        // Fetch recent orders
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
        
        if (orders.length === 0) {
            const text = `${ICONS.sale} <b>Recent Orders</b>\n\nNo orders found.`;
            const keyboard = {
                inline_keyboard: [[{ text: `${ICONS.back} Menu`, callback_data: 'menu' }]]
            };
            
            if (editMessageId) {
                await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, parse_mode: 'HTML', reply_markup: keyboard });
            } else {
                await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
            }
            return;
        }
        
        let text = `${ICONS.sale} <b>Recent Orders</b>\n\n`;
        
        for (const order of orders) {
            const price = order.totalPrice ? `$${order.totalPrice.toFixed(2)}` : 'N/A';
            const state = order.state || 'Unknown';
            text += `${ICONS.check} <b>${order.offerTitle?.substring(0, 25) || 'Order'}...</b>\n   ${price} - ${state}\n\n`;
        }
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: `${ICONS.refresh} Refresh`, callback_data: 'orders' },
                    { text: `${ICONS.back} Menu`, callback_data: 'menu' }
                ]
            ]
        };
        
        if (editMessageId) {
            await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, parse_mode: 'HTML', reply_markup: keyboard });
        } else {
            await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        
    } catch (e) {
        console.error('[TelegramBot] Orders error:', e.message);
        const text = `${ICONS.cross} Failed to load orders.`;
        if (editMessageId) {
            await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId });
        } else {
            await bot.sendMessage(chatId, text);
        }
    }
}

/**
 * Send auto-create menu
 */
async function sendAutoCreateMenu(chatId, farmKey, editMessageId = null) {
    try {
        // Import auto-create module
        const autoCreateOffers = require('./auto-create-offers');
        
        // Get brainrots without offers
        const available = await autoCreateOffers.getBrainrotsWithoutOffers(farmKey);
        
        if (available.length === 0) {
            const text = `✨ <b>Auto-Create Offers</b>\n\n${ICONS.check} All your brainrots already have offers!`;
            const keyboard = {
                inline_keyboard: [[{ text: `${ICONS.back} Menu`, callback_data: 'menu' }]]
            };
            
            if (editMessageId) {
                await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, parse_mode: 'HTML', reply_markup: keyboard });
            } else {
                await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
            }
            return;
        }
        
        // Show top 5 brainrots without offers
        let text = `✨ <b>Auto-Create Offers</b>\n\n`;
        text += `Found <b>${available.length}</b> brainrots without offers:\n\n`;
        
        const toShow = available.slice(0, 5);
        for (const b of toShow) {
            const price = await autoCreateOffers.getSuggestedPrice(b.name, b.income);
            text += `• <b>${b.name}</b>\n  ${ICONS.money}${price.toFixed(2)} suggested\n\n`;
        }
        
        if (available.length > 5) {
            text += `... and ${available.length - 5} more\n\n`;
        }
        
        text += `Create offers for all ${available.length} brainrots?`;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: `✨ Create All (${available.length})`, callback_data: 'autocreate_all' }],
                [{ text: `${ICONS.back} Menu`, callback_data: 'menu' }]
            ]
        };
        
        if (editMessageId) {
            await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, parse_mode: 'HTML', reply_markup: keyboard });
        } else {
            await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
        }
        
    } catch (e) {
        console.error('[TelegramBot] Auto-create menu error:', e.message);
        const text = `${ICONS.cross} Failed to load auto-create menu.`;
        if (editMessageId) {
            await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId });
        } else {
            await bot.sendMessage(chatId, text);
        }
    }
}

/**
 * Execute auto-create offers
 */
async function executeAutoCreate(chatId, farmKey, all = true, editMessageId = null) {
    try {
        await bot.editMessageText(`✨ Creating offers... Please wait.`, { 
            chat_id: chatId, 
            message_id: editMessageId 
        });
        
        const autoCreateOffers = require('./auto-create-offers');
        const apiKey = await eldoradoApi.getApiKeyForFarm(farmKey);
        
        if (!apiKey) {
            await bot.editMessageText(`${ICONS.cross} API key not found.`, { chat_id: chatId, message_id: editMessageId });
            return;
        }
        
        const available = await autoCreateOffers.getBrainrotsWithoutOffers(farmKey);
        
        if (available.length === 0) {
            await bot.editMessageText(`${ICONS.check} All brainrots already have offers!`, { chat_id: chatId, message_id: editMessageId });
            return;
        }
        
        let created = 0;
        let failed = 0;
        
        // Create offers one by one
        for (const brainrot of available) {
            try {
                const price = await autoCreateOffers.getSuggestedPrice(brainrot.name, brainrot.income);
                await autoCreateOffers.createOfferOnEldorado(apiKey, brainrot, price);
                created++;
                
                // Update progress every 3 items
                if (created % 3 === 0) {
                    await bot.editMessageText(
                        `✨ Creating offers... ${created}/${available.length}`, 
                        { chat_id: chatId, message_id: editMessageId }
                    ).catch(() => {});
                }
                
                // Rate limit
                await new Promise(r => setTimeout(r, 1500));
                
            } catch (e) {
                console.error(`[TelegramBot] Failed to create offer for ${brainrot.name}:`, e.message);
                failed++;
            }
        }
        
        let resultText = `✨ <b>Auto-Create Complete</b>\n\n`;
        resultText += `${ICONS.check} Created: <b>${created}</b> offers\n`;
        if (failed > 0) {
            resultText += `${ICONS.cross} Failed: <b>${failed}</b>\n`;
        }
        
        const keyboard = {
            inline_keyboard: [
                [{ text: `${ICONS.offers} View Offers`, callback_data: 'offers:0' }],
                [{ text: `${ICONS.back} Menu`, callback_data: 'menu' }]
            ]
        };
        
        await bot.editMessageText(resultText, { 
            chat_id: chatId, 
            message_id: editMessageId, 
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
        
    } catch (e) {
        console.error('[TelegramBot] Execute auto-create error:', e.message);
        await bot.editMessageText(`${ICONS.cross} Failed to create offers: ${e.message}`, { 
            chat_id: chatId, 
            message_id: editMessageId 
        });
    }
}

/**
 * Format income for display
 */
function formatIncome(income) {
    if (income >= 1000000000) {
        return (income / 1000000000).toFixed(1) + 'B';
    } else if (income >= 1000000) {
        return (income / 1000000).toFixed(1) + 'M';
    } else if (income >= 1000) {
        return (income / 1000).toFixed(1) + 'K';
    }
    return income.toString();
}

/**
 * Stop bot polling
 */
function stopBot() {
    // Stop order monitor first
    if (orderMonitor) {
        orderMonitor.stopOrderMonitor();
    }
    
    if (bot) {
        bot.stopPolling();
        bot = null;
        console.log('[TelegramBot] Bot stopped');
    }
}

module.exports = {
    initBot,
    stopBot,
    authenticateWithApiKey
};
