/**
 * MySQL Database Layer for FarmerPanel
 * Replaces MongoDB with MySQL/MariaDB
 */

const mysql = require('mysql2/promise');

let pool = null;

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

// Cute animal/object names for username generation
const NAME_PARTS = [
    'Happy', 'Crazy', 'Lucky', 'Fluffy', 'Mighty', 'Swift', 'Clever', 'Brave',
    'Ninja', 'Cosmic', 'Electric', 'Shadow', 'Golden', 'Silver', 'Crystal', 'Thunder'
];

const NAME_SUFFIXES = [
    'Cat', 'Dog', 'Fox', 'Wolf', 'Bear', 'Panda', 'Dragon', 'Phoenix',
    'Tiger', 'Lion', 'Eagle', 'Hawk', 'Shark', 'Whale', 'Owl', 'Raven'
];

/**
 * Get MySQL connection pool
 */
async function getPool() {
    if (pool) return pool;
    
    const dbUri = process.env.MYSQL_URI || process.env.DATABASE_URL;
    if (!dbUri) {
        throw new Error('MYSQL_URI environment variable is not set');
    }
    
    // Parse connection string or use individual vars
    let config;
    if (dbUri.startsWith('mysql://')) {
        const url = new URL(dbUri);
        config = {
            host: url.hostname,
            port: parseInt(url.port) || 3306,
            user: url.username,
            password: url.password,
            database: url.pathname.slice(1), // Remove leading /
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            timezone: '+00:00',
            charset: 'utf8mb4'
        };
    } else {
        // Individual env vars
        config = {
            host: process.env.MYSQL_HOST || 'localhost',
            port: parseInt(process.env.MYSQL_PORT) || 3306,
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'farmerpanel',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            timezone: '+00:00',
            charset: 'utf8mb4'
        };
    }
    
    pool = mysql.createPool(config);
    
    // Test connection
    const conn = await pool.getConnection();
    console.log('MySQL connected successfully');
    conn.release();
    
    return pool;
}

/**
 * Connect to database - returns pool connection
 * Compatible interface with old MongoDB connectToDatabase()
 */
async function connectToDatabase() {
    const pool = await getPool();
    return { pool, db: new DatabaseWrapper(pool) };
}

/**
 * Database wrapper class that mimics MongoDB collection interface
 */
class DatabaseWrapper {
    constructor(pool) {
        this.pool = pool;
        this._collections = {};
    }
    
    collection(name) {
        if (!this._collections[name]) {
            this._collections[name] = new CollectionWrapper(this.pool, name);
        }
        return this._collections[name];
    }
}

/**
 * Collection wrapper - provides MongoDB-like interface for MySQL
 */
class CollectionWrapper {
    constructor(pool, tableName) {
        this.pool = pool;
        this.tableName = tableName;
    }
    
    /**
     * Find one document
     */
    async findOne(filter, options = {}) {
        const { where, params } = this._buildWhere(filter);
        const fields = options.projection ? this._buildProjection(options.projection) : '*';
        
        const sql = `SELECT ${fields} FROM ${this.tableName} ${where} LIMIT 1`;
        const [rows] = await this.pool.execute(sql, params);
        
        return rows.length > 0 ? this._transformRow(rows[0]) : null;
    }
    
    /**
     * Find multiple documents - returns cursor-like object
     */
    find(filter = {}, options = {}) {
        return new QueryBuilder(this.pool, this.tableName, filter, options, this);
    }
    
    /**
     * Insert one document
     */
    async insertOne(doc) {
        const transformed = this._transformDocToRow(doc);
        const keys = Object.keys(transformed);
        const values = Object.values(transformed);
        const placeholders = keys.map(() => '?').join(', ');
        
        const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
        const [result] = await this.pool.execute(sql, values);
        
        return { insertedId: result.insertId };
    }
    
    /**
     * Insert many documents
     */
    async insertMany(docs) {
        if (docs.length === 0) return { insertedCount: 0 };
        
        const transformed = docs.map(doc => this._transformDocToRow(doc));
        const keys = Object.keys(transformed[0]);
        const placeholders = `(${keys.map(() => '?').join(', ')})`;
        const allPlaceholders = docs.map(() => placeholders).join(', ');
        const allValues = transformed.flatMap(doc => Object.values(doc));
        
        const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES ${allPlaceholders}`;
        const [result] = await this.pool.execute(sql, allValues);
        
        return { insertedCount: result.affectedRows };
    }
    
    /**
     * Update one document
     */
    async updateOne(filter, update, options = {}) {
        const { where, params: whereParams } = this._buildWhere(filter);
        const { set, params: setParams } = this._buildUpdate(update);
        
        if (options.upsert) {
            // Try update first
            let sql = `UPDATE ${this.tableName} ${set} ${where} LIMIT 1`;
            let [result] = await this.pool.execute(sql, [...setParams, ...whereParams]);
            
            if (result.affectedRows === 0) {
                // Insert
                const doc = { ...filter, ...(update.$set || {}) };
                return this.insertOne(doc);
            }
            
            return { modifiedCount: result.affectedRows };
        }
        
        const sql = `UPDATE ${this.tableName} ${set} ${where} LIMIT 1`;
        const [result] = await this.pool.execute(sql, [...setParams, ...whereParams]);
        
        return { modifiedCount: result.affectedRows };
    }
    
    /**
     * Update many documents
     */
    async updateMany(filter, update) {
        const { where, params: whereParams } = this._buildWhere(filter);
        const { set, params: setParams } = this._buildUpdate(update);
        
        const sql = `UPDATE ${this.tableName} ${set} ${where}`;
        const [result] = await this.pool.execute(sql, [...setParams, ...whereParams]);
        
        return { modifiedCount: result.affectedRows };
    }
    
    /**
     * Delete one document
     */
    async deleteOne(filter) {
        const { where, params } = this._buildWhere(filter);
        
        const sql = `DELETE FROM ${this.tableName} ${where} LIMIT 1`;
        const [result] = await this.pool.execute(sql, params);
        
        return { deletedCount: result.affectedRows };
    }
    
    /**
     * Delete many documents
     */
    async deleteMany(filter) {
        const { where, params } = this._buildWhere(filter);
        
        const sql = `DELETE FROM ${this.tableName} ${where}`;
        const [result] = await this.pool.execute(sql, params);
        
        return { deletedCount: result.affectedRows };
    }
    
    /**
     * Count documents
     */
    async countDocuments(filter = {}) {
        const { where, params } = this._buildWhere(filter);
        
        const sql = `SELECT COUNT(*) as count FROM ${this.tableName} ${where}`;
        const [rows] = await this.pool.execute(sql, params);
        
        return rows[0].count;
    }
    
    /**
     * Find one and update
     */
    async findOneAndUpdate(filter, update, options = {}) {
        const existing = await this.findOne(filter);
        
        if (!existing && options.upsert) {
            const doc = { ...filter, ...(update.$set || {}) };
            await this.insertOne(doc);
            return { value: options.returnDocument === 'after' ? doc : null };
        }
        
        if (!existing) return { value: null };
        
        await this.updateOne(filter, update);
        
        if (options.returnDocument === 'after') {
            return { value: await this.findOne(filter) };
        }
        
        return { value: existing };
    }
    
    /**
     * Aggregate - basic support
     */
    async aggregate(pipeline) {
        // Basic aggregation support - can be extended
        // For now, return empty array for unsupported pipelines
        console.warn('Aggregation not fully supported in MySQL wrapper:', pipeline);
        return [];
    }
    
    /**
     * Build WHERE clause from MongoDB-style filter
     */
    _buildWhere(filter) {
        if (Object.keys(filter).length === 0) {
            return { where: '', params: [] };
        }
        
        const conditions = [];
        const params = [];
        
        for (const [key, value] of Object.entries(filter)) {
            const column = this._toSnakeCase(key);
            
            if (value === null) {
                conditions.push(`${column} IS NULL`);
            } else if (typeof value === 'object' && value !== null) {
                // Handle operators
                if (value.$in) {
                    const placeholders = value.$in.map(() => '?').join(', ');
                    conditions.push(`${column} IN (${placeholders})`);
                    params.push(...value.$in);
                } else if (value.$nin) {
                    const placeholders = value.$nin.map(() => '?').join(', ');
                    conditions.push(`${column} NOT IN (${placeholders})`);
                    params.push(...value.$nin);
                } else if (value.$gt !== undefined) {
                    conditions.push(`${column} > ?`);
                    params.push(value.$gt);
                } else if (value.$gte !== undefined) {
                    conditions.push(`${column} >= ?`);
                    params.push(value.$gte);
                } else if (value.$lt !== undefined) {
                    conditions.push(`${column} < ?`);
                    params.push(value.$lt);
                } else if (value.$lte !== undefined) {
                    conditions.push(`${column} <= ?`);
                    params.push(value.$lte);
                } else if (value.$ne !== undefined) {
                    conditions.push(`${column} != ?`);
                    params.push(value.$ne);
                } else if (value.$exists !== undefined) {
                    conditions.push(value.$exists ? `${column} IS NOT NULL` : `${column} IS NULL`);
                } else if (value.$regex !== undefined) {
                    conditions.push(`${column} REGEXP ?`);
                    params.push(value.$regex);
                } else {
                    // Assume it's a direct value
                    conditions.push(`${column} = ?`);
                    params.push(JSON.stringify(value));
                }
            } else {
                conditions.push(`${column} = ?`);
                params.push(value);
            }
        }
        
        return {
            where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
            params
        };
    }
    
    /**
     * Build SET clause from MongoDB-style update
     */
    _buildUpdate(update) {
        const sets = [];
        const params = [];
        
        const fields = update.$set || update;
        
        for (const [key, value] of Object.entries(fields)) {
            if (key.startsWith('$')) continue; // Skip operators
            
            const column = this._toSnakeCase(key);
            sets.push(`${column} = ?`);
            
            if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                params.push(JSON.stringify(value));
            } else if (value instanceof Date) {
                params.push(value.toISOString().slice(0, 19).replace('T', ' '));
            } else {
                params.push(value);
            }
        }
        
        // Handle $inc
        if (update.$inc) {
            for (const [key, value] of Object.entries(update.$inc)) {
                const column = this._toSnakeCase(key);
                sets.push(`${column} = ${column} + ?`);
                params.push(value);
            }
        }
        
        // Handle $unset
        if (update.$unset) {
            for (const key of Object.keys(update.$unset)) {
                const column = this._toSnakeCase(key);
                sets.push(`${column} = NULL`);
            }
        }
        
        return {
            set: sets.length > 0 ? `SET ${sets.join(', ')}` : '',
            params
        };
    }
    
    /**
     * Build projection (SELECT fields)
     */
    _buildProjection(projection) {
        const fields = [];
        for (const [key, value] of Object.entries(projection)) {
            if (value) {
                fields.push(this._toSnakeCase(key));
            }
        }
        return fields.length > 0 ? fields.join(', ') : '*';
    }
    
    /**
     * Convert camelCase to snake_case
     */
    _toSnakeCase(str) {
        // Handle special MongoDB fields
        if (str === '_id') return 'id';
        if (str === 'farmKey') return 'farm_key';
        if (str === 'offerId') return 'offer_id';
        if (str === 'userId') return 'user_id';
        if (str === 'playerName') return 'player_name';
        if (str === 'shopName') return 'shop_name';
        if (str === 'brainrotName') return 'brainrot_name';
        if (str === 'createdAt') return 'created_at';
        if (str === 'updatedAt') return 'updated_at';
        if (str === 'lastUpdate') return 'last_update';
        if (str === 'cacheKey') return 'cache_key';
        
        return str.replace(/([A-Z])/g, '_$1').toLowerCase();
    }
    
    /**
     * Convert snake_case to camelCase
     */
    _toCamelCase(str) {
        return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }
    
    /**
     * Transform row from database to document
     */
    _transformRow(row) {
        if (!row) return null;
        
        const doc = {};
        for (const [key, value] of Object.entries(row)) {
            const camelKey = this._toCamelCase(key);
            
            // Try to parse JSON fields
            if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                try {
                    doc[camelKey] = JSON.parse(value);
                } catch {
                    doc[camelKey] = value;
                }
            } else {
                doc[camelKey] = value;
            }
        }
        
        // Add _id alias
        if (doc.id !== undefined) {
            doc._id = doc.id;
        }
        
        return doc;
    }
    
    /**
     * Transform document to row for insertion
     */
    _transformDocToRow(doc) {
        const row = {};
        for (const [key, value] of Object.entries(doc)) {
            if (key === '_id') continue; // Skip MongoDB _id
            
            const snakeKey = this._toSnakeCase(key);
            
            if (value instanceof Date) {
                row[snakeKey] = value.toISOString().slice(0, 19).replace('T', ' ');
            } else if (typeof value === 'object' && value !== null) {
                row[snakeKey] = JSON.stringify(value);
            } else {
                row[snakeKey] = value;
            }
        }
        return row;
    }
}

/**
 * Query builder for chained operations
 */
class QueryBuilder {
    constructor(pool, tableName, filter, options, collection) {
        this.pool = pool;
        this.tableName = tableName;
        this.filter = filter;
        this.options = options;
        this.collection = collection;
        this._sort = null;
        this._limit = null;
        this._skip = null;
    }
    
    sort(sortSpec) {
        this._sort = sortSpec;
        return this;
    }
    
    limit(n) {
        this._limit = n;
        return this;
    }
    
    skip(n) {
        this._skip = n;
        return this;
    }
    
    async toArray() {
        const { where, params } = this.collection._buildWhere(this.filter);
        
        let sql = `SELECT * FROM ${this.tableName} ${where}`;
        
        if (this._sort) {
            const orderParts = [];
            for (const [key, dir] of Object.entries(this._sort)) {
                const column = this.collection._toSnakeCase(key);
                orderParts.push(`${column} ${dir === -1 ? 'DESC' : 'ASC'}`);
            }
            if (orderParts.length > 0) {
                sql += ` ORDER BY ${orderParts.join(', ')}`;
            }
        }
        
        if (this._limit !== null) {
            sql += ` LIMIT ${this._limit}`;
        }
        
        if (this._skip !== null) {
            sql += ` OFFSET ${this._skip}`;
        }
        
        const [rows] = await this.pool.execute(sql, params);
        return rows.map(row => this.collection._transformRow(row));
    }
}

// ============================================================
// Helper functions (same as MongoDB version)
// ============================================================

/**
 * Generate unique avatar for a farm key
 */
function generateAvatar(existingAvatars = []) {
    const usedIcons = new Set(existingAvatars.map(a => a?.icon));
    const usedColors = new Set(existingAvatars.map(a => a?.color));
    
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

/**
 * Generate random username
 */
function generateUsername() {
    const part1 = NAME_PARTS[Math.floor(Math.random() * NAME_PARTS.length)];
    const part2 = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
    const number = Math.floor(Math.random() * 9000) + 1000;
    return `${part1}${part2}_${number}`;
}

// ============================================================
// Rate Limiter (MySQL version)
// ============================================================

class AIRateLimiter {
    constructor(pool) {
        this.pool = pool;
        this.MAX_TOKENS_PER_MINUTE = 195000;
        this.WINDOW_MS = 60000;
    }
    
    async getCurrentUsage() {
        const windowStart = Date.now() - this.WINDOW_MS;
        const [rows] = await this.pool.execute(
            'SELECT SUM(tokens) as total FROM rate_limits WHERE timestamp > ?',
            [windowStart]
        );
        return rows[0]?.total || 0;
    }
    
    async canMakeRequest(estimatedTokens = 3000) {
        const currentUsage = await this.getCurrentUsage();
        return currentUsage + estimatedTokens <= this.MAX_TOKENS_PER_MINUTE;
    }
    
    async recordUsage(tokens, source = 'unknown') {
        await this.pool.execute(
            'INSERT INTO rate_limits (timestamp, tokens, source) VALUES (?, ?, ?)',
            [Date.now(), tokens, source]
        );
    }
    
    async waitForCapacity(estimatedTokens = 3000) {
        while (!(await this.canMakeRequest(estimatedTokens))) {
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// ============================================================
// AI Price Cache functions
// ============================================================

async function getAIPriceFromCache(cacheKey) {
    const pool = await getPool();
    const [rows] = await pool.execute(
        'SELECT data, timestamp FROM ai_price_cache WHERE cache_key = ?',
        [cacheKey]
    );
    
    if (rows.length === 0) return null;
    
    const { data, timestamp } = rows[0];
    const age = Date.now() - timestamp;
    
    // 10 minute TTL
    if (age > 600000) return null;
    
    return typeof data === 'string' ? JSON.parse(data) : data;
}

async function setAIPriceToCache(cacheKey, data) {
    const pool = await getPool();
    const timestamp = Date.now();
    
    await pool.execute(
        `INSERT INTO ai_price_cache (cache_key, data, timestamp, updated_at) 
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE data = VALUES(data), timestamp = VALUES(timestamp), updated_at = NOW()`,
        [cacheKey, JSON.stringify(data), timestamp]
    );
}

async function deleteAIPriceFromCache(cacheKey) {
    const pool = await getPool();
    await pool.execute('DELETE FROM ai_price_cache WHERE cache_key = ?', [cacheKey]);
}

// ============================================================
// Exports
// ============================================================

module.exports = {
    connectToDatabase,
    getPool,
    generateAvatar,
    generateUsername,
    AIRateLimiter,
    getAIPriceFromCache,
    setAIPriceToCache,
    deleteAIPriceFromCache,
    AVATAR_ICONS,
    AVATAR_COLORS
};
