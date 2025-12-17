/**
 * Тестирование загрузки динамических списков Eldorado
 */

const https = require('https');

const ELDORADO_GAME_ID = '259';

function fetchEldoradoFilters() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'www.eldorado.gg',
            path: `/api/flexibleOffers/filters?gameId=${ELDORADO_GAME_ID}&category=CustomItem&tradeEnvironmentValue0=Brainrot`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        console.log('Requesting:', options.hostname + options.path);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    console.log('\n=== RAW RESPONSE STRUCTURE ===');
                    console.log('Keys:', Object.keys(parsed));
                    
                    if (parsed.tradeEnvironmentFilters) {
                        console.log('\n=== tradeEnvironmentFilters ===');
                        for (const filter of parsed.tradeEnvironmentFilters) {
                            console.log(`\nFilter tradeEnvironmentValue: ${filter.tradeEnvironmentValue}`);
                            console.log('Values count:', filter.values?.length || 0);
                            if (filter.values?.length > 0) {
                                console.log('Sample values:', filter.values.slice(0, 5).map(v => v.value || v));
                            }
                        }
                    }
                    
                    if (parsed.offerAttributeFilters) {
                        console.log('\n=== offerAttributeFilters ===');
                        for (const filter of parsed.offerAttributeFilters) {
                            console.log(`\nFilter name: ${filter.name}`);
                            console.log('Values count:', filter.values?.length || 0);
                            if (filter.values?.length > 0) {
                                console.log('Sample values:', filter.values.slice(0, 5).map(v => v.value || v));
                            }
                        }
                    }
                    
                    // Пробуем другие ключи
                    for (const key of Object.keys(parsed)) {
                        if (key !== 'tradeEnvironmentFilters' && key !== 'offerAttributeFilters') {
                            console.log(`\n=== ${key} ===`);
                            const val = parsed[key];
                            if (Array.isArray(val)) {
                                console.log('Array length:', val.length);
                                if (val.length > 0) {
                                    console.log('Sample:', JSON.stringify(val.slice(0, 3), null, 2));
                                }
                            } else if (typeof val === 'object' && val !== null) {
                                console.log('Object keys:', Object.keys(val));
                            } else {
                                console.log('Value:', val);
                            }
                        }
                    }
                    
                    resolve(parsed);
                } catch (e) {
                    console.error('Parse error:', e.message);
                    console.log('Raw data:', data.substring(0, 500));
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.error('Request error:', e.message);
            resolve(null);
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            console.error('Timeout');
            resolve(null);
        });
        
        req.end();
    });
}

// Также пробуем другой эндпоинт для dropdown значений
function fetchDropdownValues() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'www.eldorado.gg',
            path: `/api/games/${ELDORADO_GAME_ID}/dropdown-values?category=CustomItem`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        console.log('\nRequesting dropdown values:', options.hostname + options.path);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    console.log('\n=== DROPDOWN VALUES ===');
                    console.log('Keys:', Object.keys(parsed));
                    console.log('Sample:', JSON.stringify(parsed, null, 2).substring(0, 1000));
                    resolve(parsed);
                } catch (e) {
                    console.error('Parse error:', e.message);
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.error('Request error:', e.message);
            resolve(null);
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            resolve(null);
        });
        
        req.end();
    });
}

async function main() {
    console.log('='.repeat(60));
    console.log('TESTING ELDORADO DYNAMIC LISTS');
    console.log('='.repeat(60));
    
    await fetchEldoradoFilters();
    await fetchDropdownValues();
}

main().catch(console.error);
