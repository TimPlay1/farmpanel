const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const http = require('http');

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
const PORT = 3001;
// Try seliware-workspace first, then Wave workspace
const SELIWARE_FARM_PATH = path.join(process.env.LOCALAPPDATA, 'seliware-workspace', 'farm_data');
const WAVE_FARM_PATH = path.join(process.env.LOCALAPPDATA, 'Wave', 'workspace', 'workspace', 'ScriptManager', 'farm');
const FARM_DATA_PATH = fs.existsSync(SELIWARE_FARM_PATH) ? SELIWARE_FARM_PATH : WAVE_FARM_PATH;
const BRAINROT_PARSER_PATH = 'C:\\Users\\Administrator\\Downloads\\sabwikiparser';
const BRAINROT_IMAGES_PATH = path.join(BRAINROT_PARSER_PATH, 'downloaded_images');
const BRAINROT_DATA_PATH = path.join(BRAINROT_PARSER_PATH, 'brainrots.json');
const GENERATIONS_DATA_PATH = path.join(__dirname, 'data', 'generations.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve brainrot images from downloaded_images folder
app.use('/brainrot-images', express.static(BRAINROT_IMAGES_PATH));

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
const eldoradoPriceHandler = require('./api/eldorado-price');
const aiPriceHandler = require('./api/ai-price');

// API Routes

// Eldorado price endpoint - get optimal price for brainrot
app.get('/api/eldorado-price', async (req, res) => {
    await eldoradoPriceHandler(req, res);
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

app.get('/api/farmers', (req, res) => {
    const farmers = readAllFarmerData();
    res.json(farmers);
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

// Get generations for a specific user (farm key)
app.get('/api/generations/:farmKey', (req, res) => {
    const { farmKey } = req.params;
    const userGenerations = generationsData[farmKey] || {};
    res.json({ generations: userGenerations });
});

// Record a generation
app.post('/api/generations', (req, res) => {
    const { farmKey, brainrotName, accountId, resultUrl, timestamp } = req.body;
    
    if (!farmKey || !brainrotName) {
        return res.status(400).json({ error: 'farmKey and brainrotName are required' });
    }
    
    // Initialize user data if not exists
    if (!generationsData[farmKey]) {
        generationsData[farmKey] = {};
    }
    
    // Create unique key for brainrot (lowercase name)
    const brainrotKey = brainrotName.toLowerCase().trim();
    
    // Store generation with metadata
    generationsData[farmKey][brainrotKey] = {
        name: brainrotName,
        accountId: accountId || null,
        resultUrl: resultUrl || null,
        generatedAt: timestamp || new Date().toISOString(),
        count: (generationsData[farmKey][brainrotKey]?.count || 0) + 1
    };
    
    // Save to file
    saveGenerationsData();
    
    res.json({ 
        success: true, 
        generation: generationsData[farmKey][brainrotKey] 
    });
});

// Delete a generation record
app.delete('/api/generations/:farmKey/:brainrotName', (req, res) => {
    const { farmKey, brainrotName } = req.params;
    const brainrotKey = brainrotName.toLowerCase().trim();
    
    if (generationsData[farmKey] && generationsData[farmKey][brainrotKey]) {
        delete generationsData[farmKey][brainrotKey];
        saveGenerationsData();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Generation not found' });
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
app.get('/api/status', (req, res) => {
    res.set({
        'Cache-Control': 'public, max-age=1',
        'Content-Type': 'application/json'
    });
    
    const { key } = req.query;
    if (!key) {
        return res.status(400).json({ error: 'Farm key required' });
    }
    
    // Read the key from file
    let storedKey = null;
    const keyFilePath = path.join(FARM_DATA_PATH, 'key.txt');
    try {
        if (fs.existsSync(keyFilePath)) {
            storedKey = fs.readFileSync(keyFilePath, 'utf8').trim();
        }
    } catch (err) {}
    
    const panelData = readPanelData();
    const panelKey = panelData?.farmKey;
    
    if (key !== storedKey && key !== panelKey) {
        return res.status(401).json({ error: 'Invalid key' });
    }
    
    // Get accounts with minimal processing
    const accounts = mergeAllAccountsData();
    
    const statusData = accounts.map(acc => ({
        playerName: acc.playerName,
        isOnline: acc.isOnline,
        lastUpdate: acc.lastUpdate,
        status: acc.status,
        action: acc.action,
        totalIncome: acc.totalIncome,
        totalIncomeFormatted: acc.totalIncomeFormatted,
        totalBrainrots: acc.totalBrainrots,
        maxSlots: acc.maxSlots
    }));
    
    res.json({
        timestamp: Date.now(),
        accounts: statusData
    });
});

// Sync endpoint - returns current panel data (merged from all files)
app.get('/api/sync', (req, res) => {
    // Disable caching - always return fresh data
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    
    const { key } = req.query;
    
    // Read the key from file
    let storedKey = null;
    const keyFilePath = path.join(FARM_DATA_PATH, 'key.txt');
    try {
        if (fs.existsSync(keyFilePath)) {
            storedKey = fs.readFileSync(keyFilePath, 'utf8').trim();
        }
    } catch (err) {
        console.error('Error reading key file:', err);
    }
    
    const panelData = readPanelData();
    const panelKey = panelData?.farmKey;
    
    // Validate key
    if (key && (key === storedKey || key === panelKey)) {
        // Merge data from all brainrots_*.json files
        const accounts = mergeAllAccountsData();
        const totalGlobalIncome = accounts.reduce((sum, acc) => sum + (acc.totalIncome || 0), 0);
        
        res.json({
            username: panelData?.username || 'Farmer',
            avatar: panelData?.avatar || { icon: 'fa-seedling', color: '#4ade80' },
            accounts: accounts,
            totalGlobalIncome: totalGlobalIncome
        });
    } else {
        res.status(401).json({ error: 'Invalid key' });
    }
});

// Validate farm key (for client compatibility)
app.post('/api/validate', (req, res) => {
    const { farmKey } = req.body;
    
    if (!farmKey) {
        return res.status(400).json({ error: 'Farm key is required' });
    }
    
    // First read the key from file
    let storedKey = null;
    const keyFilePath = path.join(FARM_DATA_PATH, 'key.txt');
    try {
        if (fs.existsSync(keyFilePath)) {
            storedKey = fs.readFileSync(keyFilePath, 'utf8').trim();
        }
    } catch (err) {
        console.error('Error reading key file:', err);
    }
    
    // Check if key matches stored key OR panel_data key
    const data = readPanelData();
    const panelKey = data?.farmKey;
    
    if (farmKey === storedKey || farmKey === panelKey) {
        res.json({ 
            valid: true, 
            username: data?.username || 'Farmer',
            avatar: data?.avatar || { icon: 'fa-seedling', color: '#4ade80' }
        });
    } else {
        res.status(401).json({ error: 'Invalid Farm Key. Check your farm/key.txt file.' });
    }
});

// Validate farm key (legacy endpoint)
app.post('/api/validate-key', (req, res) => {
    const { key } = req.body;
    
    // First read the key from file
    let storedKey = null;
    const keyFilePath = path.join(FARM_DATA_PATH, 'key.txt');
    try {
        if (fs.existsSync(keyFilePath)) {
            storedKey = fs.readFileSync(keyFilePath, 'utf8').trim();
        }
    } catch (err) {
        console.error('Error reading key file:', err);
    }
    
    // Check if key matches stored key OR panel_data key
    const data = readPanelData();
    const panelKey = data?.farmKey;
    
    if (key && (key === storedKey || key === panelKey)) {
        res.json({ valid: true, data });
    } else {
        res.json({ valid: false, message: 'Invalid Farm Key. Check your farm/key.txt file.' });
    }
});

// Delete farmer endpoint - removes farmer data file and all their brainrots
app.delete('/api/farmer/:playerName', (req, res) => {
    const { playerName } = req.params;
    const { key } = req.query;
    
    if (!key) {
        return res.status(400).json({ error: 'Farm key required' });
    }
    
    // Validate key
    let storedKey = null;
    const keyFilePath = path.join(FARM_DATA_PATH, 'key.txt');
    try {
        if (fs.existsSync(keyFilePath)) {
            storedKey = fs.readFileSync(keyFilePath, 'utf8').trim();
        }
    } catch (err) {}
    
    const panelData = readPanelData();
    const panelKey = panelData?.farmKey;
    
    if (key !== storedKey && key !== panelKey) {
        return res.status(401).json({ error: 'Invalid key' });
    }
    
    if (!playerName) {
        return res.status(400).json({ error: 'Player name required' });
    }
    
    try {
        // Find and delete the brainrots file for this player
        const files = fs.readdirSync(FARM_DATA_PATH);
        let deleted = false;
        
        for (const file of files) {
            if (file.startsWith('brainrots_') && file.endsWith('.json')) {
                const filePath = path.join(FARM_DATA_PATH, file);
                try {
                    const data = safeReadJSON(filePath);
                    if (data && data.playerName === playerName) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted farmer data: ${file}`);
                        deleted = true;
                        break;
                    }
                } catch (err) {
                    console.error(`Error reading ${file}:`, err);
                }
            }
        }
        
        if (deleted) {
            // Invalidate cache
            invalidateCache();
            
            // Broadcast update to all clients
            const updatedData = readPanelData();
            if (updatedData) {
                broadcastUpdate(updatedData);
            }
            
            res.json({ success: true, message: `Farmer ${playerName} deleted successfully` });
        } else {
            res.status(404).json({ error: `Farmer ${playerName} not found` });
        }
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
        
        await cronPriceScanner(mockReq, mockRes);
        
        if (mockRes._data) {
            const data = mockRes._data;
            console.log(`✅ [CRON] Price scan completed: ${data.scanned || 0} prices, ${data.offersScanned || 0} offers`);
        }
    } catch (err) {
        console.error('❌ [CRON] Price scan failed:', err.message);
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
    
    // Обновляем списки при старте сервера
    setTimeout(() => runEldoradoUpdate(), 5000);
    
    // Первый запуск cron сканера через 15 секунд после старта
    setTimeout(() => runPriceScanCron(), 15000);
});
