const https = require('https');
const fs = require('fs');
const path = require('path');

function fetch(url) {
    return new Promise((resolve) => {
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            headers: { 'swagger': 'Swager request', 'Accept': 'application/json' }
        };
        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch(e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function main() {
    const uniqueNames = new Set();
    const nameToId = new Map();
    
    console.log('Fetching brainrot names from Eldorado...');
    
    for (let page = 1; page <= 200; page++) {
        const url = 'https://www.eldorado.gg/api/flexibleOffers?gameId=259&category=CustomItem&tradeEnvironmentValue0=Brainrot&pageSize=50&pageIndex=' + page;
        const resp = await fetch(url);
        if (!resp || !resp.results || resp.results.length === 0) break;
        
        for (const item of resp.results) {
            const offer = item.offer || item;
            const brainrotEnv = offer.tradeEnvironmentValues?.find(e => e.name === 'Brainrot');
            if (brainrotEnv && brainrotEnv.value && brainrotEnv.id) {
                const name = brainrotEnv.value;
                const id = brainrotEnv.id;
                if (!uniqueNames.has(name)) {
                    uniqueNames.add(name);
                    nameToId.set(name, id);
                }
            }
        }
        
        if (page % 20 === 0) console.log('Page', page, '- found', uniqueNames.size, 'unique brainrots');
        await new Promise(r => setTimeout(r, 50));
    }
    
    console.log('\nTotal unique brainrots found:', uniqueNames.size);
    
    // Check for specific ones
    const search = ['ginger', 'sekolah'];
    for (const s of search) {
        const matches = [...uniqueNames].filter(n => n.toLowerCase().includes(s));
        console.log('Brainrots with "' + s + '":', matches.join(', '));
    }
    
    // Generate new mapping
    const newMapping = [...nameToId.entries()].map(([name, id]) => ({
        name,
        id,
        price: 1 // Default price
    }));
    
    console.log('\nNew brainrots to add:');
    const existingPath = path.join(__dirname, '../data/eldorado-brainrot-ids.json');
    const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
    const existingNames = new Set(existing.map(e => e.name.toLowerCase()));
    
    const newOnes = newMapping.filter(m => !existingNames.has(m.name.toLowerCase()));
    console.log('New brainrots count:', newOnes.length);
    newOnes.forEach(n => console.log(' +', n.name, '(' + n.id + ')'));
    
    // Merge and save
    const merged = [...existing, ...newOnes];
    merged.sort((a, b) => a.name.localeCompare(b.name));
    
    fs.writeFileSync(existingPath, JSON.stringify(merged, null, 2));
    console.log('\nSaved updated mapping with', merged.length, 'brainrots');
}

main().catch(console.error);
