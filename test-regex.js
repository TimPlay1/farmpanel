function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    // B/s паттерны
    const bPatterns = [
        /(\d+[.,]?\d*)\s*B\/S/i,              // 1.0B/S, 1.5 B/s
        /(\d+[.,]?\d*)B\/s/i,                  // 1.5B/s (без пробела)
        /\[(\d+[.,]?\d*)\s*B\/s\]/i,          // [1.5B/s]
        /(\d+[.,]?\d*)\s*b\/sec/i,            // 1b/sec
        /(\d+[.,]?\d*)\s*bil\/s/i,            // 1bil/s
        /(\d+[.,]?\d*)\s*billion/i,           // 1.5 billion
        /(\d+[.,]?\d*)B\s/i,                  // 1B (с пробелом после)
        /(\d+[.,]?\d*)B$/i,                   // 1b (в конце строки)
        /\[(\d+[.,]?\d*)B\]/i,                // [1B]
    ];
    
    for (const pattern of bPatterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            const msValue = value * 1000;
            if (msValue >= 1000 && msValue <= 99999) {
                return msValue;
            }
        }
    }
    
    // M/s паттерны
    const patterns = [
        /(\d+[.,]?\d*)\s*M\/s/i,
        /(\d+[.,]?\d*)\s*m\/sec/i,
        /(\d+[.,]?\d*)\s*mil\/s/i,
        /(\d+[.,]?\d*)\s*M\s/i,
        /(\d+[.,]?\d*)\s*M$/i,
        /(\d+[.,]?\d*)M/i,
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            if (value >= 1 && value <= 9999) {
                return value;
            }
        }
    }
    return null;
}

const tests = [
    'La Secret Combinasion 1.0B/S Radioactive',
    '1.5B/S La Secret Combinasion',
    '🌮1b La Secret Combinasion',
    '[1.2B/S] La Secret',
    '1.4B/s - La Secret Combinasion',
    '2B La Secret',
    'La Secret 1500M/s',
    '1.5B/S 🌮 LA SECRET COMBINASION',
    '⭐1B/s La Secret',
    'La Secret 1.2 B/S',
];
tests.forEach(t => console.log(`"${t}" ->`, parseIncomeFromTitle(t)));
