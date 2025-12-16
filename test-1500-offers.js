const { searchBrainrotOffers } = require('./api/eldorado-price.js');

function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    const bPatterns = [
        /(\d+[.,]?\d*)\s*B\/S/i,
        /(\d+[.,]?\d*)B\/s/i,
        /\[(\d+[.,]?\d*)\s*B\/s\]/i,
        /(\d+[.,]?\d*)\s*b\/sec/i,
        /(\d+[.,]?\d*)\s*bil\/s/i,
        /(\d+[.,]?\d*)\s*billion/i,
        /(\d+[.,]?\d*)B\s/i,
        /(\d+[.,]?\d*)B$/i,
        /\[(\d+[.,]?\d*)B\]/i,
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

searchBrainrotOffers('La Secret Combinasion', 1500).then(r => {
    const offers = r.matchingRangeOffers.map(item => {
        const o = item.offer || item;
        return {
            title: o.offerTitle,
            income: parseIncomeFromTitle(o.offerTitle),
            price: o.pricePerUnitInUSD?.amount
        };
    }).filter(o => o.income > 0).sort((a, b) => b.income - a.income);
    
    console.log('Top 20 by income:');
    offers.slice(0, 20).forEach(o => console.log(o.income + 'M/s @ $' + o.price.toFixed(2) + ' - ' + o.title.substring(0, 55)));
    console.log('\nOffers >= 1500M/s:', offers.filter(o => o.income >= 1500).length);
    console.log('Max income:', offers[0]?.income);
});
