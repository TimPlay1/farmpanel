const scanner = require('../api/ai-scanner.js');

async function test() {
    const testOffers = [
        // Regex должен справиться
        { title: '125m/s LA SECRET VERY RARE', price: 5.99 },
        { title: '270M/s Los 67 Fast Delivery', price: 12.50 },
        { title: 'Eviledon 300M DIAMOND', price: 8.00 },
        
        // Сложные случаи - только AI справится
        { title: 'LOS PLANITOS GOLD 450', price: 20.00 },  // Нет M/s но есть число
        { title: 'Eviledon only $7.50 CHEAP', price: 7.50 }, // Цена в title, не income
        { title: 'Fast delivery brainrot god', price: 5.00 }, // Нет income вообще
    ];
    
    console.log('='.repeat(70));
    console.log('REGEX PARSING TEST');
    console.log('='.repeat(70));
    
    for (const o of testOffers) {
        const r = scanner.parseIncomeRegex(o.title);
        const incomeStr = r.income !== null ? `${r.income}M/s` : `(${r.reason})`;
        console.log(`"${o.title.substring(0, 45).padEnd(47)}" -> ${incomeStr}`);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('HYBRID PARSING TEST (Regex + AI fallback)');
    console.log('='.repeat(70));
    
    const lists = await scanner.fetchEldoradoDynamicLists();
    console.log(`\nLoaded: ${lists.brainrots.length} brainrots`);
    
    const results = await scanner.hybridParse(testOffers, lists);
    
    console.log('\nResults:');
    for (const r of results) {
        const incomeStr = r.income !== null ? `${r.income}M/s` : `(${r.reason || 'null'})`;
        console.log(`"${r.title.substring(0, 45).padEnd(47)}" -> ${incomeStr.padEnd(15)} [${r.source}]`);
    }
    
    // Тест findUpperLower
    console.log('\n' + '='.repeat(70));
    console.log('FIND UPPER/LOWER TEST (target: 300 M/s)');
    console.log('='.repeat(70));
    
    const upperLower = scanner.findUpperLower(results, 300);
    console.log('Upper:', upperLower.upper ? `${upperLower.upper.income}M/s @ $${upperLower.upper.price}` : 'not found');
    console.log('Lower:', upperLower.lower ? `${upperLower.lower.income}M/s @ $${upperLower.lower.price}` : 'not found');
}

test().catch(console.error);
