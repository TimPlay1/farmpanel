const { calculateOptimalPrice } = require('./api/eldorado-price.js');

async function test() {
    const r = await calculateOptimalPrice('Esok Sekolah', 645);
    console.log('Esok Sekolah 645M/s: $' + r.suggestedPrice);
    console.log('Source:', r.priceSource);
    console.log('Competitor: $' + r.competitorPrice, '@', r.competitorIncome + 'M/s');
}

test();
