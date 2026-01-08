/**
 * Тестовый скрипт - проверяем реально ли офферы есть на Eldorado
 */
const https = require('https');

const CODES_TO_CHECK = [
    'R94XGAW9',  // Los Primos 31M/s - pending
    'CLJD87VR',  // Los Primos 310M/s - pending
    '3L4T5QYR',  // Los Primos 31M/s - paused
    'RJ2SET89',  // Garama and Madundung - pending
    'BWV4FWFP',  // Los Bros 30M/s Gold - active
];

function searchEldorado(searchText) {
    return new Promise((resolve) => {
        const queryPath = `/api/flexibleOffers?gameId=259&category=CustomItem&te_v0=Brainrot&pageSize=20&pageIndex=1&searchQuery=${encodeURIComponent(searchText)}`;

        const options = {
            hostname: 'www.eldorado.gg',
            path: queryPath,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    resolve({ error: e.message });
                }
            });
        });

        req.on('error', (e) => resolve({ error: e.message }));
        req.setTimeout(15000, () => {
            req.destroy();
            resolve({ error: 'timeout' });
        });
        req.end();
    });
}

async function checkCodes() {
    console.log('=== Проверка офферов на Eldorado ===\n');
    
    for (const code of CODES_TO_CHECK) {
        console.log(`Ищем #${code}...`);
        
        const result = await searchEldorado(`#${code}`);
        
        if (result.error) {
            console.log(`  ❌ Ошибка: ${result.error}\n`);
            continue;
        }
        
        if (!result.results || result.results.length === 0) {
            console.log(`  ❌ НЕ НАЙДЕН на Eldorado\n`);
            continue;
        }
        
        // Ищем точное совпадение кода
        let found = false;
        for (const item of result.results) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            
            if (title.toUpperCase().includes(code)) {
                const price = offer.pricePerUnitInUSD?.amount || 0;
                const seller = item.user?.username || 'unknown';
                console.log(`  ✅ НАЙДЕН!`);
                console.log(`     Title: ${title.substring(0, 80)}...`);
                console.log(`     Price: $${price}`);
                console.log(`     Seller: ${seller}`);
                found = true;
                break;
            }
        }
        
        if (!found) {
            console.log(`  ⚠️ Результаты есть, но код ${code} не найден в titles`);
            console.log(`     Первый результат: ${(result.results[0]?.offer?.offerTitle || '').substring(0, 60)}`);
        }
        
        console.log('');
        
        // Задержка между запросами
        await new Promise(r => setTimeout(r, 500));
    }
}

checkCodes().catch(console.error);
