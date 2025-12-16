// Тест: La Secret Combinasion через реальный API
const { calculateOptimalPrice, searchBrainrotOffers } = require('./api/eldorado-price.js');

async function testLaSecret() {
    const brainrot = 'La Secret Combinasion';
    const income = 1500; // 1.5 B/s = 1500 M/s
    
    console.log(`\n=== Testing ${brainrot} @ ${income}M/s (1.5B/s) ===\n`);
    
    try {
        // Ищем офферы
        const search = await searchBrainrotOffers(brainrot, income);
        console.log('Target M/s range:', search.targetMsRange);
        console.log('All offers found:', search.allOffers.length);
        console.log('Matching range (1+ B/s):', search.matchingRangeOffers.length);
        
        // Показываем офферы в 1+ B/s диапазоне
        console.log('\n=== 1+ B/s offers (sorted by price) ===');
        const bsOffers = search.matchingRangeOffers.slice(0, 15);
        
        // Парсим для анализа
        const parsed = [];
        for (const item of bsOffers) {
            const o = item.offer || item;
            const title = o.offerTitle || '';
            const price = o.pricePerUnitInUSD?.amount || 0;
            
            // Parse income
            let inc = null;
            // B/s patterns
            const bPat = [
                /\[?\$?(\d+[.,]?\d*)\s*B\/s\]?/i,
                /(\d+[.,]?\d*)B\s/i,
                /(\d+[.,]?\d*)B$/i,
                /\[(\d+[.,]?\d*)B\]/i,
            ];
            for (const p of bPat) {
                const m = title.match(p);
                if (m) {
                    inc = parseFloat(m[1].replace(',', '.')) * 1000;
                    break;
                }
            }
            // M/s patterns
            if (!inc) {
                const mPat = [/(\d+[.,]?\d*)\s*M\/s/i, /(\d+[.,]?\d*)M/i];
                for (const p of mPat) {
                    const m = title.match(p);
                    if (m) {
                        inc = parseFloat(m[1].replace(',', '.'));
                        if (inc >= 1 && inc <= 9999) break;
                        inc = null;
                    }
                }
            }
            
            parsed.push({ title, price, income: inc });
            
            const incStr = inc ? (inc >= 1000 ? `${inc/1000}B/s` : `${inc}M/s`) : '?';
            console.log(`$${price.toFixed(2)} | ${incStr} | ${title.substring(0, 55)}`);
        }
        
        // Анализ upper/lower
        const withIncome = parsed.filter(o => o.income && o.income > 0);
        const upper = withIncome.filter(o => o.income >= income).sort((a,b) => a.price - b.price);
        const lower = withIncome.filter(o => o.income < income).sort((a,b) => b.income - a.income);
        
        console.log('\n=== Analysis ===');
        console.log('Our income:', income, 'M/s (1.5B/s)');
        console.log('Offers with parsed income:', withIncome.length);
        console.log('Upper (income >= 1500):', upper.length);
        console.log('Lower (income < 1500):', lower.length);
        
        if (upper.length > 0) {
            console.log('\nBest upper:', upper[0].income/1000 + 'B/s @', '$' + upper[0].price.toFixed(2));
        }
        if (lower.length > 0) {
            console.log('Best lower:', lower[0].income/1000 + 'B/s @', '$' + lower[0].price.toFixed(2));
        }
        
        // Теперь вызываем calculateOptimalPrice
        console.log('\n=== calculateOptimalPrice Result ===');
        const result = await calculateOptimalPrice(brainrot, income);
        console.log(JSON.stringify(result, null, 2));
        
    } catch (err) {
        console.error('Error:', err);
    }
}

testLaSecret();
