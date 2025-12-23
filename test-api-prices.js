/**
 * Force refresh prices via API call (no MongoDB needed)
 * Just tests that API returns correct values
 */

const http = require('http');
const https = require('https');

const API_BASE = 'https://farmpanel.vercel.app/api'; // или локальный сервер

const testBrainrots = [
    { name: 'Esok Sekolah', income: 150 },
    { name: 'Chimnino', income: 185.5 },
    { name: 'Chimnino', income: 190 },
    { name: 'Los Mobilis', income: 363 },
    { name: 'Los Mobilis', income: 360 },
];

async function fetchPrice(name, income) {
    return new Promise((resolve, reject) => {
        const url = `${API_BASE}/eldorado-price?name=${encodeURIComponent(name)}&income=${income}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function testPrices() {
    console.log('Testing API prices...\n');
    
    for (const br of testBrainrots) {
        try {
            console.log(`${br.name} @ ${br.income}M/s:`);
            const result = await fetchPrice(br.name, br.income);
            
            if (result.error) {
                console.log(`  Error: ${result.error}`);
            } else {
                console.log(`  suggestedPrice: $${result.suggestedPrice?.toFixed(2) || 'N/A'}`);
                console.log(`  medianPrice: $${result.medianPrice?.toFixed(2) || 'N/A'}`);
                console.log(`  nextCompetitorPrice: $${result.nextCompetitorPrice?.toFixed(2) || 'N/A'}`);
                if (result.nextCompetitorData) {
                    console.log(`  nextCompetitorData: ${result.nextCompetitorData.income}M/s @ $${result.nextCompetitorData.price}`);
                }
            }
            console.log('');
            
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            console.log(`  Exception: ${e.message}\n`);
        }
    }
}

testPrices();
