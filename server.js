const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const http = require('http');

// Import MySQL database connection
const { connectToDatabase } = require('./api/_lib/db');

// Обработка необработанных ошибок
process.on('uncaughtException', (err) => {
    console.error('❌ [CRITICAL] Uncaught Exception:', err.message);
    console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ [CRITICAL] Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuration
const PORT = process.env.PORT || 3001;

// Paths - support both Windows (local) and Linux (Docker/VPS)
const isDocker = process.env.NODE_ENV === 'production' || !process.env.LOCALAPPDATA;

let FARM_DATA_PATH;
let BRAINROT_IMAGES_PATH;
let BRAINROT_DATA_PATH;

if (isDocker) {
    // Docker/VPS paths
    FARM_DATA_PATH = '/app/data/farm_data';
    BRAINROT_IMAGES_PATH = '/app/data/brainrot_images';
    BRAINROT_DATA_PATH = '/app/data/brainrots.json';
} else {
    // Windows local paths
    const SELIWARE_FARM_PATH = path.join(process.env.LOCALAPPDATA, 'seliware-workspace', 'farm_data');
    const WAVE_FARM_PATH = path.join(process.env.LOCALAPPDATA, 'Wave', 'workspace', 'workspace', 'ScriptManager', 'farm');
    FARM_DATA_PATH = fs.existsSync(SELIWARE_FARM_PATH) ? SELIWARE_FARM_PATH : WAVE_FARM_PATH;
    const BRAINROT_PARSER_PATH = 'C:\\Users\\Administrator\\Downloads\\sabwikiparser';
    BRAINROT_IMAGES_PATH = path.join(BRAINROT_PARSER_PATH, 'downloaded_images');
    BRAINROT_DATA_PATH = path.join(BRAINROT_PARSER_PATH, 'brainrots.json');
}

const GENERATIONS_DATA_PATH = path.join(__dirname, 'data', 'generations.json');

// Путь к сгенерированным изображениям (локальный генератор)
const GENERATED_IMAGES_PATH = path.join(__dirname, 'generated');

// Создаём папку для сгенерированных изображений если не существует
if (!fs.existsSync(GENERATED_IMAGES_PATH)) {
    fs.mkdirSync(GENERATED_IMAGES_PATH, { recursive: true });
    console.log('Created generated images folder:', GENERATED_IMAGES_PATH);
}

// Middleware
app.use(cors());
// v9.12.71: Increase JSON body limit to 10mb (default 100kb caused 413 errors)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve brainrot images from downloaded_images folder
app.use('/brainrot-images', express.static(BRAINROT_IMAGES_PATH));

// Serve locally generated images
app.use('/generated', express.static(GENERATED_IMAGES_PATH));

// Store connected clients
const clients = new Map();

// Avatar cache to avoid repeated API calls
const avatarCache = new Map();

// ===== IN-MEMORY DATA CACHE =====
// Кэш данных аккаунтов для мгновенного ответа на /api/sync
let cachedAccountsData = null;
let cachedPanelData = null;
let cacheLastUpdate = 0;
const CACHE_TTL = 1000; // 1 секунда TTL для кэша

// Инвалидирует кэш (вызывается при изменении файлов)
function invalidateCache() {
    cachedAccountsData = null;
    cachedPanelData = null;
    cacheLastUpdate = 0;
}

// Проверяет актуальность кэша
function isCacheValid() {
    return cachedAccountsData !== null && (Date.now() - cacheLastUpdate) < CACHE_TTL;
}
// ===== END CACHE =====

// Generations storage - tracks which brainrots were generated for each user
let generationsData = {};

// Load generations data
function loadGenerationsData() {
    try {
        if (fs.existsSync(GENERATIONS_DATA_PATH)) {
            const data = fs.readFileSync(GENERATIONS_DATA_PATH, 'utf8');
            generationsData = JSON.parse(data);
            console.log(`Loaded generations data for ${Object.keys(generationsData).length} users`);
        }
    } catch (err) {
        console.error('Error loading generations data:', err);
        generationsData = {};
    }
}

// Save generations data
function saveGenerationsData() {
    try {
        const dataDir = path.dirname(GENERATIONS_DATA_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(GENERATIONS_DATA_PATH, JSON.stringify(generationsData, null, 2));
    } catch (err) {
        console.error('Error saving generations data:', err);
    }
}

// Initialize generations data
loadGenerationsData();

// Generate unique color for account based on account ID
function getAccountColor(accountId) {
    // Predefined vibrant colors for better visibility
    const colors = [
        '#FF6B6B', // Red
        '#4ECDC4', // Teal  
        '#45B7D1', // Blue
        '#96CEB4', // Green
        '#FFEAA7', // Yellow
        '#DDA0DD', // Plum
        '#98D8C8', // Mint
        '#F7DC6F', // Gold
        '#BB8FCE', // Purple
        '#85C1E9', // Sky Blue
        '#F8B500', // Amber
        '#00CED1', // Dark Cyan
        '#FF69B4', // Hot Pink
        '#7FFF00', // Chartreuse
        '#FF4500', // Orange Red
    ];
    
    // Create hash from accountId
    let hash = 0;
    const str = String(accountId);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    
    return colors[Math.abs(hash) % colors.length];
}

// Load brainrot image mapping (excluding GIFs, finding PNG alternatives)
let brainrotImageMap = {};
let availableImages = new Set();

function loadBrainrotImages() {
    try {
        // First, scan available images in the folder
        if (fs.existsSync(BRAINROT_IMAGES_PATH)) {
            const files = fs.readdirSync(BRAINROT_IMAGES_PATH);
            files.forEach(file => {
                const ext = path.extname(file).toLowerCase();
                if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
                    availableImages.add(file);
                }
            });
            console.log(`Found ${availableImages.size} non-GIF images in folder`);
        }
        
        if (fs.existsSync(BRAINROT_DATA_PATH)) {
            const data = JSON.parse(fs.readFileSync(BRAINROT_DATA_PATH, 'utf8'));
            brainrotImageMap = {};
            let replacedGifs = 0;
            
            // Handle both array format and object format
            const brainrots = Array.isArray(data) ? data : (data.brainrots || []);
            
            brainrots.forEach(b => {
                if (b.image) {
                    let imageName = b.image;
                    const ext = path.extname(imageName).toLowerCase();
                    const baseName = imageName.slice(0, -ext.length);
                    
                    // Always try to find standard image first (without _1 suffix)
                    // Priority: .png > .jpg > .webp, standard > _1 variant
                    const standardAlternatives = [
                        baseName + '.png',
                        baseName + '.jpg',
                        baseName + '.webp',
                        baseName + '_1.png',
                        baseName + '_1.jpg',
                        baseName + '_1.webp'
                    ];
                    
                    // If baseName ends with _1, also try without it first
                    if (baseName.endsWith('_1')) {
                        const cleanBase = baseName.slice(0, -2);
                        standardAlternatives.unshift(
                            cleanBase + '.png',
                            cleanBase + '.jpg',
                            cleanBase + '.webp'
                        );
                    }
                    
                    let found = false;
                    for (const alt of standardAlternatives) {
                        if (availableImages.has(alt) && !alt.toLowerCase().endsWith('.gif')) {
                            if (alt !== imageName) replacedGifs++;
                            imageName = alt;
                            found = true;
                            break;
                        }
                    }
                    
                    // If still a GIF or not found, skip
                    if (imageName.toLowerCase().endsWith('.gif') || !found) {
                        return;
                    }
                    
                    brainrotImageMap[b.name.toLowerCase()] = imageName;
                    brainrotImageMap[b.name.toLowerCase().replace(/\s+/g, '_')] = imageName;
                    brainrotImageMap[b.name.toLowerCase().replace(/\s+/g, '')] = imageName;
                }
            });
            console.log(`Loaded ${Object.keys(brainrotImageMap).length} brainrot images (replaced ${replacedGifs} with standard alternatives)`);
        }
    } catch (err) {
        console.error('Error loading brainrot images:', err);
    }
}
loadBrainrotImages();

// Get brainrot image URL
function getBrainrotImage(name) {
    if (!name) return null;
    const normalized = name.toLowerCase().trim();
    
    // Try exact match
    if (brainrotImageMap[normalized]) {
        return `/brainrot-images/${brainrotImageMap[normalized]}`;
    }
    
    // Try without spaces
    const noSpaces = normalized.replace(/\s+/g, '_');
    if (brainrotImageMap[noSpaces]) {
        return `/brainrot-images/${brainrotImageMap[noSpaces]}`;
    }
    
    // Try partial match
    for (const [key, value] of Object.entries(brainrotImageMap)) {
        if (key.includes(normalized) || normalized.includes(key)) {
            return `/brainrot-images/${value}`;
        }
    }
    
    return null;
}

// Safe JSON parse with retry for race conditions
function safeReadJSON(filePath, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            if (!fs.existsSync(filePath)) return null;
            const content = fs.readFileSync(filePath, 'utf8');
            if (!content || content.trim() === '') return null;
            return JSON.parse(content);
        } catch (err) {
            if (i < maxRetries - 1) {
                // Wait a bit and retry (file might be mid-write)
                const start = Date.now();
                while (Date.now() - start < 50) {} // 50ms busy wait
            }
        }
    }
    return null;
}

// Read panel data
function readPanelData() {
    const panelDataPath = path.join(FARM_DATA_PATH, 'panel_data.json');
    try {
        const data = safeReadJSON(panelDataPath);
        if (data) {
            // Enrich data with brainrot images
            if (data.accounts) {
                data.accounts.forEach(account => {
                    if (account.brainrots) {
                        account.brainrots.forEach(brainrot => {
                            brainrot.imageUrl = getBrainrotImage(brainrot.name);
                        });
                    }
                });
            }
            
            return data;
        }
    } catch (err) {
        // Silent - safeReadJSON handles errors
    }
    return null;
}

// Read all farmer data files
function readAllFarmerData() {
    const farmers = [];
    try {
        if (!fs.existsSync(FARM_DATA_PATH)) {
            return farmers;
        }
        
        const files = fs.readdirSync(FARM_DATA_PATH);
        files.forEach(file => {
            if (file.startsWith('brainrots_') && file.endsWith('.json')) {
                const filePath = path.join(FARM_DATA_PATH, file);
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const data = JSON.parse(content);
                    
                    // Enrich brainrots with images
                    if (data.brainrots) {
                        data.brainrots.forEach(brainrot => {
                            brainrot.imageUrl = getBrainrotImage(brainrot.name);
                        });
                    }
                    
                    farmers.push(data);
                } catch (err) {
                    console.error(`Error reading ${file}:`, err);
                }
            }
        });
    } catch (err) {
        console.error('Error reading farmer data:', err);
    }
    return farmers;
}

// Import scan-offers and offers API functions
const scanOffersHandler = require('./api/scan-offers');
const offersHandler = require('./api/offers');
const offersFastHandler = require('./api/offers-fast');  // v10.3.25: Add missing import
const eldoradoPriceHandler = require('./api/eldorado-price');
const aiPriceHandler = require('./api/ai-price');
const syncFastHandler = require('./api/sync-fast');
const syncHandler = require('./api/sync');
const topHandler = require('./api/top');
const pricesHandler = require('./api/prices');
const pricesCacheHandler = require('./api/prices-cache');
const shopNameHandler = require('./api/shop-name');
const balanceHistoryHandler = require('./api/balance-history');
const balanceHistoryV2Handler = require('./api/balance-history-v2');
const generationsHandler = require('./api/generations');
const offerCodesHandler = require('./api/offer-codes');
const adjustmentQueueHandler = require('./api/adjustment-queue');
const deleteQueueHandler = require('./api/delete-queue');
const queueHandler = require('./api/queue');
const validateHandler = require('./api/validate');
const userColorHandler = require('./api/user-color');
const accountColorsHandler = require('./api/account-colors');
const supaGenerateHandler = require('./api/supa-generate');
const supaStatusHandler = require('./api/supa-status');
const localGenerateHandler = require('./api/local-generate');
const eldoradoListHandler = require('./api/eldorado-list');
const heartbeatHandler = require('./api/heartbeat');
const deleteFarmerHandler = require('./api/delete-farmer');
const eldoradoApiHandler = require('./api/eldorado-api');
const telegramBot = require('./api/telegram-bot');

// API Routes

// Heartbeat - updates user last_seen_at for inactive user price updates
app.post('/api/heartbeat', async (req, res) => {
    await heartbeatHandler(req, res);
});

// Sync-fast endpoint - fast cached sync for frontend polling
app.get('/api/sync-fast', async (req, res) => {
    await syncFastHandler(req, res);
});

// Sync POST endpoint - receives data from panel_sync.lua
app.post('/api/sync', async (req, res) => {
    await syncHandler(req, res);
});

// Delete farmer endpoint
app.delete('/api/delete-farmer', async (req, res) => {
    await deleteFarmerHandler(req, res);
});

// Top leaderboards endpoint
app.get('/api/top', async (req, res) => {
    await topHandler(req, res);
});

// Prices endpoints
app.get('/api/prices', async (req, res) => {
    await pricesHandler(req, res);
});

app.post('/api/prices', async (req, res) => {
    await pricesHandler(req, res);
});

// Prices cache endpoint (for incremental updates)
app.get('/api/prices-cache', async (req, res) => {
    await pricesCacheHandler(req, res);
});

// Shop name endpoint
app.get('/api/shop-name', async (req, res) => {
    await shopNameHandler(req, res);
});

app.post('/api/shop-name', async (req, res) => {
    await shopNameHandler(req, res);
});

// Balance history endpoint
app.get('/api/balance-history', async (req, res) => {
    await balanceHistoryHandler(req, res);
});

app.post('/api/balance-history', async (req, res) => {
    await balanceHistoryHandler(req, res);
});

// Balance history v2 endpoint (uses separate handler with aggregation)
app.get('/api/balance-history-v2', async (req, res) => {
    await balanceHistoryV2Handler(req, res);
});

app.post('/api/balance-history-v2', async (req, res) => {
    await balanceHistoryV2Handler(req, res);
});

// Offer codes endpoint
app.get('/api/offer-codes', async (req, res) => {
    await offerCodesHandler(req, res);
});

app.post('/api/offer-codes', async (req, res) => {
    await offerCodesHandler(req, res);
});

// Adjustment queue endpoint
app.get('/api/adjustment-queue', async (req, res) => {
    await adjustmentQueueHandler(req, res);
});

app.post('/api/adjustment-queue', async (req, res) => {
    await adjustmentQueueHandler(req, res);
});

app.delete('/api/adjustment-queue', async (req, res) => {
    await adjustmentQueueHandler(req, res);
});

// Delete queue endpoint
app.get('/api/delete-queue', async (req, res) => {
    await deleteQueueHandler(req, res);
});

app.post('/api/delete-queue', async (req, res) => {
    await deleteQueueHandler(req, res);
});

app.delete('/api/delete-queue', async (req, res) => {
    await deleteQueueHandler(req, res);
});

// Queue endpoint
app.get('/api/queue', async (req, res) => {
    await queueHandler(req, res);
});

app.post('/api/queue', async (req, res) => {
    await queueHandler(req, res);
});

app.delete('/api/queue', async (req, res) => {
    await queueHandler(req, res);
});

// User color endpoint
app.get('/api/user-color', async (req, res) => {
    await userColorHandler(req, res);
});

app.post('/api/user-color', async (req, res) => {
    await userColorHandler(req, res);
});

// Account colors endpoint
app.get('/api/account-colors', async (req, res) => {
    await accountColorsHandler(req, res);
});

// Supa Generate endpoint - generates offer images via Supa.ru API (or local generator if enabled)
app.post('/api/supa-generate', async (req, res) => {
    await supaGenerateHandler(req, res);
});

// Supa status endpoint - check generation status
app.get('/api/supa-status', async (req, res) => {
    await supaStatusHandler(req, res);
});

// Local Generate endpoint - direct access to local image generator
app.post('/api/local-generate', async (req, res) => {
    await localGenerateHandler(req, res);
});

// Eldorado price endpoint - get optimal price for brainrot
app.get('/api/eldorado-price', async (req, res) => {
    await eldoradoPriceHandler(req, res);
});

// Eldorado brainrots list endpoint - cached list for link generation
app.get('/api/eldorado-list', async (req, res) => {
    await eldoradoListHandler(req, res);
});

// Eldorado API key management endpoints
app.post('/api/eldorado-api/validate', async (req, res) => {
    await eldoradoApiHandler.handleValidate(req, res);
});

app.post('/api/eldorado-api/save', async (req, res) => {
    await eldoradoApiHandler.handleSave(req, res);
});

app.get('/api/eldorado-api/status', async (req, res) => {
    await eldoradoApiHandler.handleStatus(req, res);
});

app.delete('/api/eldorado-api/reset', async (req, res) => {
    await eldoradoApiHandler.handleReset(req, res);
});

// Offers API - Direct Eldorado API access for users with API keys
const offersApiHandler = require('./api/offers-api');

app.get('/api/offers-api/list', async (req, res) => {
    await offersApiHandler.handleGetOffers(req, res);
});

app.get('/api/offers-api/orders', async (req, res) => {
    await offersApiHandler.handleGetOrders(req, res);
});

app.get('/api/offers-api/new-orders', async (req, res) => {
    await offersApiHandler.handleCheckNewOrders(req, res);
});

app.get('/api/offers-api/offer/:offerId', async (req, res) => {
    await offersApiHandler.handleGetOffer(req, res);
});

app.post('/api/offers-api/offer', async (req, res) => {
    await offersApiHandler.handleCreateOffer(req, res);
});

app.put('/api/offers-api/offer/:offerId/price', async (req, res) => {
    await offersApiHandler.handleUpdatePrice(req, res);
});

app.put('/api/offers-api/offer/:offerId/pause', async (req, res) => {
    await offersApiHandler.handlePauseOffer(req, res);
});

app.put('/api/offers-api/offer/:offerId/resume', async (req, res) => {
    await offersApiHandler.handleResumeOffer(req, res);
});

app.delete('/api/offers-api/offer/:offerId', async (req, res) => {
    await offersApiHandler.handleDeleteOffer(req, res);
});

// Auto-create offers API - creates offers for brainrots that don't have offers yet
const autoCreateHandler = require('./api/auto-create-offers');

app.get('/api/auto-create-offers/available', async (req, res) => {
    await autoCreateHandler.handleGetAvailable(req, res);
});

app.post('/api/auto-create-offers', async (req, res) => {
    await autoCreateHandler.handleAutoCreate(req, res);
});

// AI price endpoint - AI-first pricing with regex fallback
app.get('/api/ai-price', async (req, res) => {
    await aiPriceHandler(req, res);
});

// Scan offers endpoint - finds user's offers on Eldorado by their codes
app.get('/api/scan-offers', async (req, res) => {
    req.method = 'GET';
    await scanOffersHandler(req, res);
});

// v10.3.25: Add offers-fast endpoint - returns pre-scanned offers from DB (INSTANT)
app.get('/api/offers-fast', async (req, res) => {
    await offersFastHandler(req, res);
});

// Offers endpoint - CRUD for user offers
app.get('/api/offers', async (req, res) => {
    req.method = 'GET';
    await offersHandler(req, res);
});

app.post('/api/offers', async (req, res) => {
    req.method = 'POST';
    await offersHandler(req, res);
});

app.put('/api/offers', async (req, res) => {
    req.method = 'PUT';
    await offersHandler(req, res);
});

app.delete('/api/offers', async (req, res) => {
    req.method = 'DELETE';
    await offersHandler(req, res);
});

app.get('/api/panel-data', (req, res) => {
    const data = readPanelData();
    if (data) {
        res.json(data);
    } else {
        res.json({
            farmKey: null,
            accounts: [],
            totalGlobalIncome: 0,
            message: 'No panel data found. Start the farm script first.'
        });
    }
});

app.get('/api/farmers', async (req, res) => {
    try {
        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');
        const farmers = await farmersCollection.find({}).toArray();
        
        // Enrich brainrots with images
        farmers.forEach(farmer => {
            if (farmer.brainrots) {
                farmer.brainrots.forEach(brainrot => {
                    brainrot.imageUrl = getBrainrotImage(brainrot.name);
                });
            }
        });
        
        res.json(farmers);
    } catch (err) {
        console.error('Error reading farmers from MySQL:', err);
        res.json([]);
    }
});

app.get('/api/avatar/:userId', async (req, res) => {
    const { userId } = req.params;
    
    // Check cache first
    if (avatarCache.has(userId)) {
        return res.json({ imageUrl: avatarCache.get(userId) });
    }
    
    try {
        // Use Roblox thumbnails API
        const response = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
        const data = await response.json();
        if (data.data && data.data[0] && data.data[0].imageUrl) {
            const imageUrl = data.data[0].imageUrl;
            avatarCache.set(userId, imageUrl);
            res.json({ imageUrl });
        } else {
            res.json({ imageUrl: null });
        }
    } catch (err) {
        console.error('Avatar fetch error:', err);
        res.json({ imageUrl: null });
    }
});

app.get('/api/brainrot-image/:name', (req, res) => {
    const imageUrl = getBrainrotImage(req.params.name);
    res.json({ imageUrl });
});

// Get account border color
app.get('/api/account-color/:accountId', (req, res) => {
    const color = getAccountColor(req.params.accountId);
    res.json({ color });
});

// Get all account colors for current panel
app.get('/api/account-colors', (req, res) => {
    const data = readPanelData();
    if (!data || !data.accounts) {
        return res.json({ colors: {} });
    }
    
    const colors = {};
    data.accounts.forEach(account => {
        colors[account.userId] = getAccountColor(account.userId);
    });
    res.json({ colors });
});

// Get generations for a specific user (farm key) - MySQL version (query param)
app.get('/api/generations', async (req, res) => {
    const farmKey = req.query.farmKey;
    if (!farmKey) {
        return res.status(400).json({ error: 'farmKey is required' });
    }
    try {
        const { db } = await connectToDatabase();
        const generationsCollection = db.collection('generations');
        const generations = await generationsCollection.find({ farmKey }).toArray();
        
        // Convert array to object keyed by brainrotName
        const userGenerations = {};
        for (const gen of generations) {
            // v9.12.85: Guard against undefined brainrotName
            if (!gen.brainrotName) continue;
            userGenerations[gen.brainrotName.toLowerCase()] = {
                name: gen.brainrotName,
                accountId: gen.accountId,
                resultUrl: gen.resultUrl,
                generatedAt: gen.generatedAt,
                count: gen.count || 1
            };
        }
        
        res.json({ generations: userGenerations });
    } catch (err) {
        console.error('Error loading generations:', err);
        res.json({ generations: {} });
    }
});

// Get generations for a specific user (farm key) - MySQL version (path param)
app.get('/api/generations/:farmKey', async (req, res) => {
    const { farmKey } = req.params;
    try {
        const { db } = await connectToDatabase();
        const generationsCollection = db.collection('generations');
        const generations = await generationsCollection.find({ farmKey }).toArray();
        
        // Convert array to object keyed by brainrotName
        const userGenerations = {};
        for (const gen of generations) {
            // v9.12.85: Guard against undefined brainrotName
            if (!gen.brainrotName) continue;
            userGenerations[gen.brainrotName.toLowerCase()] = {
                name: gen.brainrotName,
                accountId: gen.accountId,
                resultUrl: gen.resultUrl,
                generatedAt: gen.generatedAt,
                count: gen.count || 1
            };
        }
        
        res.json({ generations: userGenerations });
    } catch (err) {
        console.error('Error loading generations:', err);
        res.json({ generations: {} });
    }
});

// Record a generation - MySQL version
app.post('/api/generations', async (req, res) => {
    const { farmKey, brainrotName, accountId, resultUrl, timestamp } = req.body;
    
    if (!farmKey || !brainrotName) {
        return res.status(400).json({ error: 'farmKey and brainrotName are required' });
    }
    
    try {
        const { db } = await connectToDatabase();
        const generationsCollection = db.collection('generations');
        const brainrotKey = brainrotName.toLowerCase().trim();
        
        // Check if generation exists
        const existing = await generationsCollection.findOne({ farmKey, brainrotName: brainrotKey });
        
        const generationData = {
            farmKey,
            brainrotName: brainrotKey,
            displayName: brainrotName,
            accountId: accountId || null,
            resultUrl: resultUrl || null,
            generatedAt: timestamp || new Date().toISOString(),
            count: (existing?.count || 0) + 1
        };
        
        await generationsCollection.updateOne(
            { farmKey, brainrotName: brainrotKey },
            { $set: generationData },
            { upsert: true }
        );
        
        res.json({ 
            success: true, 
            generation: generationData 
        });
    } catch (err) {
        console.error('Error saving generation:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete a generation record - MySQL version
app.delete('/api/generations/:farmKey/:brainrotName', async (req, res) => {
    const { farmKey, brainrotName } = req.params;
    const brainrotKey = brainrotName.toLowerCase().trim();
    
    try {
        const { db } = await connectToDatabase();
        const generationsCollection = db.collection('generations');
        
        const result = await generationsCollection.deleteOne({ farmKey, brainrotName: brainrotKey });
        
        if (result.deletedCount > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Generation not found' });
        }
    } catch (err) {
        console.error('Error deleting generation:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Check if account is online based on lastUpdate timestamp
// Account is online if lastUpdate is within last 180 seconds (3 minutes)
function isAccountOnlineByLastUpdate(lastUpdate) {
    if (!lastUpdate) return false;
    
    try {
        // Parse "2025-12-21 13:07:43" format as local time
        const parts = lastUpdate.split(/[- :]/);
        if (parts.length >= 6) {
            const lastUpdateTime = new Date(
                parseInt(parts[0]), 
                parseInt(parts[1]) - 1, 
                parseInt(parts[2]),
                parseInt(parts[3]),
                parseInt(parts[4]),
                parseInt(parts[5])
            ).getTime();
            
            const now = Date.now();
            const diffSeconds = (now - lastUpdateTime) / 1000;
            
            // Online if updated within last 180 seconds (3 minutes)
            return diffSeconds <= 180;
        }
    } catch (e) {
        console.error('Error parsing lastUpdate:', e);
    }
    return false;
}

// Merge all brainrot files into a single accounts array
// Each brainrots_*.json contains data for one account
// Uses in-memory cache for performance
function mergeAllAccountsData(forceRefresh = false) {
    // Return cached data if valid
    if (!forceRefresh && isCacheValid()) {
        // Still need to recalculate isOnline since it's time-based
        return cachedAccountsData.map(acc => ({
            ...acc,
            isOnline: isAccountOnlineByLastUpdate(acc.lastUpdate),
            status: isAccountOnlineByLastUpdate(acc.lastUpdate) ? acc._cachedStatus : 'offline',
            action: isAccountOnlineByLastUpdate(acc.lastUpdate) ? acc._cachedAction : ''
        }));
    }
    const accountsMap = new Map();
    
    try {
        if (!fs.existsSync(FARM_DATA_PATH)) {
            return [];
        }
        
        const files = fs.readdirSync(FARM_DATA_PATH);
        
        // First, read panel_data.json for action/status info (but NOT isOnline - that's based on lastUpdate)
        const panelData = readPanelData();
        const panelAccountsStatus = new Map();
        if (panelData && panelData.accounts) {
            panelData.accounts.forEach(acc => {
                panelAccountsStatus.set(acc.playerName, {
                    status: acc.status,
                    action: acc.action,
                    userId: acc.userId,
                    farmEnabled: acc.farmEnabled
                });
            });
        }
        
        // Read all brainrots_*.json files
        files.forEach(file => {
            if (file.startsWith('brainrots_') && file.endsWith('.json')) {
                const filePath = path.join(FARM_DATA_PATH, file);
                const data = safeReadJSON(filePath);
                
                if (!data || !data.playerName) return;
                
                // Enrich brainrots with images
                if (data.brainrots) {
                    data.brainrots.forEach(brainrot => {
                        brainrot.imageUrl = getBrainrotImage(brainrot.name);
                    });
                }
                    
                    // Get status from panel_data if available (for action text)
                    const panelStatus = panelAccountsStatus.get(data.playerName) || {};
                    
                    // CRITICAL: Determine isOnline by lastUpdate, not by panel_data flag
                    const isOnline = isAccountOnlineByLastUpdate(data.lastUpdate);
                    
                    // Create account entry with cached status for later use
                    accountsMap.set(data.playerName, {
                        playerName: data.playerName,
                        lastUpdate: data.lastUpdate,
                        totalBrainrots: data.totalBrainrots || (data.brainrots?.length || 0),
                        maxSlots: data.maxSlots || 10,
                        totalIncome: data.totalIncome || 0,
                        totalIncomeFormatted: data.totalIncomeFormatted || '0/s',
                        brainrots: data.brainrots || [],
                        isOnline: isOnline,
                        status: isOnline ? (panelStatus.status || 'idle') : 'offline',
                        action: isOnline ? (panelStatus.action || '') : '',
                        userId: panelStatus.userId || data.userId || null,
                        farmEnabled: panelStatus.farmEnabled ?? false,
                        // Store original values for cache reuse
                        _cachedStatus: panelStatus.status || 'idle',
                        _cachedAction: panelStatus.action || ''
                    });
            }
        });
    } catch (err) {
        console.error('Error merging account data:', err);
    }
    
    // Convert to array and sort by income (descending)
    const result = Array.from(accountsMap.values())
        .sort((a, b) => (b.totalIncome || 0) - (a.totalIncome || 0));
    
    // Update cache
    cachedAccountsData = result;
    cacheLastUpdate = Date.now();
    
    return result;
}

// Fast status-only endpoint - lightweight for quick updates
// v9.12.74: Fixed to use MySQL instead of local files
app.get('/api/status', async (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Content-Type': 'application/json'
    });
    
    const { key } = req.query;
    if (!key) {
        return res.status(400).json({ error: 'Farm key required' });
    }
    
    try {
        // Get farmer from MySQL database
        const { db } = await connectToDatabase();
        const farmer = await db.collection('farmers').findOne({ farmKey: key });
        
        if (!farmer) {
            return res.status(404).json({ error: 'Farm not found' });
        }
        
        // Calculate isOnline on server based on lastUpdate
        const now = Date.now();
        const ONLINE_THRESHOLD = 180 * 1000; // 3 minutes
        
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
                status: acc.status || 'idle',
                action: acc.action || '',
                totalIncome: totalIncome,
                totalIncomeFormatted: totalIncomeFormatted,
                totalBrainrots: brainrots.length,
                maxSlots: acc.maxSlots || 10,
                brainrots: brainrots
            };
        });
        
        res.json({
            timestamp: Date.now(),
            accounts: accounts
        });
        
    } catch (error) {
        console.error('Status endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sync endpoint - returns current panel data from MySQL
app.get('/api/sync', async (req, res) => {
    // Disable caching - always return fresh data
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    
    const { key } = req.query;
    
    if (!key) {
        return res.status(401).json({ error: 'Key required' });
    }
    
    try {
        // Check MySQL database for the farmKey
        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');
        const farmer = await farmersCollection.findOne({ farmKey: key });
        
        if (farmer) {
            const rawAccounts = farmer.accounts || [];
            const now = Date.now();
            const ONLINE_THRESHOLD = 180 * 1000; // 3 minutes
            
            // Process accounts to add calculated fields
            const accounts = rawAccounts.map(acc => {
                // Calculate isOnline from lastUpdate
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
                    totalIncome: totalIncome,
                    totalIncomeFormatted: totalIncomeFormatted,
                    totalBrainrots: brainrots.length,
                    maxSlots: acc.maxSlots || 10,
                    brainrots: brainrots
                };
            });
            
            const totalGlobalIncome = accounts.reduce((sum, acc) => sum + (acc.totalIncome || 0), 0);
            
            res.json({
                username: farmer.username || 'Farmer',
                avatar: farmer.avatar || { icon: 'fa-seedling', color: '#4ade80' },
                accounts: accounts,
                totalGlobalIncome: totalGlobalIncome,
                // v9.12.78: Add totalValue from database (calculated by frontend and saved)
                totalValue: parseFloat(farmer.totalValue) || 0,
                valueUpdatedAt: farmer.valueUpdatedAt || null
            });
        } else {
            res.status(401).json({ error: 'Invalid key' });
        }
    } catch (err) {
        console.error('Error in /api/sync:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Validate farm key (for client compatibility)
app.post('/api/validate', async (req, res) => {
    const { farmKey } = req.body;
    
    if (!farmKey) {
        return res.status(400).json({ error: 'Farm key is required' });
    }
    
    try {
        // Check MySQL database for the farmKey
        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');
        const farmer = await farmersCollection.findOne({ farmKey: farmKey });
        
        if (farmer) {
            res.json({ 
                valid: true, 
                username: farmer.username || 'Farmer',
                avatar: farmer.avatar || { icon: 'fa-seedling', color: '#4ade80' }
            });
        } else {
            res.status(401).json({ error: 'Invalid Farm Key. Key not found in database.' });
        }
    } catch (err) {
        console.error('Error validating farm key:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Validate farm key (legacy endpoint)
app.post('/api/validate-key', async (req, res) => {
    const { key } = req.body;
    
    if (!key) {
        return res.json({ valid: false, message: 'Farm key required' });
    }
    
    try {
        // Check MySQL database for the farmKey
        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');
        const farmer = await farmersCollection.findOne({ farmKey: key });
        
        if (farmer) {
            res.json({ valid: true, data: farmer });
        } else {
            res.json({ valid: false, message: 'Invalid Farm Key. Key not found in database.' });
        }
    } catch (err) {
        console.error('Error validating farm key:', err);
        res.json({ valid: false, message: 'Database error' });
    }
});

// Delete farmer endpoint - removes farmer account from MySQL
app.delete('/api/farmer/:playerName', async (req, res) => {
    const { playerName } = req.params;
    const { key } = req.query;
    
    if (!key) {
        return res.status(400).json({ error: 'Farm key required' });
    }
    
    if (!playerName) {
        return res.status(400).json({ error: 'Player name required' });
    }
    
    try {
        // Check MySQL database for the farmKey
        const { db } = await connectToDatabase();
        const farmersCollection = db.collection('farmers');
        const farmer = await farmersCollection.findOne({ farmKey: key });
        
        if (!farmer) {
            return res.status(401).json({ error: 'Invalid key' });
        }
        
        // Remove account from farmer's accounts array
        const updatedAccounts = (farmer.accounts || []).filter(acc => acc.playerName !== playerName);
        
        if (updatedAccounts.length === (farmer.accounts || []).length) {
            return res.status(404).json({ error: `Farmer ${playerName} not found` });
        }
        
        // Update farmer in database
        await farmersCollection.updateOne(
            { farmKey: key },
            { $set: { accounts: updatedAccounts, lastUpdate: new Date() } }
        );
        
        console.log(`Deleted farmer account: ${playerName}`);
        res.json({ success: true, message: `Farmer ${playerName} deleted successfully` });
    } catch (err) {
        console.error('Error deleting farmer:', err);
        res.status(500).json({ error: 'Failed to delete farmer' });
    }
});

// WebSocket handling
wss.on('connection', (ws) => {
    const clientId = Date.now().toString();
    clients.set(clientId, ws);
    console.log(`Client connected: ${clientId}`);
    
    // Send initial data
    const data = readPanelData();
    if (data) {
        ws.send(JSON.stringify({ type: 'initial', data }));
    }
    
    ws.on('close', () => {
        clients.delete(clientId);
        console.log(`Client disconnected: ${clientId}`);
    });
});

// Broadcast updates to all connected clients
function broadcastUpdate(data) {
    clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'update', data }));
        }
    });
}

// Watch for file changes
if (fs.existsSync(FARM_DATA_PATH)) {
    const watcher = chokidar.watch(FARM_DATA_PATH, {
        persistent: true,
        ignoreInitial: true
    });
    
    watcher.on('change', (filePath) => {
        console.log(`File changed: ${filePath}`);
        
        // Invalidate cache on any brainrot or panel data change
        if (filePath.includes('panel_data.json') || filePath.includes('brainrots_')) {
            invalidateCache();
            
            setTimeout(() => {
                const data = readPanelData();
                if (data) {
                    broadcastUpdate(data);
                }
            }, 100);
        }
    });
    
    // Also watch for new/deleted files
    watcher.on('add', (filePath) => {
        if (filePath.includes('brainrots_')) {
            console.log(`New brainrot file: ${filePath}`);
            invalidateCache();
        }
    });
    
    watcher.on('unlink', (filePath) => {
        if (filePath.includes('brainrots_')) {
            console.log(`Removed brainrot file: ${filePath}`);
            invalidateCache();
        }
    });
    
    console.log(`Watching for changes in: ${FARM_DATA_PATH}`);
}

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== ELDORADO LISTS AUTO-UPDATE =====
const { updateEldoradoLists } = require('./api/ai-scanner');
const ELDORADO_UPDATE_INTERVAL = 30 * 60 * 1000; // 30 минут

async function runEldoradoUpdate() {
    console.log(`🔄 Auto-updating Eldorado brainrot lists...`);
    try {
        const result = await updateEldoradoLists();
        if (result) {
            console.log(`✅ Eldorado lists updated: ${result.brainrots?.length || 0} brainrots`);
        }
    } catch (err) {
        console.error('❌ Failed to update Eldorado lists:', err.message);
    }
}

// Запускаем периодическое обновление
setInterval(runEldoradoUpdate, ELDORADO_UPDATE_INTERVAL);

// ===== CRON PRICE SCANNER (replaces Vercel Cron) =====
const cronPriceScanner = require('./api/cron-price-scanner');
const PRICE_SCAN_INTERVAL = 60 * 1000; // Каждую минуту (как было в Vercel)
const PRICE_SCAN_TIMEOUT = 55 * 1000;  // v3.0.52: Hard timeout 55s (must complete before next cron)
let priceScancronRunning = false;

async function runPriceScanCron() {
    if (priceScancronRunning) {
        console.log('⏳ Price scan already running, skipping...');
        return;
    }
    
    priceScancronRunning = true;
    console.log(`\n🔍 [CRON] Starting price scan...`);
    
    try {
        // Создаем mock req/res для совместимости с Vercel API
        const mockReq = { 
            method: 'GET',
            headers: { 
                'user-agent': 'VPS-Cron/1.0',
                'x-vercel-cron': '1'  // Имитируем Vercel Cron
            }
        };
        const mockRes = {
            statusCode: 200,
            _data: null,
            _headers: {},
            setHeader: function(name, value) { this._headers[name] = value; return this; },
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { this._data = data; return this; },
            end: function() { return this; }
        };
        
        // v3.0.52: Race with timeout to prevent scanner from hanging forever
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('CRON_TIMEOUT_55S')), PRICE_SCAN_TIMEOUT);
        });
        
        await Promise.race([
            cronPriceScanner(mockReq, mockRes),
            timeoutPromise
        ]);
        
        if (mockRes._data) {
            const data = mockRes._data;
            console.log(`✅ [CRON] Price scan completed: ${data.scanned || 0} prices, ${data.offersScanned || 0} offers`);
        }
    } catch (err) {
        if (err.message === 'CRON_TIMEOUT_55S') {
            console.error('⏰ [CRON] Price scan TIMED OUT after 55s - forcing reset');
        } else {
            console.error('❌ [CRON] Price scan failed:', err.message);
        }
    } finally {
        priceScancronRunning = false;
    }
}

// Запускаем cron сканер каждую минуту
setInterval(runPriceScanCron, PRICE_SCAN_INTERVAL);

server.listen(PORT, async () => {
    console.log(`\n========================================`);
    console.log(`  Farmer Panel Server Started`);
    console.log(`========================================`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Farm data path: ${FARM_DATA_PATH}`);
    console.log(`  Brainrot images: ${BRAINROT_IMAGES_PATH}`);
    console.log(`  Eldorado lists auto-update: every 30 min`);
    console.log(`  Price scanner cron: every 1 min`);
    console.log(`========================================\n`);
    
    // Initialize Eldorado API tables (auto-create if not exist)
    try {
        const { getPool } = require('./api/_lib/db');
        const pool = await getPool();
        
        // Create eldorado_api_keys table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS eldorado_api_keys (
                id INT AUTO_INCREMENT PRIMARY KEY,
                farm_key VARCHAR(30) NOT NULL UNIQUE,
                api_key_encrypted TEXT NOT NULL,
                api_key_hash VARCHAR(64) NOT NULL,
                seller_name VARCHAR(100),
                seller_id VARCHAR(50),
                telegram_user_id BIGINT,
                telegram_username VARCHAR(100),
                telegram_verified BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_used_at TIMESTAMP NULL,
                INDEX idx_farm_key (farm_key),
                INDEX idx_api_key_hash (api_key_hash),
                INDEX idx_telegram_user_id (telegram_user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // Create telegram_bot_sessions table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS telegram_bot_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                telegram_user_id BIGINT NOT NULL UNIQUE,
                telegram_username VARCHAR(100),
                farm_key VARCHAR(30),
                is_authenticated BOOLEAN DEFAULT FALSE,
                session_state VARCHAR(50) DEFAULT 'idle',
                session_data JSON,
                last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_telegram_user_id (telegram_user_id),
                INDEX idx_farm_key (farm_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // Create eldorado_orders_cache table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS eldorado_orders_cache (
                id INT AUTO_INCREMENT PRIMARY KEY,
                farm_key VARCHAR(30) NOT NULL UNIQUE,
                last_order_id VARCHAR(50),
                last_check_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_farm_key (farm_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        console.log(`  Eldorado API tables: Ready`);
    } catch (e) {
        console.error(`  Eldorado API tables: ${e.message}`);
    }
    
    // Initialize Telegram Bot - DISABLED (409 Conflict with other instance)
    // To re-enable: uncomment the block below
    /*
    try {
        telegramBot.initBot();
        console.log(`  Telegram Bot: Running`);
    } catch (e) {
        console.error(`  Telegram Bot: Failed - ${e.message}`);
    }
    */
    console.log(`  Telegram Bot: DISABLED (enable in server.js)`);
    
    // Обновляем списки при старте сервера
    setTimeout(() => runEldoradoUpdate(), 5000);
    
    // Первый запуск cron сканера через 15 секунд после старта
    setTimeout(() => runPriceScanCron(), 15000);
});
