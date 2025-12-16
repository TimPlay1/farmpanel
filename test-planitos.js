// Тест: Los Planitos 240.5 M/s
const { calculateOptimalPrice, searchBrainrotOffers } = require('./api/eldorado-price.js');

async function testLosPlanitos() {
    const brainrotName = 'Los Planitos';
    const ourIncome = 240.5;
    
    console.log(`\n=== Testing ${brainrotName} @ ${ourIncome}M/s ===\n`);
    
    try {
        // Ищем офферы
        const searchResult = await searchBrainrotOffers(brainrotName, ourIncome);
        const { allOffers, matchingRangeOffers, targetMsRange } = searchResult;
        
        console.log(`Target M/s range: ${targetMsRange}`);
        console.log(`All offers found: ${allOffers.length}`);
        console.log(`Matching range offers: ${matchingRangeOffers.length}`);
        
        // Показываем первые 20 офферов
        console.log(`\n=== First 20 offers (all) ===`);
        const offersToShow = allOffers.slice(0, 20);
        for (const item of offersToShow) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            const price = offer.pricePerUnitInUSD?.amount || 0;
            const msAttr = offer.offerAttributeIdValues?.find(a => a.name === 'M/s');
            const brainrotEnv = offer.tradeEnvironmentValues?.find(e => e.name === 'Brainrot');
            
            // Парсим income из title
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
            
            console.log(`$${price.toFixed(2)} | ${income || '?'}M/s | ${msAttr?.value || '?'} | ${brainrotEnv?.id || '?'} | ${title.substring(0, 50)}...`);
        }
        
        // Теперь вызываем calculateOptimalPrice
        console.log(`\n=== calculateOptimalPrice Result ===`);
        const result = await calculateOptimalPrice(brainrotName, ourIncome);
        console.log(JSON.stringify(result, null, 2));
        
    } catch (err) {
        console.error('Error:', err);
    }
}

testLosPlanitos();
