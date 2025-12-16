// Тест парсинга income из различных форматов title
const testTitles = [
    // B/s formats (1+ B/s range)
    '[1B/S ⚡] La Secret Combinasion - Instant Delivery',
    '💎 LA SECRET COMBINASION 1.B/s 💎',
    'La Secret Combinasion 1.2B/s Radioactive',
    '⭐ La secret combinasion 1.5b/s ⭐',
    'LA SECRET COMBINASION 1B TOP RADIOACTIVE',
    'La secret combinasion 1b',
    '✨ 1B/S LA SECRET COMBINASION! ✨ CHEAP',
    'La Secret Combinasion 1B/s Radioactive',
    '[$1B/s] La Secret Combi',
    
    // M/s formats
    '[125M/s 📌] La Secret Combinasion - Cheapest',
    'La secret combinasion 125M/S |⚡INSTANT',
    '⭐La secret combinasion 125m/s⭐',
    'La Secret Combinasion 156.2M/s ( Gold )',
    '⚫SECRET⚪ La Secret Combinasion (125M/S)',
    '💨 La Secret combinasion 💨 2️⃣ 6️⃣ 9️⃣ Store',  // No income
    '🔥La Secret Combinasion 125M/s🔥',
    '🎃 La Secret Combinasion🎃 125m/s [$125m/s]',
    'La Secret Combinasion 1000M/s',  // 1000 M/s = edge case
    
    // Edge cases
    '46,8M/S La Secret', // comma decimal
    '37.5 M/s Test',
    'Test 500M',
    'Price $125 not income',  // Should NOT parse $125 as income
    'ID: 125 not income',     // Should NOT parse ID as income
];

// Parse function (copy from eldorado-price.js)
function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    // Сначала проверяем B/s (Billions) - они должны конвертироваться в M/s
    const bPatterns = [
        /\[?\$?(\d+[.,]?\d*)\s*B\/s\]?/i,      // 1.5B/s, [1B/S], [$1B/s]
        /(\d+[.,]?\d*)\s*b\/sec/i,              // 1b/sec
        /(\d+[.,]?\d*)\s*bil\/s/i,              // 1bil/s
        /(\d+[.,]?\d*)\s*billion/i,             // 1.5 billion
    ];
    
    for (const pattern of bPatterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            // B/s -> M/s: умножаем на 1000
            const msValue = value * 1000;
            if (msValue >= 1000 && msValue <= 99999) {
                return msValue;
            }
        }
    }
    
    // Затем проверяем M/s паттерны
    const patterns = [
        /(\d+[.,]?\d*)\s*M\/s/i,      // 37.5M/s, 37 M/S
        /(\d+[.,]?\d*)\s*m\/sec/i,    // 37m/sec
        /(\d+[.,]?\d*)\s*mil\/s/i,    // 37mil/s
        /(\d+[.,]?\d*)\s*M\s/i,       // 37M (с пробелом после)
        /(\d+[.,]?\d*)\s*M$/i,        // 37M (в конце строки)
        /(\d+[.,]?\d*)M/i,            // 37.5M (без пробела)
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            // Проверяем что это разумное значение M/s (не цена и не ID)
            if (value >= 1 && value <= 9999) {
                return value;
            }
        }
    }
    return null;
}

console.log('=== Testing income parsing ===\n');

testTitles.forEach((title, i) => {
    const income = parseIncomeFromTitle(title);
    const incomeStr = income ? `${income} M/s` : 'NOT FOUND';
    const bsNote = income && income >= 1000 ? ` (${income/1000}B/s)` : '';
    console.log(`${i+1}. ${incomeStr}${bsNote}`);
    console.log(`   "${title.substring(0, 50)}..."`);
    console.log();
});
