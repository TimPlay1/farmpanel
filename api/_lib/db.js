const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

// Retry helper with exponential backoff
async function withRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            // Retry on network/SSL errors
            const isRetryable = error.name === 'MongoNetworkError' || 
                               error.code === 'ECONNRESET' ||
                               error.message?.includes('SSL') ||
                               error.message?.includes('ETIMEDOUT');
            
            if (!isRetryable || attempt === maxRetries) {
                throw error;
            }
            
            const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
            console.log(`MongoDB connection attempt ${attempt} failed, retrying in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            
            // Clear cached connection on retry
            cachedClient = null;
            cachedDb = null;
        }
    }
    throw lastError;
}

async function connectToDatabase() {
    if (cachedDb) {
        // Verify connection is still alive
        try {
            await cachedClient.db('admin').command({ ping: 1 });
            return { client: cachedClient, db: cachedDb };
        } catch (e) {
            console.log('Cached connection stale, reconnecting...');
            cachedClient = null;
            cachedDb = null;
        }
    }

    return withRetry(async () => {
        let uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        // Ensure proper connection string parameters
        if (!uri.includes('retryWrites')) {
            uri += (uri.includes('?') ? '&' : '?') + 'retryWrites=true&w=majority';
        }

        const client = new MongoClient(uri, {
            maxPoolSize: 10,
            minPoolSize: 1,
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 60000,
            connectTimeoutMS: 30000,
            tls: true,
            tlsAllowInvalidCertificates: false,
            retryReads: true,
            retryWrites: true,
        });
        
        await client.connect();
        
        const db = client.db('farmerpanel');
        
        cachedClient = client;
        cachedDb = db;
        
        console.log('MongoDB connected successfully');
        return { client, db };
    }, 3, 1000);
}

// Avatar icons - unique geometric patterns
const AVATAR_ICONS = [
    'fa-gem', 'fa-bolt', 'fa-fire', 'fa-star', 'fa-moon', 
    'fa-sun', 'fa-heart', 'fa-crown', 'fa-shield', 'fa-rocket',
    'fa-ghost', 'fa-dragon', 'fa-skull', 'fa-spider', 'fa-fish',
    'fa-cat', 'fa-dog', 'fa-dove', 'fa-crow', 'fa-frog',
    'fa-leaf', 'fa-tree', 'fa-snowflake', 'fa-cloud', 'fa-rainbow',
    'fa-diamond', 'fa-cube', 'fa-chess', 'fa-puzzle-piece', 'fa-dice'
];

// Unique colors for avatars
const AVATAR_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8B500', '#FF8C00', '#00CED1', '#FF69B4', '#32CD32',
    '#FFD700', '#FF4500', '#1E90FF', '#FF1493', '#00FF7F',
    '#DC143C', '#00BFFF', '#FF6347', '#7B68EE', '#3CB371',
    '#FF7F50', '#6495ED', '#FFB6C1', '#20B2AA', '#778899'
];

// Generate unique avatar for a farm key
function generateAvatar(existingAvatars = []) {
    const usedIcons = new Set(existingAvatars.map(a => a.icon));
    const usedColors = new Set(existingAvatars.map(a => a.color));
    
    // Find unused icon
    let icon = AVATAR_ICONS.find(i => !usedIcons.has(i));
    if (!icon) {
        icon = AVATAR_ICONS[Math.floor(Math.random() * AVATAR_ICONS.length)];
    }
    
    // Find unused color
    let color = AVATAR_COLORS.find(c => !usedColors.has(c));
    if (!color) {
        color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    }
    
    return { icon, color };
}

// Generate random username
function generateUsername() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `Aboba_${randomNum}`;
}

module.exports = {
    connectToDatabase,
    generateAvatar,
    generateUsername,
    AVATAR_ICONS,
    AVATAR_COLORS
};
