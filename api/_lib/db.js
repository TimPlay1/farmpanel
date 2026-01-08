/**
 * Database Adapter - MySQL Backend
 * Main database module for Farmer Panel
 * Uses MySQL/MariaDB for data storage
 */

const mysql = require('mysql2/promise');

let pool = null;

// ============================================================
// Constants
// ============================================================

const AVATAR_ICONS = [
    'fa-gem', 'fa-bolt', 'fa-fire', 'fa-star', 'fa-moon', 
    'fa-sun', 'fa-heart', 'fa-crown', 'fa-shield', 'fa-rocket',
    'fa-ghost', 'fa-dragon', 'fa-skull', 'fa-spider', 'fa-fish',
    'fa-cat', 'fa-dog', 'fa-dove', 'fa-crow', 'fa-frog',
    'fa-leaf', 'fa-tree', 'fa-snowflake', 'fa-cloud', 'fa-rainbow',
    'fa-diamond', 'fa-cube', 'fa-chess', 'fa-puzzle-piece', 'fa-dice'
];

const AVATAR_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8B500', '#FF8C00', '#00CED1', '#FF69B4', '#32CD32',
    '#FFD700', '#FF4500', '#1E90FF', '#FF1493', '#00FF7F',
    '#DC143C', '#00BFFF', '#FF6347', '#7B68EE', '#3CB371',
    '#FF7F50', '#6495ED', '#FFB6C1', '#20B2AA', '#778899'
];

const GLOBAL_RATE_LIMIT = {
    MAX_TOKENS_PER_MINUTE: 14000,
    MAX_REQUESTS_PER_MINUTE: 28,
    WINDOW_MS: 60000
};

const AI_CACHE_TTL_MS = 10 * 60 * 1000;

// ============================================================
// Connection Pool
// ============================================================

async function getPool() {
    if (pool) return pool;
    
    const dbUri = process.env.MYSQL_URI || process.env.DATABASE_URL;
    
    if (!dbUri) {
        throw new Error('MYSQL_URI environment variable is not set');
    }
    
    let config;
    if (dbUri.startsWith('mysql://') || dbUri.startsWith('mariadb://')) {
        const url = new URL(dbUri);
        config = {
            host: url.hostname,
            port: parseInt(url.port) || 3306,
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: url.pathname.slice(1),
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            timezone: '+00:00',
            charset: 'utf8mb4'
        };
    } else {
        config = {
            host: process.env.MYSQL_HOST || 'localhost',
            port: parseInt(process.env.MYSQL_PORT) || 3306,
            user: process.env.MYSQL_USER || 'farmerpanel',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'farmerpanel',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            timezone: '+00:00',
            charset: 'utf8mb4'
        };
    }
    
    pool = mysql.createPool(config);
    
    try {
        const conn = await pool.getConnection();
        console.log('MySQL connected successfully');
        conn.release();
    } catch (e) {
        console.error('MySQL connection failed:', e.message);
        throw e;
    }
    
    return pool;
}

// ============================================================
// Main Connection Function (MongoDB-compatible interface)
// ============================================================

async function connectToDatabase() {
    const p = await getPool();
    return { 
        pool: p, 
        db: new MySQLDatabase(p),
        client: { db: () => new MySQLDatabase(p) }
    };
}

// ============================================================
// MySQL Database Wrapper
// ============================================================

class MySQLDatabase {
    constructor(pool) {
        this.pool = pool;
        this._collections = {};
    }
    
    collection(name) {
        // Map MongoDB collection names to MySQL table names
        const tableMap = {
            'farmers': 'farmers',
            'accountAvatars': 'account_avatars',
            'offers': 'offers',
            'offer_codes': 'offer_codes',
            'price_cache': 'price_cache',
            'global_brainrot_prices': 'global_brainrot_prices',
            'balance_history': 'balance_history',
            'scan_state': 'scan_state',
            'ai_queue': 'ai_queue',
            'ai_price_cache': 'ai_price_cache',
            'rate_limits': 'rate_limits',
            'user_colors': 'user_colors',
            'top_cache': 'top_cache',
            'queues': 'queues',
            'delete_queues': 'delete_queues',
            'generations': 'generations',
            'adjustment_queue': 'adjustment_queue'
        };
        
        const tableName = tableMap[name] || name;
        
        if (!this._collections[name]) {
            // Special handling for farmers collection
            if (name === 'farmers') {
                this._collections[name] = new FarmersCollection(this.pool);
            } else {
                this._collections[name] = new MySQLCollection(this.pool, tableName);
            }
        }
        
        return this._collections[name];
    }
}

// ============================================================
// Base MySQL Collection (generic)
// ============================================================

class MySQLCollection {
    constructor(pool, tableName) {
        this.pool = pool;
        this.tableName = tableName;
    }
    
    async findOne(filter, options = {}) {
        const { sql, params } = this._buildSelect(filter, { ...options, limit: 1 });
        const [rows] = await this.pool.execute(sql, params);
        return rows.length > 0 ? this._transformRow(rows[0]) : null;
    }
    
    find(filter = {}) {
        return new QueryCursor(this, filter);
    }
    
    async insertOne(doc) {
        const row = this._docToRow(doc);
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = columns.map(() => '?').join(', ');
        
        const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        const [result] = await this.pool.execute(sql, values);
        
        return { insertedId: result.insertId, acknowledged: true };
    }
    
    async updateOne(filter, update, options = {}) {
        const { setClause, setParams } = this._buildUpdate(update);
        const { whereClause, whereParams } = this._buildWhere(filter);
        
        if (options.upsert) {
            const existing = await this.findOne(filter);
            if (!existing) {
                const doc = { ...this._flattenFilter(filter), ...(update.$set || update) };
                return this.insertOne(doc);
            }
        }
        
        const sql = `UPDATE ${this.tableName} ${setClause} ${whereClause} LIMIT 1`;
        const [result] = await this.pool.execute(sql, [...setParams, ...whereParams]);
        
        return { modifiedCount: result.affectedRows, acknowledged: true };
    }
    
    async updateMany(filter, update) {
        const { setClause, setParams } = this._buildUpdate(update);
        const { whereClause, whereParams } = this._buildWhere(filter);
        
        const sql = `UPDATE ${this.tableName} ${setClause} ${whereClause}`;
        const [result] = await this.pool.execute(sql, [...setParams, ...whereParams]);
        
        return { modifiedCount: result.affectedRows, acknowledged: true };
    }
    
    async deleteOne(filter) {
        const { whereClause, whereParams } = this._buildWhere(filter);
        const sql = `DELETE FROM ${this.tableName} ${whereClause} LIMIT 1`;
        const [result] = await this.pool.execute(sql, whereParams);
        return { deletedCount: result.affectedRows, acknowledged: true };
    }
    
    async deleteMany(filter) {
        const { whereClause, whereParams } = this._buildWhere(filter);
        const sql = `DELETE FROM ${this.tableName} ${whereClause}`;
        const [result] = await this.pool.execute(sql, whereParams);
        return { deletedCount: result.affectedRows, acknowledged: true };
    }
    
    async countDocuments(filter = {}) {
        const { whereClause, whereParams } = this._buildWhere(filter);
        const sql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
        const [rows] = await this.pool.execute(sql, whereParams);
        return rows[0].count;
    }
    
    async findOneAndUpdate(filter, update, options = {}) {
        const existing = await this.findOne(filter);
        
        if (!existing && options.upsert) {
            const doc = { ...this._flattenFilter(filter), ...(update.$set || update) };
            await this.insertOne(doc);
            return { value: options.returnDocument === 'after' ? await this.findOne(filter) : null };
        }
        
        if (!existing) return { value: null };
        
        await this.updateOne(filter, update);
        
        return { 
            value: options.returnDocument === 'after' ? await this.findOne(filter) : existing 
        };
    }
    
    async aggregate(pipeline) {
        // Basic aggregation support - return cursor-like object with toArray()
        // For complex aggregations, implement specific handlers
        console.warn(`Aggregation on ${this.tableName} - may need custom implementation`);
        // Return cursor-like object for MongoDB compatibility
        return {
            toArray: async () => []
        };
    }
    
    // MySQL doesn't need dynamic index creation - indexes are defined in schema.sql
    async createIndex(keys, options = {}) {
        // Stub method for MongoDB compatibility
        // In MySQL, indexes are created via schema.sql
        return { ok: 1 };
    }
    
    // Bulk write operations (MongoDB compatibility)
    async bulkWrite(operations, options = {}) {
        let insertCount = 0;
        let updateCount = 0;
        let deleteCount = 0;
        
        for (const op of operations) {
            try {
                if (op.insertOne) {
                    await this.insertOne(op.insertOne.document || op.insertOne);
                    insertCount++;
                } else if (op.updateOne) {
                    const result = await this.updateOne(
                        op.updateOne.filter,
                        op.updateOne.update,
                        { upsert: op.updateOne.upsert || false }
                    );
                    updateCount++;
                } else if (op.deleteOne) {
                    await this.deleteOne(op.deleteOne.filter);
                    deleteCount++;
                } else if (op.updateMany) {
                    await this.updateMany(op.updateMany.filter, op.updateMany.update);
                    updateCount++;
                } else if (op.deleteMany) {
                    await this.deleteMany(op.deleteMany.filter);
                    deleteCount++;
                }
            } catch (e) {
                console.error(`bulkWrite operation failed:`, e.message);
            }
        }
        
        return {
            ok: 1,
            insertedCount: insertCount,
            modifiedCount: updateCount,
            deletedCount: deleteCount,
            acknowledged: true
        };
    }
    
    // ============ Helper Methods ============
    
    _buildSelect(filter, options = {}) {
        const { whereClause, whereParams } = this._buildWhere(filter);
        let sql = `SELECT * FROM ${this.tableName} ${whereClause}`;
        
        if (options.sort) {
            const orderParts = Object.entries(options.sort)
                .map(([key, dir]) => `${this._toColumn(key)} ${dir === -1 ? 'DESC' : 'ASC'}`);
            sql += ` ORDER BY ${orderParts.join(', ')}`;
        }
        
        if (options.limit) sql += ` LIMIT ${options.limit}`;
        if (options.skip) sql += ` OFFSET ${options.skip}`;
        
        return { sql, params: whereParams };
    }
    
    _buildWhere(filter) {
        if (!filter || Object.keys(filter).length === 0) {
            return { whereClause: '', whereParams: [] };
        }
        
        const conditions = [];
        const params = [];
        
        for (const [key, value] of Object.entries(filter)) {
            const column = this._toColumn(key);
            
            if (value === null || value === undefined) {
                conditions.push(`${column} IS NULL`);
            } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                // Handle MongoDB operators
                for (const [op, opValue] of Object.entries(value)) {
                    switch (op) {
                        case '$in':
                            if (opValue.length === 0) {
                                conditions.push('1=0'); // Empty $in = no match
                            } else {
                                conditions.push(`${column} IN (${opValue.map(() => '?').join(',')})`);
                                params.push(...opValue);
                            }
                            break;
                        case '$nin':
                            if (opValue.length > 0) {
                                conditions.push(`${column} NOT IN (${opValue.map(() => '?').join(',')})`);
                                params.push(...opValue);
                            }
                            break;
                        case '$gt':
                            conditions.push(`${column} > ?`);
                            params.push(this._toValue(opValue));
                            break;
                        case '$gte':
                            conditions.push(`${column} >= ?`);
                            params.push(this._toValue(opValue));
                            break;
                        case '$lt':
                            conditions.push(`${column} < ?`);
                            params.push(this._toValue(opValue));
                            break;
                        case '$lte':
                            conditions.push(`${column} <= ?`);
                            params.push(this._toValue(opValue));
                            break;
                        case '$ne':
                            conditions.push(`${column} != ?`);
                            params.push(this._toValue(opValue));
                            break;
                        case '$exists':
                            conditions.push(opValue ? `${column} IS NOT NULL` : `${column} IS NULL`);
                            break;
                        case '$regex':
                            conditions.push(`${column} REGEXP ?`);
                            params.push(opValue);
                            break;
                    }
                }
            } else {
                conditions.push(`${column} = ?`);
                params.push(this._toValue(value));
            }
        }
        
        return {
            whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
            whereParams: params
        };
    }
    
    _buildUpdate(update) {
        const sets = [];
        const params = [];
        
        // Handle $set
        const fields = update.$set || (update.$inc || update.$unset ? {} : update);
        for (const [key, value] of Object.entries(fields)) {
            if (key.startsWith('$')) continue;
            sets.push(`${this._toColumn(key)} = ?`);
            params.push(this._toValue(value));
        }
        
        // Handle $inc
        if (update.$inc) {
            for (const [key, value] of Object.entries(update.$inc)) {
                const col = this._toColumn(key);
                sets.push(`${col} = ${col} + ?`);
                params.push(value);
            }
        }
        
        // Handle $unset
        if (update.$unset) {
            for (const key of Object.keys(update.$unset)) {
                sets.push(`${this._toColumn(key)} = NULL`);
            }
        }
        
        return {
            setClause: sets.length > 0 ? `SET ${sets.join(', ')}` : '',
            setParams: params
        };
    }
    
    _toColumn(key) {
        // MongoDB _id maps to id in MySQL, or to primary key column
        if (key === '_id') {
            // For tables with different primary keys
            if (this.tableName === 'price_cache' || 
                this.tableName === 'ai_price_cache' || 
                this.tableName === 'ai_queue') {
                return 'cache_key';
            }
            if (this.tableName === 'scan_state') return 'id';
            if (this.tableName === 'user_colors') return 'farm_key';
            if (this.tableName === 'top_cache') return 'type';
            if (this.tableName === 'queues' || this.tableName === 'delete_queues') return 'farm_key';
            return 'id';
        }
        
        // Common field mappings
        const fieldMap = {
            'farmKey': 'farm_key',
            'offerId': 'offer_id',
            'userId': 'user_id',
            'playerName': 'player_name',
            'shopName': 'shop_name',
            'brainrotName': 'brainrot_name',
            'createdAt': 'created_at',
            'updatedAt': 'updated_at',
            'lastUpdate': 'last_update',
            'cacheKey': 'cache_key',
            'suggestedPrice': 'suggested_price',
            'currentPrice': 'current_price',
            'recommendedPrice': 'recommended_price',
            'competitorPrice': 'competitor_price',
            'competitorIncome': 'competitor_income',
            'priceSource': 'price_source',
            'lastScanAt': 'last_scan_at',
            'lastScannedAt': 'last_scanned_at',
            'totalScanned': 'total_scanned',
            'cycleId': 'cycle_id',
            'isSpike': 'is_spike',
            'pausedAt': 'paused_at',
            'eldoradoOfferId': 'eldorado_offer_id',
            'accountId': 'account_id',
            'incomeRaw': 'income_raw',
            'imageUrl': 'image_url',
            'base64': 'base64_image',
            'fetchedAt': 'fetched_at',
            'lastTimestamp': 'last_timestamp',
            'totalValue': 'total_value',
            'valueUpdatedAt': 'value_updated_at',
            'avatarIcon': 'avatar_icon',
            'avatarColor': 'avatar_color',
            'isOnline': 'is_online',
            'farmerId': 'farmer_id',
            'incomeText': 'income_text'
        };
        
        return fieldMap[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();
    }
    
    _toValue(value) {
        if (value instanceof Date) {
            return value.toISOString().slice(0, 19).replace('T', ' ');
        }
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return value;
    }
    
    _transformRow(row) {
        if (!row) return null;
        
        const doc = {};
        for (const [key, value] of Object.entries(row)) {
            // Convert snake_case to camelCase
            const camelKey = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
            
            // Try to parse JSON
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
        if (doc.id !== undefined) doc._id = doc.id;
        if (doc.cacheKey !== undefined) doc._id = doc.cacheKey;
        if (doc.farmKey !== undefined && !doc._id) doc._id = doc.farmKey;
        
        return doc;
    }
    
    _docToRow(doc) {
        const row = {};
        for (const [key, value] of Object.entries(doc)) {
            // Map _id to id column for tables that use custom IDs
            if (key === '_id') {
                row['id'] = this._toValue(value);
                continue;
            }
            row[this._toColumn(key)] = this._toValue(value);
        }
        return row;
    }
    
    _flattenFilter(filter) {
        const flat = {};
        for (const [key, value] of Object.entries(filter)) {
            if (typeof value !== 'object' || value instanceof Date) {
                flat[key] = value;
            }
        }
        return flat;
    }
}

// ============================================================
// Query Cursor (for .find().sort().limit().toArray())
// ============================================================

class QueryCursor {
    constructor(collection, filter) {
        this.collection = collection;
        this.filter = filter;
        this._sort = null;
        this._limit = null;
        this._skip = null;
        this._projection = null;
    }
    
    sort(spec) {
        this._sort = spec;
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
    
    project(spec) {
        this._projection = spec;
        return this;
    }
    
    async toArray() {
        const options = {
            sort: this._sort,
            limit: this._limit,
            skip: this._skip
        };
        
        const { sql, params } = this.collection._buildSelect(this.filter, options);
        const [rows] = await this.collection.pool.execute(sql, params);
        return rows.map(row => this.collection._transformRow(row));
    }
}

// ============================================================
// Special Farmers Collection (handles nested accounts/brainrots)
// ============================================================

class FarmersCollection extends MySQLCollection {
    constructor(pool) {
        super(pool, 'farmers');
    }
    
    async findOne(filter, options = {}) {
        // Get base farmer
        const farmer = await super.findOne(filter, options);
        if (!farmer) return null;
        
        // Load accounts and brainrots
        return this._loadNested(farmer);
    }
    
    async _loadNested(farmer) {
        // Get accounts
        const [accounts] = await this.pool.execute(
            'SELECT * FROM farmer_accounts WHERE farmer_id = ?',
            [farmer.id]
        );
        
        // Get brainrots for each account
        farmer.accounts = [];
        for (const acc of accounts) {
            const [brainrots] = await this.pool.execute(
                'SELECT * FROM farmer_brainrots WHERE account_id = ?',
                [acc.id]
            );
            
            const account = this._transformRow(acc);
            account.brainrots = brainrots.map(b => ({
                name: b.name,
                income: b.income,
                incomeText: b.income_text,
                mutation: b.mutation,
                imageUrl: b.image_url
            }));
            
            farmer.accounts.push(account);
        }
        
        // Build playerUserIdMap
        farmer.playerUserIdMap = {};
        for (const acc of farmer.accounts) {
            if (acc.playerName && acc.userId) {
                farmer.playerUserIdMap[acc.playerName] = acc.userId;
            }
        }
        
        // Build accountAvatars from account_avatars table
        farmer.accountAvatars = {};
        const userIds = farmer.accounts.map(a => a.userId).filter(Boolean);
        if (userIds.length > 0) {
            const [avatars] = await this.pool.execute(
                `SELECT * FROM account_avatars WHERE user_id IN (${userIds.map(() => '?').join(',')})`,
                userIds
            );
            for (const av of avatars) {
                farmer.accountAvatars[av.user_id] = {
                    url: av.base64_image,
                    base64: av.base64_image,
                    timestamp: av.fetched_at
                };
            }
        }
        
        // Reconstruct avatar object
        if (farmer.avatarIcon || farmer.avatarColor) {
            farmer.avatar = {
                icon: farmer.avatarIcon || 'fa-gem',
                color: farmer.avatarColor || '#FF6B6B'
            };
        }
        
        return farmer;
    }
    
    find(filter = {}) {
        return new FarmersCursor(this, filter);
    }
    
    async updateOne(filter, update, options = {}) {
        // Handle nested updates
        const updateData = update.$set || update;
        
        // Extract accounts from update if present
        const accounts = updateData.accounts;
        delete updateData.accounts;
        
        // Handle avatar object
        if (updateData.avatar) {
            updateData.avatarIcon = updateData.avatar.icon;
            updateData.avatarColor = updateData.avatar.color;
            delete updateData.avatar;
        }
        
        // Update base farmer
        const result = await super.updateOne(filter, { $set: updateData }, options);
        
        // Update accounts if provided
        if (accounts) {
            const farmer = await super.findOne(filter);
            if (farmer) {
                await this._updateAccounts(farmer.id, accounts);
            }
        }
        
        return result;
    }
    
    async _updateAccounts(farmerId, accounts) {
        for (const account of accounts) {
            // Upsert account
            const [existingAcc] = await this.pool.execute(
                'SELECT id FROM farmer_accounts WHERE farmer_id = ? AND player_name = ?',
                [farmerId, account.playerName]
            );
            
            let accountId;
            if (existingAcc.length > 0) {
                accountId = existingAcc[0].id;
                await this.pool.execute(
                    `UPDATE farmer_accounts SET 
                        user_id = ?, balance = ?, status = ?, action = ?, is_online = ?, last_update = ?
                     WHERE id = ?`,
                    [
                        account.userId || null,
                        account.balance || 0,
                        account.status || 'idle',
                        account.action || null,
                        account.isOnline || false,
                        new Date(),
                        accountId
                    ]
                );
            } else {
                const [insertResult] = await this.pool.execute(
                    `INSERT INTO farmer_accounts (farmer_id, player_name, user_id, balance, status, action, is_online, last_update)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        farmerId,
                        account.playerName,
                        account.userId || null,
                        account.balance || 0,
                        account.status || 'idle',
                        account.action || null,
                        account.isOnline || false,
                        new Date()
                    ]
                );
                accountId = insertResult.insertId;
            }
            
            // Update brainrots
            if (account.brainrots) {
                // Delete old brainrots
                await this.pool.execute('DELETE FROM farmer_brainrots WHERE account_id = ?', [accountId]);
                
                // Insert new brainrots
                for (const br of account.brainrots) {
                    await this.pool.execute(
                        `INSERT INTO farmer_brainrots (account_id, name, income, income_text, mutation, image_url)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            accountId,
                            br.name,
                            this._parseIncome(br.income),
                            br.incomeText || br.income || null,
                            br.mutation || null,
                            br.imageUrl || null
                        ]
                    );
                }
            }
        }
    }
    
    _parseIncome(income) {
        if (income === null || income === undefined) return 0;
        if (typeof income === 'number') return Math.round(income);
        if (typeof income === 'string') {
            const match = income.match(/[\d.]+/);
            return match ? Math.round(parseFloat(match[0])) : 0;
        }
        return 0;
    }
}

class FarmersCursor extends QueryCursor {
    async toArray() {
        const farmers = await super.toArray();
        // Load nested data for each farmer
        return Promise.all(farmers.map(f => this.collection._loadNested(f)));
    }
}

// ============================================================
// Helper Functions
// ============================================================

function generateAvatar(existingAvatars = []) {
    const usedIcons = new Set(existingAvatars.map(a => a?.icon));
    const usedColors = new Set(existingAvatars.map(a => a?.color));
    
    let icon = AVATAR_ICONS.find(i => !usedIcons.has(i));
    if (!icon) icon = AVATAR_ICONS[Math.floor(Math.random() * AVATAR_ICONS.length)];
    
    let color = AVATAR_COLORS.find(c => !usedColors.has(c));
    if (!color) color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    
    return { icon, color };
}

function generateUsername() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `Aboba_${randomNum}`;
}

// ============================================================
// Rate Limiter Functions
// ============================================================

async function checkGlobalRateLimit(estimatedTokens = 1500) {
    try {
        const p = await getPool();
        const windowStart = Date.now() - GLOBAL_RATE_LIMIT.WINDOW_MS;
        
        const [rows] = await p.execute(
            'SELECT SUM(tokens) as totalTokens, COUNT(*) as totalRequests FROM rate_limits WHERE timestamp >= ?',
            [windowStart]
        );
        
        const currentTokens = rows[0]?.totalTokens || 0;
        const currentRequests = rows[0]?.totalRequests || 0;
        
        if (currentTokens + estimatedTokens > GLOBAL_RATE_LIMIT.MAX_TOKENS_PER_MINUTE) {
            return { allowed: false, reason: 'tokens', currentTokens, currentRequests };
        }
        
        if (currentRequests >= GLOBAL_RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
            return { allowed: false, reason: 'requests', currentTokens, currentRequests };
        }
        
        return { allowed: true, currentTokens, currentRequests };
    } catch (e) {
        console.error('Rate limit check error:', e.message);
        return { allowed: true, error: e.message };
    }
}

async function recordAIUsage(tokens, source = 'unknown') {
    try {
        const p = await getPool();
        await p.execute(
            'INSERT INTO rate_limits (timestamp, tokens, source) VALUES (?, ?, ?)',
            [Date.now(), tokens, source]
        );
        
        // Cleanup old
        const twoMinutesAgo = Date.now() - 120000;
        await p.execute('DELETE FROM rate_limits WHERE timestamp < ?', [twoMinutesAgo]);
    } catch (e) {
        console.error('Record AI usage error:', e.message);
    }
}

async function getAIUsageStats() {
    try {
        const p = await getPool();
        const windowStart = Date.now() - GLOBAL_RATE_LIMIT.WINDOW_MS;
        
        const [rows] = await p.execute(
            'SELECT source, SUM(tokens) as tokens, COUNT(*) as requests FROM rate_limits WHERE timestamp >= ? GROUP BY source',
            [windowStart]
        );
        
        const [total] = await p.execute(
            'SELECT SUM(tokens) as totalTokens, COUNT(*) as totalRequests FROM rate_limits WHERE timestamp >= ?',
            [windowStart]
        );
        
        return {
            bySource: rows,
            total: {
                tokens: total[0]?.totalTokens || 0,
                requests: total[0]?.totalRequests || 0
            },
            limits: GLOBAL_RATE_LIMIT
        };
    } catch (e) {
        console.error('Get AI usage stats error:', e.message);
        return null;
    }
}

// ============================================================
// AI Cache Functions
// ============================================================

async function getAICache(cacheKey) {
    try {
        const p = await getPool();
        const [rows] = await p.execute(
            'SELECT data, timestamp FROM ai_price_cache WHERE cache_key = ?',
            [cacheKey]
        );
        
        if (rows.length === 0) return null;
        
        const { data, timestamp } = rows[0];
        if (Date.now() - timestamp > AI_CACHE_TTL_MS) return null;
        
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
        console.error('Get AI cache error:', e.message);
        return null;
    }
}

async function setAICache(cacheKey, data) {
    // v9.12.87: Skip saving null/undefined data to avoid MySQL constraint error
    if (data === null || data === undefined) {
        console.warn('⚠️ Skipping AI cache save - data is null/undefined for key:', cacheKey);
        return false;
    }
    try {
        const p = await getPool();
        await p.execute(
            `INSERT INTO ai_price_cache (cache_key, data, timestamp) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data), timestamp = VALUES(timestamp)`,
            [cacheKey, JSON.stringify(data), Date.now()]
        );
        return true;
    } catch (e) {
        console.error('Set AI cache error:', e.message);
        return false;
    }
}

async function cleanupAICache() {
    try {
        const p = await getPool();
        const [result] = await p.execute(
            'DELETE FROM ai_price_cache WHERE timestamp < ?',
            [Date.now() - AI_CACHE_TTL_MS * 2]
        );
        if (result.affectedRows > 0) {
            console.log(`🗑️ Cleaned up ${result.affectedRows} expired AI cache entries`);
        }
        return result.affectedRows;
    } catch (e) {
        console.error('Cleanup AI cache error:', e.message);
        return 0;
    }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
    connectToDatabase,
    getPool,
    generateAvatar,
    generateUsername,
    AVATAR_ICONS,
    AVATAR_COLORS,
    // Rate limiter
    checkGlobalRateLimit,
    recordAIUsage,
    getAIUsageStats,
    GLOBAL_RATE_LIMIT,
    // AI Cache
    getAICache,
    setAICache,
    cleanupAICache,
    AI_CACHE_TTL_MS
};
