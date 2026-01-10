/**
 * Analyze brainrot names for fuzzy matching issues
 * Find similar names that might cause false positives
 */

const fs = require('fs');
const path = require('path');

// Load brainrots from Eldorado
const dropdownPath = path.join(__dirname, 'data/eldorado-dropdown-lists.json');
const dropdown = JSON.parse(fs.readFileSync(dropdownPath, 'utf8'));
const eldoradoBrainrots = dropdown.brainrots;

// Load our mapping
const mappingPath = path.join(__dirname, 'data/eldorado-brainrot-ids.json');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const ourBrainrots = mapping.map(m => m.name);

console.log(`Eldorado brainrots: ${eldoradoBrainrots.length}`);
console.log(`Our brainrots: ${ourBrainrots.length}`);

// Fuzzy matching functions from eldorado-price.js
function getFuzzyKey(str) {
    if (!str) return '';
    const lower = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (lower.length <= 2) return lower;
    const first = lower[0];
    const rest = lower.slice(1).replace(/[aeiou]/g, '');
    return first + rest;
}

function stringSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    const a = s1.toLowerCase();
    const b = s2.toLowerCase();
    
    if (a === b) return 1;
    
    const keyA = getFuzzyKey(a);
    const keyB = getFuzzyKey(b);
    if (keyA === keyB && keyA.length >= 4) return 0.9;
    
    if (a.includes(b) || b.includes(a)) return 0.8;
    
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = [...setA].filter(c => setB.has(c)).length;
    const union = new Set([...setA, ...setB]).size;
    const jaccard = intersection / union;
    
    let prefixLen = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] === b[i]) prefixLen++;
        else break;
    }
    const prefixBonus = prefixLen >= 3 ? 0.2 : prefixLen >= 2 ? 0.1 : 0;
    
    return Math.min(1, jaccard + prefixBonus);
}

console.log('\n' + '='.repeat(80));
console.log('1. BRAINROTS WITH SIMILAR FUZZY KEYS (potential conflicts)');
console.log('='.repeat(80));

// Group by fuzzy key
const fuzzyGroups = new Map();
for (const name of eldoradoBrainrots) {
    const key = getFuzzyKey(name);
    if (!fuzzyGroups.has(key)) fuzzyGroups.set(key, []);
    fuzzyGroups.get(key).push(name);
}

// Show groups with multiple brainrots
let conflictCount = 0;
for (const [key, names] of fuzzyGroups) {
    if (names.length > 1) {
        conflictCount++;
        console.log(`\nFuzzy key "${key}":`);
        names.forEach(n => console.log(`  - ${n}`));
    }
}
console.log(`\nTotal conflict groups: ${conflictCount}`);

console.log('\n' + '='.repeat(80));
console.log('2. VERY SIMILAR BRAINROT PAIRS (similarity >= 0.7)');
console.log('='.repeat(80));

const similarPairs = [];
for (let i = 0; i < eldoradoBrainrots.length; i++) {
    for (let j = i + 1; j < eldoradoBrainrots.length; j++) {
        const sim = stringSimilarity(eldoradoBrainrots[i], eldoradoBrainrots[j]);
        if (sim >= 0.7) {
            similarPairs.push({
                a: eldoradoBrainrots[i],
                b: eldoradoBrainrots[j],
                similarity: sim
            });
        }
    }
}

similarPairs.sort((a, b) => b.similarity - a.similarity);
for (const pair of similarPairs) {
    console.log(`${(pair.similarity * 100).toFixed(0)}% | "${pair.a}" <-> "${pair.b}"`);
}
console.log(`\nTotal similar pairs: ${similarPairs.length}`);

console.log('\n' + '='.repeat(80));
console.log('3. COMMON WORDS IN OFFER TITLES vs BRAINROT NAMES');
console.log('='.repeat(80));

// Common words that appear in offer titles
const commonTitleWords = [
    'trait', 'traits', 'trade', 'trading', 'cheap', 'cheapest', 'fast', 'fastest',
    'delivery', 'instant', 'quick', 'asap', 'rare', 'rarest', 'exclusive', 'limited',
    'edition', 'secret', 'brainrot', 'steal', 'roblox', 'account', 'mutation',
    'mutations', 'mutated', 'second', 'seconds', 'minute', 'guaranteed', 'discount',
    'bundle', 'package', 'entrega', 'rapida', 'christmas', 'santa', 'holiday', 'event',
    'spider', 'toilet', 'skibidi', 'meowl', 'trail', 'trails', 'fire', 'speed'
];

console.log('\nChecking common title words against brainrot names...\n');

for (const word of commonTitleWords) {
    // Find brainrots that this word matches with high similarity
    for (const brainrot of eldoradoBrainrots) {
        const sim = stringSimilarity(word, brainrot);
        if (sim >= 0.75) {
            console.log(`⚠️  "${word}" -> "${brainrot}" @ ${(sim * 100).toFixed(0)}%`);
        }
        
        // Also check individual words in brainrot name
        const brainrotWords = brainrot.toLowerCase().split(/\s+/);
        for (const bWord of brainrotWords) {
            if (bWord.length >= 5) {
                const wordSim = stringSimilarity(word, bWord);
                if (wordSim >= 0.8 && word !== bWord) {
                    console.log(`⚠️  "${word}" -> "${bWord}" (from ${brainrot}) @ ${(wordSim * 100).toFixed(0)}%`);
                }
            }
        }
    }
}

console.log('\n' + '='.repeat(80));
console.log('4. SHORT BRAINROT NAMES (high false positive risk)');
console.log('='.repeat(80));

const shortNames = eldoradoBrainrots.filter(n => n.length <= 10);
console.log('\nBrainrots with 10 or fewer characters:');
shortNames.forEach(n => console.log(`  - "${n}" (${n.length} chars)`));

console.log('\n' + '='.repeat(80));
console.log('5. SINGLE WORD BRAINROTS');
console.log('='.repeat(80));

const singleWord = eldoradoBrainrots.filter(n => !n.includes(' '));
console.log('\nSingle-word brainrots (harder to match):');
singleWord.forEach(n => console.log(`  - "${n}"`));

console.log('\n' + '='.repeat(80));
console.log('6. DIFFERENCES BETWEEN OUR LIST AND ELDORADO');
console.log('='.repeat(80));

const ourSet = new Set(ourBrainrots.map(n => n.toLowerCase()));
const eldoradoSet = new Set(eldoradoBrainrots.map(n => n.toLowerCase()));

console.log('\nIn OUR list but NOT in Eldorado:');
for (const name of ourBrainrots) {
    if (!eldoradoSet.has(name.toLowerCase())) {
        console.log(`  - ${name}`);
    }
}

console.log('\nIn Eldorado but NOT in our list:');
for (const name of eldoradoBrainrots) {
    if (!ourSet.has(name.toLowerCase())) {
        console.log(`  - ${name}`);
    }
}

console.log('\n' + '='.repeat(80));
console.log('7. BRAINROT NAME ALIASES (potential typos/variations)');
console.log('='.repeat(80));

// Check for Chimnino/Chimino type issues
const aliasCandidates = [];
for (const our of ourBrainrots) {
    for (const eld of eldoradoBrainrots) {
        if (our.toLowerCase() !== eld.toLowerCase()) {
            const sim = stringSimilarity(our, eld);
            if (sim >= 0.85 && sim < 1) {
                aliasCandidates.push({ our, eldorado: eld, similarity: sim });
            }
        }
    }
}

aliasCandidates.sort((a, b) => b.similarity - a.similarity);
for (const c of aliasCandidates) {
    console.log(`${(c.similarity * 100).toFixed(0)}% | Our: "${c.our}" <-> Eldorado: "${c.eldorado}"`);
}
