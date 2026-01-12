/**
 * Fix missing offer data - fetch full info from Eldorado
 */
const https = require('https');
const mysql = require('mysql2/promise');

const FARM_KEY = 'FARM-TAES-479W-XJJ8-4M0J';

// Codes that need updating
const CODES_TO_FIX = [
    'CKKQTQEH',  // Ketchuru and Musturu
    '39H3HEHH',  // Chipso and Queso
    '4ZCR5T4Q',  // Los Chicleteiras
    'EWCVSTBU',  // Esok Sekolah
    'MW5WWBRA',  // Guest 666
    'SK2VU4AA',  // La Secret Combinasion
];

function searchCode(code) {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'www.eldorado.gg',
            path: `/api/flexibleOffers?gameId=259&category=CustomItem&te_v0=Brainrot&pageSize=10&pageIndex=1&searchQuery=${encodeURIComponent('#' + code)}`,
            method: 'GET',
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const j = JSON.parse(data);
                    const results = j.results || j.flexibleOffers || [];
                    const match = results.find(i => (i.offer?.offerTitle || '').toUpperCase().includes(code));
                    if (match) {
                        const offer = match.offer || match;
                        resolve({
                            code,
                            found: true,
                            title: offer.offerTitle,
                            price: offer.pricePerUnitInUSD?.amount || 0,
                            eldoradoId: offer.id,
                            seller: match.user?.username,
                            image: offer.mainOfferImage?.originalSizeImage || offer.mainOfferImage?.largeImage,
                            attributes: offer.offerAttributeIdValues
                        });
                    } else {
                        resolve({ code, found: false });
                    }
                } catch (e) {
                    resolve({ code, error: e.message });
                }
            });
        });
        req.on('error', e => resolve({ code, error: e.message }));
        req.setTimeout(15000, () => { req.destroy(); resolve({ code, error: 'timeout' }); });
        req.end();
    });
}

function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    // Pattern: 573.8M/s or $350.0M/s or 1.1K/s or 1.1B/s
    const patterns = [
        /(\d+\.?\d*)\s*B\/s/i,   // Billions
        /(\d+\.?\d*)\s*K\/s/i,   // Thousands (K = 1000)
        /\$?(\d+\.?\d*)\s*M\/s/i, // Millions
        /l\s*\$?(\d+\.?\d*)/i,   // After 'l' separator
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            let value = parseFloat(match[1]);
            if (pattern.source.includes('B')) value *= 1000; // B = 1000 M/s
            if (pattern.source.includes('K')) value *= 1000; // K = 1000 M/s
            return Math.round(value);
        }
    }
    return null;
}

function parseBrainrotName(title) {
    if (!title) return null;
    
    const patterns = [
        /🔥(.+?)\s*[l|]\s*\$?\d/i,
        /🎄(.+?)\s*[l|]\s*\$?\d/i,
        /🌟(.+?)\s*[l|]\s*\$?\d/i,
        /(.+?)\s+l\s+\$?\d/i
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            return match[1].trim();
        }
    }
    
    // Fallback
    const parts = title.split(/[l|]/);
    if (parts[0]) {
        return parts[0].replace(/[🔥🎄🌟✅⚡🚚]/g, '').trim();
    }
    return null;
}

function extractMutation(attributes) {
    if (!attributes) return null;
    const mutationAttr = attributes.find(a => 
        a.name?.toLowerCase() === 'mutation' || 
        a.name?.toLowerCase() === 'mutations'
    );
    return mutationAttr?.value || null;
}

function buildImageUrl(imageName) {
    if (!imageName) return null;
    if (imageName.startsWith('http')) return imageName;
    return `https://eldorado.blob.core.windows.net/images/${imageName}`;
}

(async () => {
    const pool = await mysql.createPool({
        host: '87.120.216.181', port: 3306,
        user: 'farmerpanel', password: 'FpM3Sql!2026Pwd', database: 'farmerpanel'
    });
    
    console.log('Fetching full offer data from Eldorado...\n');
    
    for (const code of CODES_TO_FIX) {
        await new Promise(r => setTimeout(r, 400));
        const data = await searchCode(code);
        
        if (data.error) {
            console.log(`#${code}: ERROR - ${data.error}`);
            continue;
        }
        
        if (!data.found) {
            console.log(`#${code}: NOT FOUND on Eldorado`);
            continue;
        }
        
        console.log(`#${code}: FOUND`);
        console.log(`  Title: ${data.title?.substring(0, 60)}...`);
        console.log(`  Price: $${data.price}`);
        console.log(`  Image: ${data.image ? 'YES' : 'NO'}`);
        
        const brainrotName = parseBrainrotName(data.title);
        const income = parseIncomeFromTitle(data.title);
        const mutation = extractMutation(data.attributes);
        const imageUrl = buildImageUrl(data.image);
        
        console.log(`  Parsed: ${brainrotName} | ${income} M/s | ${mutation || 'no mutation'}`);
        console.log(`  ImageURL: ${imageUrl?.substring(0, 60)}...`);
        
        // Update offers table
        const [r1] = await pool.query(
            `UPDATE offers SET 
                brainrot_name = ?,
                income = ?,
                current_price = ?,
                eldorado_offer_id = ?,
                eldorado_title = ?,
                mutation = ?,
                image_url = ?,
                seller_name = ?,
                status = 'active',
                last_scanned_at = NOW(),
                updated_at = NOW()
            WHERE offer_id = ? AND farm_key = ?`,
            [brainrotName, income, data.price, data.eldoradoId, data.title, mutation, imageUrl, data.seller, code, FARM_KEY]
        );
        console.log(`  offers: ${r1.affectedRows} updated`);
        
        // Update offer_codes table
        const [r2] = await pool.query(
            `UPDATE offer_codes SET 
                brainrot_name = ?,
                income = ?,
                current_price = ?,
                eldorado_offer_id = ?,
                image_url = ?,
                status = 'active',
                last_seen_at = NOW(),
                updated_at = NOW()
            WHERE code = ? AND farm_key = ?`,
            [brainrotName, income, data.price, data.eldoradoId, imageUrl, code, FARM_KEY]
        );
        console.log(`  offer_codes: ${r2.affectedRows} updated`);
        console.log('');
    }
    
    await pool.end();
    console.log('Done!');
})();
