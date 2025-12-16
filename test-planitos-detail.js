// Тест: детально изучаем Los Planitos в диапазоне 200-250 M/s
const { searchBrainrotOffers } = require('./api/eldorado-price.js');

async function analyzeLosPlanitos() {
    const brainrotName = 'Los Planitos';
    const ourIncome = 240.5;
    
    console.log(`\n=== Analyzing ${brainrotName} @ ${ourIncome}M/s ===\n`);
    
    try {
        const searchResult = await searchBrainrotOffers(brainrotName, ourIncome);
        const { matchingRangeOffers } = searchResult;
        
        // Парсим все офферы
        const parsedOffers = [];
        for (const item of matchingRangeOffers) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            const price = offer.pricePerUnitInUSD?.amount || 0;
            const msAttr = offer.offerAttributeIdValues?.find(a => a.name === 'M/s');
            
            let income = null;
            const patterns = [
                /(\d+(?:\.\d+)?)\s*M\/s/i,
                /(\d+(?:\.\d+)?)\s*m\/sec/i,
                /(\d+(?:\.\d+)?)\s*M\s/i,
                /(\d+(?:\.\d+)?)\s*M$/i,
                /(\d+(?:\.\d+)?)M/i,
            ];
            for (const pattern of patterns) {
                const match = title.match(pattern);
                if (match) {
                    const value = parseFloat(match[1]);
                    if (value >= 1 && value <= 9999) {
                        income = value;
                        break;
                    }
                }
            }
            
            const incomeFromTitle = !!income;
            if (!income && msAttr?.value) {
                const rangeMatch = msAttr.value.match(/(\d+)-(\d+)/);
                if (rangeMatch) {
                    income = parseInt(rangeMatch[1]);
                }
            }
            
            if (price > 0) {
                parsedOffers.push({
                    title: title.substring(0, 60),
                    income: income || 0,
                    price,
                    msRange: msAttr?.value,
                    incomeFromTitle
                });
            }
        }
        
        // Сортируем по income
        parsedOffers.sort((a, b) => a.income - b.income);
        
        console.log(`=== All offers in 100-249 M/s range (sorted by income) ===`);
        parsedOffers.forEach((o, i) => {
            const marker = o.income >= ourIncome ? '↑UPPER' : '↓LOWER';
            const source = o.incomeFromTitle ? 'exact' : 'fallback';
            console.log(`${i+1}. ${o.income}M/s @ $${o.price.toFixed(2)} | ${marker} | ${source} | ${o.title}...`);
        });
        
        // Разделяем на upper и lower
        const offersWithExact = parsedOffers.filter(o => o.incomeFromTitle);
        const upper = offersWithExact.filter(o => o.income >= ourIncome).sort((a, b) => a.price - b.price);
        const lower = offersWithExact.filter(o => o.income < ourIncome);
        
        console.log(`\n=== UPPER offers (income >= ${ourIncome}) - sorted by price ===`);
        upper.forEach((o, i) => {
            console.log(`${i+1}. $${o.price.toFixed(2)} | ${o.income}M/s | ${o.title}...`);
        });
        
        console.log(`\n=== LOWER offers (income < ${ourIncome}) ===`);
        // Lower по income (max income)
        const lowerByIncome = [...lower].sort((a, b) => b.income - a.income);
        console.log(`\nBy income (max income first):`);
        lowerByIncome.slice(0, 10).forEach((o, i) => {
            console.log(`${i+1}. ${o.income}M/s @ $${o.price.toFixed(2)} | ${o.title}...`);
        });
        
        // Lower по price (max price)  
        const lowerByPrice = [...lower].sort((a, b) => b.price - a.price);
        console.log(`\nBy price (max price first):`);
        lowerByPrice.slice(0, 10).forEach((o, i) => {
            console.log(`${i+1}. $${o.price.toFixed(2)} | ${o.income}M/s | ${o.title}...`);
        });
        
        // Анализ
        if (upper.length > 0 && lower.length > 0) {
            const bestUpper = upper[0];
            const bestLowerByIncome = lowerByIncome[0];
            const bestLowerByPrice = lowerByPrice[0];
            
            console.log(`\n=== ANALYSIS ===`);
            console.log(`Our income: ${ourIncome}M/s`);
            console.log(`Best Upper: ${bestUpper.income}M/s @ $${bestUpper.price.toFixed(2)}`);
            console.log(`Best Lower by income: ${bestLowerByIncome.income}M/s @ $${bestLowerByIncome.price.toFixed(2)}`);
            console.log(`Best Lower by price: ${bestLowerByPrice.income}M/s @ $${bestLowerByPrice.price.toFixed(2)}`);
            
            // Проверка на dump
            const validLowerByPrice = lowerByPrice.filter(o => o.price < bestUpper.price);
            const maxLowerPrice = validLowerByPrice.length > 0 ? validLowerByPrice[0].price : 0;
            const validLowerByIncome = lowerByIncome.filter(o => o.price < bestUpper.price);
            const closestLowerByIncome = validLowerByIncome[0];
            
            if (closestLowerByIncome && maxLowerPrice > 0) {
                const isDump = closestLowerByIncome.price < maxLowerPrice * 0.8;
                console.log(`\nDump check: $${closestLowerByIncome.price.toFixed(2)} < $${maxLowerPrice.toFixed(2)} * 0.8 = $${(maxLowerPrice * 0.8).toFixed(2)}?`);
                console.log(`Is dump: ${isDump}`);
                
                if (isDump) {
                    console.log(`\n⚠️ DUMP DETECTED!`);
                    console.log(`Lower by income (dump): ${closestLowerByIncome.income}M/s @ $${closestLowerByIncome.price.toFixed(2)}`);
                    console.log(`Lower by price (real): ${validLowerByPrice[0].income}M/s @ $${validLowerByPrice[0].price.toFixed(2)}`);
                }
            }
        }
        
    } catch (err) {
        console.error('Error:', err);
    }
}

analyzeLosPlanitos();
