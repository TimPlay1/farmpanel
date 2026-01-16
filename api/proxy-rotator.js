/**
 * Proxy Rotator for Eldorado API requests
 * Rotates through proxy list on rate limits or blocks
 */

const { HttpsProxyAgent } = require('https-proxy-agent');

// Proxy list (user:pass@ip:port format)
const PROXY_LIST = [
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24929',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24930',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24931',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24932',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24933',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24934',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24935',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24936',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24937',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24938',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24939',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24940',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24941',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24942',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24943',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24944',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24945',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24946',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24947',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24948',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24949',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24950',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24951',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24952',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24953',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24954',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24955',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24956',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24957',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24958',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24959',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24960',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24961',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24962',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24963',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24964',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24965',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24966',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24967',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24968',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24969',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24970',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24971',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24972',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24973',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24974',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24975',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24976',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24977',
    'fivdjgwjcujj:kEAEMPEjch@23.165.240.218:24978'
];

// Current proxy index
let currentProxyIndex = 0;

// Track rate limited proxies with cooldown
const rateLimitedProxies = new Map(); // proxyIndex -> cooldownUntil timestamp
const RATE_LIMIT_COOLDOWN_MS = 60000; // 1 minute cooldown for rate limited proxy

/**
 * Get current proxy URL
 */
function getCurrentProxyUrl() {
    if (PROXY_LIST.length === 0) return null;
    const proxy = PROXY_LIST[currentProxyIndex];
    return `http://${proxy}`;
}

/**
 * Get current proxy agent for fetch
 */
function getProxyAgent() {
    const proxyUrl = getCurrentProxyUrl();
    if (!proxyUrl) return null;
    return new HttpsProxyAgent(proxyUrl);
}

/**
 * Rotate to next available proxy
 * @param {boolean} rateLimited - if true, marks current proxy as rate limited
 * @returns {boolean} - true if rotated successfully, false if all proxies exhausted
 */
function rotateProxy(rateLimited = false) {
    if (PROXY_LIST.length === 0) return false;
    
    // Mark current as rate limited if needed
    if (rateLimited) {
        rateLimitedProxies.set(currentProxyIndex, Date.now() + RATE_LIMIT_COOLDOWN_MS);
        console.log(`[ProxyRotator] Proxy #${currentProxyIndex} rate limited, cooldown 60s`);
    }
    
    // Find next available proxy
    const startIndex = currentProxyIndex;
    let attempts = 0;
    let oldestCooldownIndex = -1;
    let oldestCooldownTime = Infinity;
    
    do {
        currentProxyIndex = (currentProxyIndex + 1) % PROXY_LIST.length;
        attempts++;
        
        // Check if this proxy is still in cooldown
        const cooldownUntil = rateLimitedProxies.get(currentProxyIndex);
        if (!cooldownUntil || Date.now() > cooldownUntil) {
            // Clear expired cooldown
            if (cooldownUntil) rateLimitedProxies.delete(currentProxyIndex);
            console.log(`[ProxyRotator] Switched to proxy #${currentProxyIndex} (port ${PROXY_LIST[currentProxyIndex].split(':').pop()})`);
            return true;
        }
        
        // Track oldest cooldown (will expire soonest)
        if (cooldownUntil < oldestCooldownTime) {
            oldestCooldownTime = cooldownUntil;
            oldestCooldownIndex = currentProxyIndex;
        }
    } while (attempts < PROXY_LIST.length);
    
    // All proxies in cooldown - use the one that will expire soonest
    if (oldestCooldownIndex >= 0) {
        currentProxyIndex = oldestCooldownIndex;
        const remainingSec = Math.ceil((oldestCooldownTime - Date.now()) / 1000);
        console.log(`[ProxyRotator] ⚠️ All ${PROXY_LIST.length} proxies in cooldown!`);
        console.log(`[ProxyRotator] Using proxy #${currentProxyIndex} (cooldown expires in ${remainingSec}s)`);
    }
    return true;
}

/**
 * Get proxy info for logging
 */
function getProxyInfo() {
    if (PROXY_LIST.length === 0) return 'No proxy';
    const proxy = PROXY_LIST[currentProxyIndex];
    const port = proxy.split(':').pop();
    return `Proxy #${currentProxyIndex} (port ${port})`;
}

/**
 * Get stats
 */
function getStats() {
    return {
        totalProxies: PROXY_LIST.length,
        currentIndex: currentProxyIndex,
        rateLimitedCount: rateLimitedProxies.size,
        currentProxy: getProxyInfo()
    };
}

/**
 * Make fetch request with proxy and auto-rotation on rate limit
 * @param {string} url - URL to fetch
 * @param {object} options - fetch options
 * @param {number} maxRetries - max retries on rate limit
 * @returns {Promise<Response>}
 */
async function fetchWithProxy(url, options = {}, maxRetries = 5) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const agent = getProxyAgent();
        
        try {
            const response = await fetch(url, {
                ...options,
                agent
            });
            
            // Rate limited - rotate and retry
            if (response.status === 429) {
                console.log(`[ProxyRotator] Rate limit on attempt ${attempt}, rotating...`);
                rotateProxy(true);
                
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 500)); // Small delay before retry
                    continue;
                }
            }
            
            return response;
            
        } catch (e) {
            console.error(`[ProxyRotator] Fetch error on attempt ${attempt}:`, e.message);
            lastError = e;
            
            // Network error - try next proxy
            rotateProxy(false);
            
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 500));
                continue;
            }
        }
    }
    
    throw lastError || new Error('All proxy attempts failed');
}

module.exports = {
    getProxyAgent,
    getCurrentProxyUrl,
    rotateProxy,
    getProxyInfo,
    getStats,
    fetchWithProxy,
    PROXY_LIST
};
