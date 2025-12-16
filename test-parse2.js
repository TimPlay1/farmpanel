function parseIncomeValue(incomeText) {
    if (!incomeText && incomeText !== 0) return 0;
    
    if (typeof incomeText === 'number') {
        if (incomeText > 10000) {
            return Math.round(incomeText / 1000000 * 10) / 10;
        }
        return incomeText;
    }
    
    const clean = String(incomeText).replace(/\s+/g, '').toLowerCase();
    
    // Сначала проверяем B/s (billions) - конвертируем в M/s (*1000)
    const bMatch = clean.match(/\$?([\d.]+)b/);
    if (bMatch) {
        return parseFloat(bMatch[1]) * 1000;
    }
    
    // Паттерны: $112.5m/s, 112.5m/s, $112.5 m/s
    const match = clean.match(/\$?([\d.]+)m/);
    if (match) {
        return parseFloat(match[1]);
    }
    
    // Попробуем просто получить число
    const numMatch = clean.match(/[\d.]+/);
    if (numMatch) {
        return parseFloat(numMatch[0]);
    }
    
    return 0;
}

// Тесты
console.log('$406.2M/s:', parseIncomeValue('$406.2M/s'));
console.log('406.2M/s:', parseIncomeValue('406.2M/s'));
console.log('$1.5B/s:', parseIncomeValue('$1.5B/s'));
console.log('1.5B/s:', parseIncomeValue('1.5B/s'));
console.log('100M/s:', parseIncomeValue('100M/s'));
