/**
 * Тест для проверки regex паттернов на определение range офферов
 * 
 * Проблема: офферы типа "Los Mobilis- 88M to 220M/s" не распознавались как range
 * Решение: добавлены паттерны для формата "XX to YY M/s"
 */

// Паттерны из eldorado-price.js
const rangePatterns = [
    /(\d+)\s*[mM]?\s*[-~]\s*(\d+)\s*[mM]\/[sS]/i,          // 150m - 500m/s, 100-500M/s
    /(\d+)\s*[mM]?\s+to\s+(\d+)\s*[mM]\/[sS]/i,             // 88M to 220M/s, 100 to 500M/s
    /(\d+)\s*[mM]?\s*[-~]\s*(\d+)\s*[mM]\s/i,               // 150m - 500m (без /s, но с пробелом после)
    /(\d+)\s*[mM]?\s+to\s+(\d+)\s*[mM]\s/i,                 // 88M to 220M (без /s)
];

// Тестовые случаи
const tests = [
    // Должны определяться как RANGE (null)
    { title: 'Los Mobilis- 88M to 220M/s – Secret – Fast Delivery', isRange: true },
    { title: '⭐ Los Mobilis 88M to 220M/s - Secret', isRange: true },
    { title: '150m - 500m/s Random', isRange: true },
    { title: '100-500M/s Mystery Box', isRange: true },
    { title: '250m~500m/s Spin Wheel', isRange: true },
    { title: '88 to 220M/s Range Offer', isRange: true },
    { title: '100 to 500M/s Los Mobilis', isRange: true },
    { title: 'Los Mobilis 88M to 220M Secret', isRange: true },  // без /s
    
    // НЕ должны определяться как range (одиночные значения)
    { title: 'Los Secret 150M/s', isRange: false },
    { title: 'La Taco 100M/s - Fast Delivery', isRange: false },  // дефис НЕ между числами
    { title: 'Bombonisky 250M/s Diamond', isRange: false },
    { title: 'La Grande 456M/s - Secret', isRange: false },
    { title: '⭐ Los Planitos 300M/s', isRange: false },
    { title: 'Los 67 337.5M/s - Radioactive', isRange: false },
];

console.log('=== Range Pattern Tests ===\n');

let passed = 0;
let failed = 0;

tests.forEach(test => {
    let detected = false;
    let matchInfo = '';
    
    for (const pattern of rangePatterns) {
        const match = test.title.match(pattern);
        if (match) {
            detected = true;
            matchInfo = match[1] + '-' + match[2];
            break;
        }
    }
    
    const success = detected === test.isRange;
    
    if (success) {
        passed++;
        console.log(`✅ PASS: "${test.title}"`);
        console.log(`   Expected: ${test.isRange ? 'RANGE' : 'SINGLE'}, Got: ${detected ? 'RANGE' : 'SINGLE'}`);
    } else {
        failed++;
        console.log(`❌ FAIL: "${test.title}"`);
        console.log(`   Expected: ${test.isRange ? 'RANGE' : 'SINGLE'}, Got: ${detected ? 'RANGE' : 'SINGLE'}`);
        if (matchInfo) console.log(`   Match: ${matchInfo}`);
    }
    console.log('');
});

console.log('=== Results ===');
console.log(`Passed: ${passed}/${tests.length}`);
console.log(`Failed: ${failed}/${tests.length}`);

if (failed === 0) {
    console.log('\n🎉 All tests passed!');
} else {
    console.log('\n⚠️ Some tests failed!');
    process.exit(1);
}
