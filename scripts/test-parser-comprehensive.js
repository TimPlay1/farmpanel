/**
 * Comprehensive parser test - tests regex parsing with real-world offers
 * Run: node scripts/test-parser-comprehensive.js
 */

const scanner = require('../api/ai-scanner.js');

// Real-world test cases from Eldorado
const testCases = [
    // === ДОЛЖНЫ ПАРСИТЬСЯ КОРРЕКТНО ===
    { title: '125m/s⭐️LA SECRET⭐️VERY RARE⭐️VERY CHEAP⭐️RAPID DELIVERY', expected: 125 },
    { title: '270M/s Los 67 Fast Delivery', expected: 270 },
    { title: 'Eviledon 300M DIAMOND', expected: 300 },
    { title: '645M/s Esok Sekolah - Instant Delivery', expected: 645 },
    { title: '🔥 1.5B/s La Secret Combinasion 🔥', expected: 1500 },
    { title: 'Los Planitos 240.5M/s GOLD MUTATION', expected: 240.5 },
    { title: '96.2M/s Los Nooo My Hotspotsitos', expected: 96.2 },
    { title: 'Mieteteira Bicicleteira 351M/s Diamond', expected: 351 },
    { title: '⭐ 500M/s ⭐ INSTANT DELIVERY ⭐ CHEAP', expected: 500 },
    { title: 'La Ginger Sekolah 618.7M/s FAST', expected: 618.7 },
    { title: '52.2M/s Yin-Yang - Other', expected: 52.2 },
    { title: 'Tictac Sahur 375M/s - Diamond Mutation', expected: 375 },
    { title: '🌟 CHEAP 🌟 Los Mobilis 253M/s', expected: 253 },
    { title: 'Chimnino 266M/s Gold #GS123', expected: 266 },
    { title: '$6.00 - Los 67 337.5M/s RAINBOW', expected: 337.5 },
    { title: 'Eviledon 283.5M/s Fast Delivery #ABC', expected: 283.5 },
    { title: '225M/s Esok Sekolah instant', expected: 225 },
    { title: 'LA SECRET 125m/s VERY RARE', expected: 125 },  // m/s в середине
    { title: '🔥FAST DELIVERY🔥 390M/s Mieteteira', expected: 390 },
    { title: 'Los Spaghettis 180 M/s GOLD', expected: 180 },
    
    // === B/s (BILLIONS) ===
    { title: 'La Secret Combinasion 1.5B/s', expected: 1500 },
    { title: '2.7B/s La Supreme - FAST', expected: 2700 },
    { title: '1B/s Los Lucky Block', expected: 1000 },
    
    // === RANGES (должны быть null) ===
    { title: '0-24M/s Random Brainrot', expected: null, reason: 'range' },
    { title: '50-100M/s Spin Wheel', expected: null, reason: 'range' },
    { title: '100->250m/s Mystery Box', expected: null, reason: 'range' },
    { title: '150m ~ 300m/s Random', expected: null, reason: 'range' },
    
    // === RANDOM/MYSTERY (должны быть null) ===
    { title: 'SPIN THE WHEEL! Any brainrot', expected: null, reason: 'random' },
    { title: 'Random M/s Mystery Box', expected: null, reason: 'random' },
    { title: 'Lucky Spin - Get any brainrot!', expected: null, reason: 'random' },
    
    // === СЛОЖНЫЕ СЛУЧАИ ===
    { title: 'LOS PLANITOS GOLD 450', expected: null },  // Нет M/s, просто число
    { title: 'Eviledon only $7.50 CHEAP', expected: null },  // Только цена
    { title: 'Fast delivery brainrot god', expected: null },  // Нет income
    { title: 'BEST PRICE $9.99 - Tictac', expected: null },  // Только цена
    { title: '⭐️INSTANT⭐️DELIVERY⭐️', expected: null },  // Только эмодзи и слова
    
    // === EDGE CASES ===
    { title: '18,5M/s Esok Sekolah', expected: 18.5 },  // Запятая как десятичный разделитель
    { title: '531K/s Small Brainrot', expected: 0.531 },  // K (thousands)
    { title: '1 B/s Secret', expected: 1000 },  // Пробел перед B/s
    { title: '125 m / s La Grande', expected: 125 },  // Пробелы вокруг /
    { title: '300M Los 67 Diamond', expected: 300 },  // M без /s
    { title: '200mil/s Rare Item', expected: 200 },  // mil вместо M
];

console.log('='.repeat(100));
console.log('COMPREHENSIVE PARSER TEST');
console.log('='.repeat(100));
console.log();

let passed = 0;
let failed = 0;
const failures = [];

for (const test of testCases) {
    const result = scanner.parseIncomeRegex(test.title);
    const actualIncome = result.income;
    const expectedIncome = test.expected;
    
    let isPass = false;
    
    if (expectedIncome === null) {
        // Ожидаем null
        isPass = actualIncome === null;
        if (test.reason && result.reason !== test.reason) {
            isPass = false; // Reason тоже должен совпадать
        }
    } else {
        // Ожидаем конкретное число (допуск 0.01 для float)
        isPass = actualIncome !== null && Math.abs(actualIncome - expectedIncome) < 0.01;
    }
    
    const status = isPass ? '✓' : '✗';
    const expectedStr = expectedIncome !== null ? `${expectedIncome}M/s` : `null (${test.reason || 'no_pattern'})`;
    const actualStr = actualIncome !== null ? `${actualIncome}M/s` : `null (${result.reason})`;
    
    if (isPass) {
        passed++;
        console.log(`${status} ${test.title.substring(0, 55).padEnd(57)} │ Expected: ${expectedStr.padEnd(20)} │ Got: ${actualStr}`);
    } else {
        failed++;
        console.log(`${status} ${test.title.substring(0, 55).padEnd(57)} │ Expected: ${expectedStr.padEnd(20)} │ Got: ${actualStr} <<<`);
        failures.push({ title: test.title, expected: expectedStr, actual: actualStr });
    }
}

console.log();
console.log('='.repeat(100));
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
console.log('='.repeat(100));

if (failures.length > 0) {
    console.log('\nFAILED TESTS:');
    for (const f of failures) {
        console.log(`  - "${f.title}"`);
        console.log(`    Expected: ${f.expected}, Got: ${f.actual}`);
    }
}

// Test summary
const successRate = ((passed / testCases.length) * 100).toFixed(1);
console.log(`\nSuccess Rate: ${successRate}%`);
