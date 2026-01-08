/**
 * MySQL Client Utility - Replacement for MongoDB utilities
 * Use this module in all utility scripts instead of MongoClient
 */

const mysql = require('mysql2/promise');

// MySQL connection settings
const MYSQL_URI = process.env.MYSQL_URI || 'mysql://farmerpanel:FpM3Sql!2026Pwd@87.120.216.181:3306/farmerpanel';

// Parse MySQL URI
function parseUri(uri) {
    const match = uri.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) {
        throw new Error('Invalid MYSQL_URI format. Expected: mysql://user:password@host:port/database');
    }
    return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4]),
        database: match[5]
    };
}

// Create connection pool
let pool = null;

async function getPool() {
    if (!pool) {
        const config = parseUri(MYSQL_URI);
        pool = mysql.createPool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }
    return pool;
}

/**
 * Get MySQL connection (MongoDB-like interface)
 */
async function connect() {
    const pool = await getPool();
    return new MySQLClient(pool);
}

/**
 * MySQL Client with MongoDB-like methods
 */
class MySQLClient {
    constructor(pool) {
        this.pool = pool;
    }

    db(name) {
        // In MySQL we always use the same database
        return new MySQLDatabase(this.pool);
    }

    async close() {
        if (pool) {
            await pool.end();
            pool = null;
        }
    }
}

/**
 * Database wrapper
 */
class MySQLDatabase {
    constructor(pool) {
        this.pool = pool;
    }

    collection(name) {
        return new MySQLCollection(this.pool, name);
    }

    async listCollections() {
        const [rows] = await this.pool.query('SHOW TABLES');
        const tables = rows.map(row => {
            const key = Object.keys(row)[0];
            return { name: row[key] };
        });
        return {
            toArray: async () => tables
        };
    }
}

/**
 * Collection wrapper with MongoDB-like interface
 */
class MySQLCollection {
    constructor(pool, tableName) {
        this.pool = pool;
        this.tableName = this.mapTableName(tableName);
    }

    mapTableName(name) {
        const mapping = {
            'farmers': 'farmers',
            'offer_codes': 'offer_codes',
            'offers': 'offers',
            'price_cache': 'price_cache',
            'global_brainrot_prices': 'global_brainrot_prices',
            'balance_history': 'balance_history',
            'scan_state': 'scan_state',
            'ai_queue': 'ai_queue',
            'ai_price_cache': 'ai_price_cache',
            'rate_limits': 'rate_limits',
            'user_colors': 'user_colors',
            'top_cache': 'top_cache',
            'generations': 'generations',
            'queues': 'queues',
            'delete_queues': 'delete_queues',
            'adjustment_queue': 'adjustment_queue',
            'farmer_accounts': 'farmer_accounts',
            'farmer_brainrots': 'farmer_brainrots',
            'account_avatars': 'account_avatars'
        };
        return mapping[name] || name;
    }

    async countDocuments(filter = {}) {
        const { where, values } = this.buildWhere(filter);
        const sql = `SELECT COUNT(*) as count FROM ${this.tableName}${where}`;
        const [rows] = await this.pool.query(sql, values);
        return rows[0].count;
    }

    find(filter = {}) {
        return new QueryCursor(this.pool, this.tableName, filter, this);
    }

    async findOne(filter = {}) {
        const results = await this.find(filter).limit(1).toArray();
        return results[0] || null;
    }

    async insertOne(doc) {
        const columns = Object.keys(doc).map(k => this.toSnakeCase(k));
        const placeholders = columns.map(() => '?');
        const values = Object.values(doc);
        
        const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
        const [result] = await this.pool.query(sql, values);
        return { insertedId: result.insertId };
    }

    async updateOne(filter, update) {
        const { where, values: whereValues } = this.buildWhere(filter);
        const { set, values: setValues } = this.buildUpdate(update);
        
        const sql = `UPDATE ${this.tableName} SET ${set}${where} LIMIT 1`;
        const [result] = await this.pool.query(sql, [...setValues, ...whereValues]);
        return { modifiedCount: result.affectedRows };
    }

    async updateMany(filter, update) {
        const { where, values: whereValues } = this.buildWhere(filter);
        const { set, values: setValues } = this.buildUpdate(update);
        
        const sql = `UPDATE ${this.tableName} SET ${set}${where}`;
        const [result] = await this.pool.query(sql, [...setValues, ...whereValues]);
        return { modifiedCount: result.affectedRows };
    }

    async deleteOne(filter) {
        const { where, values } = this.buildWhere(filter);
        const sql = `DELETE FROM ${this.tableName}${where} LIMIT 1`;
        const [result] = await this.pool.query(sql, values);
        return { deletedCount: result.affectedRows };
    }

    async deleteMany(filter) {
        const { where, values } = this.buildWhere(filter);
        const sql = `DELETE FROM ${this.tableName}${where}`;
        const [result] = await this.pool.query(sql, values);
        return { deletedCount: result.affectedRows };
    }

    buildWhere(filter) {
        if (!filter || Object.keys(filter).length === 0) {
            return { where: '', values: [] };
        }

        const conditions = [];
        const values = [];

        for (const [key, value] of Object.entries(filter)) {
            const column = this.toSnakeCase(key);
            
            if (value === null) {
                conditions.push(`${column} IS NULL`);
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                // Handle operators like $gte, $lte, $in, $regex
                for (const [op, opValue] of Object.entries(value)) {
                    switch (op) {
                        case '$gte':
                            conditions.push(`${column} >= ?`);
                            values.push(opValue);
                            break;
                        case '$gt':
                            conditions.push(`${column} > ?`);
                            values.push(opValue);
                            break;
                        case '$lte':
                            conditions.push(`${column} <= ?`);
                            values.push(opValue);
                            break;
                        case '$lt':
                            conditions.push(`${column} < ?`);
                            values.push(opValue);
                            break;
                        case '$ne':
                            conditions.push(`${column} != ?`);
                            values.push(opValue);
                            break;
                        case '$in':
                            if (Array.isArray(opValue) && opValue.length > 0) {
                                conditions.push(`${column} IN (${opValue.map(() => '?').join(', ')})`);
                                values.push(...opValue);
                            }
                            break;
                        case '$nin':
                            if (Array.isArray(opValue) && opValue.length > 0) {
                                conditions.push(`${column} NOT IN (${opValue.map(() => '?').join(', ')})`);
                                values.push(...opValue);
                            }
                            break;
                        case '$regex':
                            conditions.push(`${column} REGEXP ?`);
                            values.push(opValue.source || opValue);
                            break;
                    }
                }
            } else if (value instanceof RegExp) {
                conditions.push(`${column} REGEXP ?`);
                values.push(value.source);
            } else {
                conditions.push(`${column} = ?`);
                values.push(value);
            }
        }

        return {
            where: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
            values
        };
    }

    buildUpdate(update) {
        const sets = [];
        const values = [];
        
        const data = update.$set || update;
        
        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('$')) continue;
            const column = this.toSnakeCase(key);
            sets.push(`${column} = ?`);
            values.push(value);
        }
        
        return { set: sets.join(', '), values };
    }

    toSnakeCase(str) {
        if (str === '_id') return 'id';
        return str.replace(/([A-Z])/g, '_$1').toLowerCase();
    }
}

/**
 * Query cursor for find() operations
 */
class QueryCursor {
    constructor(pool, tableName, filter, collection) {
        this.pool = pool;
        this.tableName = tableName;
        this.filter = filter;
        this.collection = collection;
        this._limit = null;
        this._skip = null;
        this._sort = null;
    }

    limit(n) {
        this._limit = n;
        return this;
    }

    skip(n) {
        this._skip = n;
        return this;
    }

    sort(sortObj) {
        this._sort = sortObj;
        return this;
    }

    async toArray() {
        const { where, values } = this.collection.buildWhere(this.filter);
        
        let sql = `SELECT * FROM ${this.tableName}${where}`;
        
        if (this._sort) {
            const sortParts = [];
            for (const [key, dir] of Object.entries(this._sort)) {
                const column = this.collection.toSnakeCase(key);
                sortParts.push(`${column} ${dir === -1 ? 'DESC' : 'ASC'}`);
            }
            if (sortParts.length > 0) {
                sql += ` ORDER BY ${sortParts.join(', ')}`;
            }
        }
        
        if (this._limit) {
            sql += ` LIMIT ${this._limit}`;
        }
        
        if (this._skip) {
            sql += ` OFFSET ${this._skip}`;
        }
        
        const [rows] = await this.pool.query(sql, values);
        
        // Convert snake_case to camelCase in results
        return rows.map(row => this.toCamelCase(row));
    }

    toCamelCase(obj) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            result[camelKey] = value;
        }
        // Add _id alias for compatibility
        if (result.id !== undefined) {
            result._id = result.id;
        }
        return result;
    }
}

/**
 * Special function to get farmers with nested accounts and brainrots
 */
async function getFarmersWithBrainrots(filter = {}) {
    const pool = await getPool();
    const db = new MySQLDatabase(pool);
    
    // Get farmers
    const farmers = await db.collection('farmers').find(filter).toArray();
    
    // Load accounts and brainrots for each farmer
    for (const farmer of farmers) {
        const [accounts] = await pool.query(
            'SELECT * FROM farmer_accounts WHERE farmer_id = ?',
            [farmer.id]
        );
        
        farmer.accounts = [];
        for (const acc of accounts) {
            const account = {
                id: acc.id,
                oderId: acc.order_id,
                username: acc.username,
                displayName: acc.display_name,
                robloxId: acc.roblox_id,
                floor: acc.floor,
                maxSlots: acc.max_slots,
                lastSync: acc.last_sync,
                brainrots: []
            };
            
            const [brainrots] = await pool.query(
                'SELECT * FROM farmer_brainrots WHERE account_id = ?',
                [acc.id]
            );
            
            account.brainrots = brainrots.map(b => ({
                id: b.id,
                name: b.name,
                income: b.income,
                incomeRaw: b.income_raw,
                mutation: b.mutation,
                traits: b.traits,
                podiumIndex: b.podium_index,
                floor: b.floor,
                imageUrl: b.image_url
            }));
            
            farmer.accounts.push(account);
        }
    }
    
    return farmers;
}

module.exports = {
    connect,
    getPool,
    MySQLClient,
    MySQLDatabase,
    MySQLCollection,
    getFarmersWithBrainrots,
    MYSQL_URI
};
