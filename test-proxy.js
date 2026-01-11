/**
 * Test SOCKS5 proxy connection for Eldorado API
 * v10.3.47 - Test proxy sync between cron-scanner and eldorado-price
 * Run with: node test-proxy.js
 */

const https = require('https');

// SOCKS5 Proxy configuration
const SOCKS5_PROXY_URL = process.env.SOCKS5_PROXY_URL || 'socks5://d36230e549169e3261cc:d5be06662f2a8981@gw.dataimpulse.com:824';

// Try to load socks-proxy-agent
let SocksProxyAgent = null;
let proxyAgent = null;

try {
    SocksProxyAgent = require('socks-proxy-agent').SocksProxyAgent;
    console.log('✅ socks-proxy-agent loaded');
} catch (e) {
    console.error('❌ socks-proxy-agent not found:', e.message);
    console.log('Install with: npm install socks-proxy-agent');
    process.exit(1);
}

// Try to load eldorado-price module
let eldoradoPrice = null;
try {
    eldoradoPrice = require('./api/eldorado-price.js');
    console.log('✅ eldorado-price module loaded');
} catch (e) {
    console.warn('⚠️ eldorado-price not loaded:', e.message);
}

// User agents for rotation
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

/**
 * Make a direct request (no proxy) to Eldorado API
 */
async function testDirectRequest(brainrotName = 'Bombardiro Crocodilo') {
    console.log('\n📡 Testing DIRECT request (no proxy)...');
    
    const params = new URLSearchParams({
        gameId: '259',
        pageNumber: '1',
        pageSize: '24',
        sortBy: 'BestValue',
        order: 'Asc'
    });
    params.set('tradeEnvironmentValue2', brainrotName);
    
    const url = 'https://www.eldorado.gg/api/flexibleOffers?' + params.toString();
    console.log('URL:', url.substring(0, 100) + '...');
    
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'User-Agent': USER_AGENTS[0]
            },
            timeout: 15000
        };
        
        const startTime = Date.now();
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const duration = Date.now() - startTime;
                console.log(`   Status: ${res.statusCode}, Duration: ${duration}ms, Data length: ${data.length}`);
                
                if (res.statusCode === 403 || res.statusCode === 429) {
                    if (data.includes('1015') || data.includes('rate limit')) {
                        console.log('   🚫 Cloudflare 1015 rate limit detected!');
                        resolve({ error: 'cloudflare_1015', statusCode: res.statusCode });
                        return;
                    }
                }
                
                try {
                    const json = JSON.parse(data);
                    console.log(`   ✅ Success! totalCount: ${json.recordCount || json.totalCount || 0}`);
                    resolve({ success: true, data: json, duration });
                } catch (e) {
                    if (data.includes('1015') || data.includes('Cloudflare')) {
                        console.log('   🚫 Cloudflare block HTML page');
                        resolve({ error: 'cloudflare_block' });
                    } else {
                        console.log('   ❌ Parse error:', e.message);
                        console.log('   Response preview:', data.substring(0, 200));
                        resolve({ error: e.message });
                    }
                }
            });
        });
        
        req.on('error', (e) => {
            console.log('   ❌ Request error:', e.message);
            resolve({ error: e.message });
        });
        
        req.setTimeout(15000, () => {
            console.log('   ❌ Request timeout');
            req.destroy();
            resolve({ error: 'timeout' });
        });
        
        req.end();
    });
}

/**
 * Make a request through SOCKS5 proxy
 */
async function testProxyRequest(brainrotName = 'Bombardiro Crocodilo') {
    console.log('\n🔀 Testing SOCKS5 PROXY request...');
    console.log('   Proxy URL:', SOCKS5_PROXY_URL.replace(/:[^:@]+@/, ':***@'));
    
    // Create NEW agent for each request (important for connection issues)
    try {
        proxyAgent = new SocksProxyAgent(SOCKS5_PROXY_URL, {
            timeout: 10000  // Add timeout for proxy connection
        });
        console.log('   Proxy agent created');
    } catch (e) {
        console.log('   ❌ Failed to create proxy agent:', e.message);
        return { error: e.message };
    }
    
    const params = new URLSearchParams({
        gameId: '259',
        pageNumber: '1',
        pageSize: '24',
        sortBy: 'BestValue',
        order: 'Asc'
    });
    params.set('tradeEnvironmentValue2', brainrotName);
    
    const url = 'https://www.eldorado.gg/api/flexibleOffers?' + params.toString();
    console.log('   URL:', url.substring(0, 100) + '...');
    
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'User-Agent': USER_AGENTS[1]
            },
            agent: proxyAgent  // Use proxy agent
        };
        
        const startTime = Date.now();
        console.log('   Making request through proxy...');
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                const duration = Date.now() - startTime;
                console.log(`   Status: ${res.statusCode}, Duration: ${duration}ms, Data length: ${data.length}`);
                
                if (res.statusCode === 403 || res.statusCode === 429) {
                    if (data.includes('1015') || data.includes('rate limit')) {
                        console.log('   🚫 Cloudflare 1015 even through proxy!');
                        resolve({ error: 'cloudflare_1015', statusCode: res.statusCode });
                        return;
                    }
                }
                
                try {
                    const json = JSON.parse(data);
                    console.log(`   ✅ PROXY Success! totalCount: ${json.recordCount || json.totalCount || 0}`);
                    resolve({ success: true, data: json, duration });
                } catch (e) {
                    if (data.includes('1015') || data.includes('Cloudflare')) {
                        console.log('   🚫 Cloudflare block HTML page through proxy');
                        resolve({ error: 'cloudflare_block' });
                    } else {
                        console.log('   ❌ Parse error:', e.message);
                        console.log('   Response preview:', data.substring(0, 200));
                        resolve({ error: e.message, rawData: data });
                    }
                }
            });
        });
        
        req.on('error', (e) => {
            const duration = Date.now() - startTime;
            console.log(`   ❌ Request error after ${duration}ms:`, e.message);
            console.log('   Error code:', e.code);
            console.log('   Full error:', e);
            resolve({ error: e.message, code: e.code, duration });
        });
        
        req.setTimeout(20000, () => {
            const duration = Date.now() - startTime;
            console.log(`   ❌ Request timeout after ${duration}ms`);
            req.destroy();
            resolve({ error: 'timeout', duration });
        });
        
        req.end();
    });
}

/**
 * Test proxy with different configurations
 */
async function testProxyWithOptions(brainrotName = 'Bombardiro Crocodilo') {
    console.log('\n🔧 Testing SOCKS5 PROXY with keepAlive disabled...');
    console.log('   Proxy URL:', SOCKS5_PROXY_URL.replace(/:[^:@]+@/, ':***@'));
    
    // Create agent with specific options
    try {
        proxyAgent = new SocksProxyAgent(SOCKS5_PROXY_URL, {
            timeout: 15000,
            keepAlive: false  // Disable keep-alive to avoid socket reuse issues
        });
        console.log('   Proxy agent created with keepAlive=false');
    } catch (e) {
        console.log('   ❌ Failed to create proxy agent:', e.message);
        return { error: e.message };
    }
    
    const params = new URLSearchParams({
        gameId: '259',
        pageNumber: '1',
        pageSize: '24',
        sortBy: 'BestValue',
        order: 'Asc'
    });
    params.set('tradeEnvironmentValue2', brainrotName);
    
    const url = 'https://www.eldorado.gg/api/flexibleOffers?' + params.toString();
    
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Connection': 'close',  // Explicitly close connection
                'User-Agent': USER_AGENTS[0]
            },
            agent: proxyAgent
        };
        
        const startTime = Date.now();
        console.log('   Making request...');
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const duration = Date.now() - startTime;
                console.log(`   Status: ${res.statusCode}, Duration: ${duration}ms, Data length: ${data.length}`);
                
                try {
                    const json = JSON.parse(data);
                    console.log(`   ✅ PROXY Success! totalCount: ${json.recordCount || json.totalCount || 0}`);
                    resolve({ success: true, data: json, duration });
                } catch (e) {
                    console.log('   ❌ Parse error:', e.message);
                    resolve({ error: e.message, rawData: data.substring(0, 500) });
                }
            });
        });
        
        req.on('error', (e) => {
            const duration = Date.now() - startTime;
            console.log(`   ❌ Request error after ${duration}ms:`, e.message);
            resolve({ error: e.message, code: e.code, duration });
        });
        
        req.setTimeout(20000, () => {
            req.destroy();
            resolve({ error: 'timeout' });
        });
        
        req.end();
    });
}

/**
 * Test eldorado-price proxy sync (v10.3.47)
 */
async function testEldoradoPriceProxySync() {
    console.log('\n🔄 Testing eldorado-price module proxy sync...');
    
    if (!eldoradoPrice) {
        console.log('   ⚠️ eldorado-price module not loaded, skipping');
        return { skipped: true };
    }
    
    // Check if proxy control functions are exported
    if (!eldoradoPrice.enableProxyMode) {
        console.log('   ❌ enableProxyMode not exported from eldorado-price');
        return { error: 'enableProxyMode not exported' };
    }
    
    console.log('   ✅ Proxy control functions available');
    console.log('   Current proxy state:', eldoradoPrice.isProxyEnabled ? eldoradoPrice.isProxyEnabled() : 'unknown');
    
    // Enable proxy mode
    console.log('   Enabling proxy mode...');
    eldoradoPrice.enableProxyMode();
    console.log('   Proxy enabled:', eldoradoPrice.isProxyEnabled ? eldoradoPrice.isProxyEnabled() : 'unknown');
    
    // Try a search with proxy enabled
    console.log('   Testing searchBrainrotOffers with proxy...');
    try {
        const result = await eldoradoPrice.searchBrainrotOffers('Bombardiro Crocodilo', 100, 3, {
            disableAI: true,
            mutation: null
        });
        
        if (result.error) {
            console.log('   ❌ Search error:', result.error);
            return { error: result.error };
        }
        
        console.log(`   ✅ Search success! Found ${result.allPageOffers?.length || 0} offers`);
        console.log(`   Upper: ${result.upperOffer ? result.upperOffer.price : 'none'}`);
        
        return { success: true, offers: result.allPageOffers?.length || 0 };
    } catch (e) {
        console.log('   ❌ Search exception:', e.message);
        return { error: e.message };
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('=' .repeat(70));
    console.log('🧪 SOCKS5 Proxy Test for Eldorado API v10.3.47');
    console.log('=' .repeat(70));
    
    // Test 1: Direct request
    const directResult = await testDirectRequest();
    
    // Wait a bit before proxy test
    await new Promise(r => setTimeout(r, 1000));
    
    // Test 2: Proxy request
    const proxyResult = await testProxyRequest();
    
    // Wait a bit before next test
    await new Promise(r => setTimeout(r, 1000));
    
    // Test 3: Proxy with different options
    const proxyResult2 = await testProxyWithOptions();
    
    // Wait a bit before next test
    await new Promise(r => setTimeout(r, 1000));
    
    // Test 4: Eldorado-price module proxy sync (NEW in v10.3.47)
    const eldoradoResult = await testEldoradoPriceProxySync();
    
    // If proxy fails, try multiple times to check if it's intermittent
    if (proxyResult.error || proxyResult2.error) {
        console.log('\n🔄 Proxy failed, testing multiple attempts...');
        for (let i = 0; i < 3; i++) {
            await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds between attempts
            console.log(`\n   Attempt ${i + 2}:`);
            const retryResult = await testProxyRequest();
            if (retryResult.success) {
                console.log('   ✅ Retry succeeded!');
                break;
            }
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 Summary:');
    console.log('='.repeat(70));
    console.log('Direct request:', directResult.success ? '✅ Working' : `❌ Failed: ${directResult.error}`);
    console.log('Proxy request:', proxyResult.success ? '✅ Working' : `❌ Failed: ${proxyResult.error}`);
    console.log('Proxy (keepAlive=false):', proxyResult2.success ? '✅ Working' : `❌ Failed: ${proxyResult2.error}`);
    console.log('Eldorado-price sync:', eldoradoResult.success ? '✅ Working' : (eldoradoResult.skipped ? '⏭️ Skipped' : `❌ Failed: ${eldoradoResult.error}`));
    
    if (directResult.error && directResult.error.includes('1015')) {
        console.log('\n⚠️ Direct request is rate-limited (1015), proxy is needed');
    }
    
    if (proxyResult.error && proxyResult.error === 'Socket closed') {
        console.log('\n⚠️ DIAGNOSIS: "Socket closed" indicates the SOCKS5 proxy connection is being terminated');
        console.log('   Possible causes:');
        console.log('   1. Proxy server rejected the connection (authentication issue)');
        console.log('   2. Proxy server IP is blocked by Eldorado');
        console.log('   3. Proxy connection timeout is too short');
        console.log('   4. Proxy server is overloaded');
        console.log('   \n   Recommendations:');
        console.log('   - Try a different proxy provider');
        console.log('   - Check proxy credentials');
        console.log('   - Use HTTP/HTTPS proxy instead of SOCKS5');
    }
}

runTests().catch(console.error);
