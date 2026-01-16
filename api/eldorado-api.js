/**
 * Eldorado API Key Management
 * Handles validation, storage, and usage of personal Eldorado API keys
 */

const crypto = require('crypto');
const { getPool } = require('./_lib/db');

// Encryption key for API keys (should be in env var in production)
const ENCRYPTION_KEY = process.env.ELDORADO_KEY_SECRET || 'fp-eldorado-key-2026-secret-32ch';
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

// Eldorado API base URL
const ELDORADO_API_BASE = 'https://www.eldorado.gg';

// Rate limit retry settings
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Encrypt API key for storage
 */
function encryptApiKey(apiKey) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt API key for usage
 */
function decryptApiKey(encryptedKey) {
    try {
        const [ivHex, encrypted] = encryptedKey.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error('Failed to decrypt API key:', e.message);
        return null;
    }
}

/**
 * Create hash of API key for quick comparison
 */
function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 32);
}

/**
 * Validate Eldorado API key with retry logic
 */
async function validateEldoradoApiKey(apiKey) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Use seller eligibility endpoint to test API key
            const response = await fetch(`${ELDORADO_API_BASE}/api/orders/me/sellerApiEligibility`, {
                method: 'GET',
                headers: {
                    'Authorization': `Api-Key ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'FarmerPanel/1.0'
                },
                timeout: 10000
            });
            
            // Rate limited - retry
            if (response.status === 429) {
                console.log(`[EldoradoAPI] Rate limited, attempt ${attempt}/${MAX_RETRIES}, waiting ${RETRY_DELAY_MS}ms...`);
                lastError = { status: 429, message: 'Rate limited' };
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
                    continue;
                }
                return { valid: false, error: 'Rate limited after retries', retryable: true };
            }
            
            // Unauthorized - invalid key
            if (response.status === 401 || response.status === 403) {
                return { valid: false, error: 'Invalid API key', retryable: false };
            }
            
            // Success
            if (response.ok) {
                const data = await response.json();
                return { 
                    valid: true, 
                    data,
                    message: 'API key validated successfully'
                };
            }
            
            // Other error
            const errorText = await response.text();
            return { valid: false, error: `API error: ${response.status}`, details: errorText, retryable: false };
            
        } catch (e) {
            console.error(`[EldoradoAPI] Validation attempt ${attempt} failed:`, e.message);
            lastError = e;
            
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
                continue;
            }
        }
    }
    
    return { 
        valid: false, 
        error: lastError?.message || 'Connection failed after retries',
        retryable: true 
    };
}

/**
 * Get seller info using API key
 */
async function getSellerInfo(apiKey) {
    try {
        // Try to get seller's offers to extract seller name
        const response = await fetch(`${ELDORADO_API_BASE}/api/predefinedOffers/me?page=1&pageSize=1`, {
            method: 'GET',
            headers: {
                'Authorization': `Api-Key ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'FarmerPanel/1.0'
            },
            timeout: 10000
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                const offer = data.items[0];
                return {
                    sellerName: offer.sellerName || null,
                    sellerId: offer.sellerId || null
                };
            }
        }
        
        return { sellerName: null, sellerId: null };
    } catch (e) {
        console.error('[EldoradoAPI] Failed to get seller info:', e.message);
        return { sellerName: null, sellerId: null };
    }
}

/**
 * API Handler - Validate API key
 * POST /api/eldorado-api/validate
 */
async function handleValidate(req, res) {
    try {
        const { apiKey } = req.body;
        
        if (!apiKey || typeof apiKey !== 'string') {
            return res.status(400).json({ error: 'API key is required' });
        }
        
        // Validate format (example: AbobaStore-Bot-hoSteXrHpC)
        if (apiKey.length < 10 || apiKey.length > 100) {
            return res.status(400).json({ error: 'Invalid API key format' });
        }
        
        const result = await validateEldoradoApiKey(apiKey);
        
        if (result.valid) {
            return res.json({ 
                valid: true, 
                message: 'API key is valid',
                eligible: result.data?.isEligible ?? true
            });
        } else {
            return res.status(result.retryable ? 503 : 400).json({ 
                valid: false, 
                error: result.error,
                retryable: result.retryable
            });
        }
    } catch (e) {
        console.error('[EldoradoAPI] Validate error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * API Handler - Save API key
 * POST /api/eldorado-api/save
 */
async function handleSave(req, res) {
    try {
        const { farmKey, apiKey } = req.body;
        
        if (!farmKey || !apiKey) {
            return res.status(400).json({ error: 'Farm key and API key are required' });
        }
        
        // First validate the API key
        const validationResult = await validateEldoradoApiKey(apiKey);
        
        if (!validationResult.valid) {
            return res.status(400).json({ 
                error: 'API key validation failed',
                details: validationResult.error,
                retryable: validationResult.retryable
            });
        }
        
        // Get seller info
        const sellerInfo = await getSellerInfo(apiKey);
        
        // Encrypt and store
        const encryptedKey = encryptApiKey(apiKey);
        const keyHash = hashApiKey(apiKey);
        
        const pool = await getPool();
        
        await pool.execute(`
            INSERT INTO eldorado_api_keys 
            (farm_key, api_key_hash, api_key_encrypted, seller_name, seller_id, is_active, last_validated_at)
            VALUES (?, ?, ?, ?, ?, TRUE, NOW())
            ON DUPLICATE KEY UPDATE
                api_key_hash = VALUES(api_key_hash),
                api_key_encrypted = VALUES(api_key_encrypted),
                seller_name = VALUES(seller_name),
                seller_id = VALUES(seller_id),
                is_active = TRUE,
                last_validated_at = NOW(),
                validation_error = NULL,
                updated_at = NOW()
        `, [farmKey, keyHash, encryptedKey, sellerInfo.sellerName, sellerInfo.sellerId]);
        
        console.log(`[EldoradoAPI] Saved API key for farm ${farmKey.substring(0, 12)}... seller: ${sellerInfo.sellerName}`);
        
        return res.json({ 
            success: true, 
            message: 'API key saved successfully',
            sellerName: sellerInfo.sellerName
        });
        
    } catch (e) {
        console.error('[EldoradoAPI] Save error:', e);
        return res.status(500).json({ error: 'Failed to save API key' });
    }
}

/**
 * API Handler - Get API key status
 * GET /api/eldorado-api/status?farmKey=XXX
 */
async function handleStatus(req, res) {
    try {
        const { farmKey } = req.query;
        
        if (!farmKey) {
            return res.status(400).json({ error: 'Farm key is required' });
        }
        
        const pool = await getPool();
        
        const [rows] = await pool.execute(`
            SELECT 
                seller_name,
                seller_id,
                telegram_user_id,
                telegram_username,
                telegram_verified,
                is_active,
                last_used_at,
                last_validated_at,
                validation_error,
                created_at
            FROM eldorado_api_keys 
            WHERE farm_key = ?
        `, [farmKey]);
        
        if (rows.length === 0) {
            return res.json({ hasApiKey: false });
        }
        
        const record = rows[0];
        
        return res.json({
            hasApiKey: true,
            isActive: record.is_active,
            sellerName: record.seller_name,
            sellerId: record.seller_id,
            telegramConnected: !!record.telegram_user_id,
            telegramUsername: record.telegram_username,
            telegramVerified: record.telegram_verified,
            lastUsedAt: record.last_used_at,
            lastValidatedAt: record.last_validated_at,
            validationError: record.validation_error,
            createdAt: record.created_at
        });
        
    } catch (e) {
        console.error('[EldoradoAPI] Status error:', e);
        return res.status(500).json({ error: 'Failed to get API key status' });
    }
}

/**
 * API Handler - Reset/Remove API key
 * DELETE /api/eldorado-api/reset?farmKey=XXX
 */
async function handleReset(req, res) {
    try {
        const { farmKey } = req.query;
        
        if (!farmKey) {
            return res.status(400).json({ error: 'Farm key is required' });
        }
        
        const pool = await getPool();
        
        // Delete the API key record
        await pool.execute(`DELETE FROM eldorado_api_keys WHERE farm_key = ?`, [farmKey]);
        
        // Also clear any Telegram sessions linked to this farm key
        await pool.execute(`DELETE FROM telegram_bot_sessions WHERE farm_key = ?`, [farmKey]);
        
        console.log(`[EldoradoAPI] Reset API key for farm ${farmKey.substring(0, 12)}...`);
        
        return res.json({ success: true, message: 'API key removed' });
        
    } catch (e) {
        console.error('[EldoradoAPI] Reset error:', e);
        return res.status(500).json({ error: 'Failed to reset API key' });
    }
}

/**
 * Internal function - Get decrypted API key for farm
 * Used by other modules (Telegram bot, offers API, etc.)
 */
async function getApiKeyForFarm(farmKey) {
    try {
        const pool = await getPool();
        
        const [rows] = await pool.execute(`
            SELECT api_key_encrypted, is_active
            FROM eldorado_api_keys 
            WHERE farm_key = ? AND is_active = TRUE
        `, [farmKey]);
        
        if (rows.length === 0) {
            return null;
        }
        
        const decrypted = decryptApiKey(rows[0].api_key_encrypted);
        
        if (decrypted) {
            // Update last used timestamp
            await pool.execute(`
                UPDATE eldorado_api_keys 
                SET last_used_at = NOW() 
                WHERE farm_key = ?
            `, [farmKey]);
        }
        
        return decrypted;
    } catch (e) {
        console.error('[EldoradoAPI] Failed to get API key for farm:', e.message);
        return null;
    }
}

/**
 * Internal function - Check if farm has active API key
 */
async function hasActiveApiKey(farmKey) {
    try {
        const pool = await getPool();
        
        const [rows] = await pool.execute(`
            SELECT 1 FROM eldorado_api_keys 
            WHERE farm_key = ? AND is_active = TRUE
        `, [farmKey]);
        
        return rows.length > 0;
    } catch (e) {
        console.error('[EldoradoAPI] Failed to check API key:', e.message);
        return false;
    }
}

/**
 * Internal function - Get all farm keys with active API keys
 * Used by cron scanner to skip these users
 */
async function getFarmsWithApiKeys() {
    try {
        const pool = await getPool();
        
        const [rows] = await pool.execute(`
            SELECT farm_key FROM eldorado_api_keys WHERE is_active = TRUE
        `);
        
        return rows.map(r => r.farm_key);
    } catch (e) {
        console.error('[EldoradoAPI] Failed to get farms with API keys:', e.message);
        return [];
    }
}

module.exports = {
    handleValidate,
    handleSave,
    handleStatus,
    handleReset,
    getApiKeyForFarm,
    hasActiveApiKey,
    getFarmsWithApiKeys,
    validateEldoradoApiKey,
    encryptApiKey,
    decryptApiKey
};
