/**
 * Deep analysis of brainrot names for fuzzy matching issues
 */

const fs = require('fs');

// Load data
const eldoradoData = JSON.parse(fs.readFileSync('./data/eldorado-dropdown-lists.json', 'utf8'));
const brainrots = eldoradoData.brainrots;

console.log('=== POTENTIAL CONFUSION PAIRS (same prefix) ===\n');

const brainrotsLower = brainrots.map(b => b.toLowerCase());

// Check for similar prefixes
const prefixGroups = {};
brainrotsLower.forEach(b => {
    const prefix = b.substring(0, 4);
    if (!prefixGroups[prefix]) prefixGroups[prefix] = [];
    prefixGroups[prefix].push(b);
});

Object.entries(prefixGroups)
    .filter(([k, v]) => v.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([prefix, names]) => {
        console.log(`Prefix "${prefix}":`, names.join(', '));
    });

console.log('\n=== BRAINROTS WITH COMMON ENGLISH WORDS ===');
const commonWords = ['spider', 'toilet', 'santa', 'dragon', 'money', 'candy', 'secret', 'golden', 'lucky', 'block', 'elephant', 'strawberry'];
brainrotsLower.forEach(b => {
    commonWords.forEach(w => {
        if (b.includes(w)) console.log(`"${w}" in "${b}"`);
    });
});

console.log('\n=== SHORT UNIQUE WORDS (4-6 chars) IN BRAINROTS ===');
const shortWords = new Set();
brainrotsLower.forEach(b => {
    const words = b.split(/\s+/);
    words.filter(w => w.length >= 4 && w.length <= 6).forEach(w => {
        shortWords.add(w);
    });
});
console.log([...shortWords].sort().join(', '));

console.log('\n=== FUZZY KEY ANALYSIS ===');
// Simulate getFuzzyKey
function getFuzzyKey(str) {
    if (!str) return '';
    const lower = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (lower.length <= 2) return lower;
    const first = lower[0];
    const rest = lower.slice(1).replace(/[aeiou]/g, '');
    return first + rest;
}

// Find brainrots with same fuzzy key
const fuzzyGroups = {};
brainrotsLower.forEach(b => {
    const key = getFuzzyKey(b);
    if (!fuzzyGroups[key]) fuzzyGroups[key] = [];
    fuzzyGroups[key].push(b);
});

console.log('Brainrots with SAME fuzzy key (potential confusion):');
Object.entries(fuzzyGroups)
    .filter(([k, v]) => v.length > 1)
    .forEach(([key, names]) => {
        console.log(`  Key "${key}":`, names.join(' | '));
    });

console.log('\n=== COMMON WORDS vs BRAINROTS FUZZY MATCH ===');
// Test common words against brainrots
const testWords = [
    'trait', 'traits', 'trail', 'trails', 'trade', 'trades', 'trading',
    'christmas', 'holiday', 'santa', 'winter',
    'entrega', 'rapida', 'delivery', 'instant',
    'mutation', 'mutations', 'mutated',
    'spider', 'spiders', 'toilet', 'toilets',
    'hermanos', 'hermano', 'normal', 'normales',
    'account', 'accounts', 'cheap', 'cheapest',
    'skibidi', 'meowl', 'matteo', 'dragon'
];

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

console.log('\nHigh similarity matches (>= 0.88):');
const issues = [];
testWords.forEach(word => {
    brainrotsLower.forEach(brainrot => {
        const sim = stringSimilarity(word, brainrot);
        if (sim >= 0.88) {
            // Check if word is actually PART of the brainrot name
            const isPartOf = brainrot.includes(word) || brainrot.split(/\s+/).some(w => w === word);
            const isRealBrainrot = brainrotsLower.includes(word);
            let status;
            if (isRealBrainrot) {
                status = '✓ OK (is a brainrot)';
            } else if (isPartOf) {
                status = '✓ OK (part of name)';
            } else {
                status = '⚠️ FALSE POSITIVE - ADD TO skipWords';
            }
            issues.push({ word, brainrot, sim, status });
        }
    });
});

issues.sort((a, b) => b.sim - a.sim);
issues.forEach(({ word, brainrot, sim, status }) => {
    console.log(`  "${word}" → "${brainrot}" @ ${(sim*100).toFixed(0)}% ${status}`);
});

console.log('\n=== RECOMMENDATIONS FOR skipWords ===');
const falsePositives = issues.filter(i => !i.status.includes('OK'));
const needToSkip = [...new Set(falsePositives.map(i => i.word))];
console.log('Words causing false positives that should be in skipWords:');
console.log(needToSkip.join(', '));
