/**
 * Quick API Test with MySQL backend
 * Тестирует основные API эндпоинты через HTTP
 */

// Set environment
process.env.MYSQL_URI = 'mysql://farmerpanel:FpM3Sql!2026Pwd@87.120.216.181:3306/farmerpanel';
process.env.PORT = '3456';

const http = require('http');

const BASE_URL = 'http://localhost:3456';

async function fetch(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        }).on('error', reject);
    });
}

async function testAPI() {
    console.log('🧪 Testing API endpoints with MySQL backend...\n');
    
    // Give server time to start
    await new Promise(r => setTimeout(r, 2000));
    
    const tests = [
        {
            name: 'Status endpoint',
            url: '/api/status?farmKey=FARM-KFRV-UPE4-U2WJ-JOE6'
        },
        {
            name: 'Offers endpoint', 
            url: '/api/offers?farmKey=FARM-KFRV-UPE4-U2WJ-JOE6'
        },
        {
            name: 'Prices endpoint',
            url: '/api/prices?farmKey=FARM-KFRV-UPE4-U2WJ-JOE6'
        },
        {
            name: 'Balance history',
            url: '/api/balance-history?farmKey=FARM-KFRV-UPE4-U2WJ-JOE6'
        },
        {
            name: 'Scan status',
            url: '/api/scan-status'
        }
    ];
    
    for (const test of tests) {
        try {
            console.log(`📡 Testing: ${test.name}`);
            const result = await fetch(BASE_URL + test.url);
            
            if (result.status === 200) {
                console.log(`   ✅ Status: ${result.status}`);
                if (typeof result.data === 'object') {
                    console.log(`   Data keys: ${Object.keys(result.data).join(', ')}`);
                }
            } else {
                console.log(`   ⚠️ Status: ${result.status}`);
                console.log(`   Response: ${JSON.stringify(result.data).substring(0, 100)}`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Tests complete!');
}

// Run tests
testAPI().catch(console.error);
