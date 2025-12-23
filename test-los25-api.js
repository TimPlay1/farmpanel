/**
 * Финальный тест фильтрации Los 25 через реальный API
 * Проверяем что новая логика работает корректно
 */

const { searchBrainrotOffers } = require('./api/eldorado-price.js');

async function testLos25() {
    console.log('='.repeat(70));
    console.log('🧪 ТЕСТ: Los 25 через searchBrainrotOffers API');
    console.log('='.repeat(70));
    
    try {
        // Ищем офферы Los 25 в диапазоне 100-249 M/s
        const result = await searchBrainrotOffers('Los 25', 100);
        
        console.log('\n📊 Результаты поиска:');
        console.log(`   Всего офферов найдено: ${result.allPageOffers.length}`);
        console.log(`   Upper offer: ${result.upperOffer ? `${result.upperOffer.income}M/s @ $${result.upperOffer.price.toFixed(2)}` : 'не найден'}`);
        console.log(`   Lower offer: ${result.lowerOffer ? `${result.lowerOffer.income}M/s @ $${result.lowerOffer.price.toFixed(2)}` : 'не найден'}`);
        console.log(`   Фильтр: ${result.usedNameFilter || 'без фильтра'}`);
        
        // Проверяем что все офферы относятся к Los 25
        console.log('\n📋 Первые 10 офферов:');
        for (let i = 0; i < Math.min(10, result.allPageOffers.length); i++) {
            const offer = result.allPageOffers[i];
            const titleLower = offer.title.toLowerCase();
            
            // Проверяем наличие Los 25 в title
            const hasLos25 = /los\s+25/i.test(titleLower);
            // Проверяем наличие ДРУГИХ Los XX
            const hasOtherLos = /los\s+(?!25)\d+/i.test(titleLower);
            
            const emoji = hasLos25 ? '✅' : (hasOtherLos ? '❌' : '🔶');
            console.log(`   ${emoji} $${offer.price.toFixed(2)} ${offer.income}M/s - "${offer.title.substring(0, 50)}..."`);
            
            if (hasOtherLos) {
                console.log(`      ⚠️ ОШИБКА: Найден оффер другого Los XX!`);
            }
        }
        
        // Проверяем что нет офферов Los 67 среди результатов
        const los67Offers = result.allPageOffers.filter(o => /los\s+67/i.test(o.title.toLowerCase()));
        console.log('\n🔍 Проверка на Los 67:');
        if (los67Offers.length > 0) {
            console.log(`   ❌ ОШИБКА: Найдено ${los67Offers.length} офферов Los 67!`);
            los67Offers.forEach(o => console.log(`      - "${o.title.substring(0, 50)}..."`));
        } else {
            console.log(`   ✅ Офферов Los 67 не найдено (это правильно!)`);
        }
        
        // Проверяем что нет офферов Los Mobilis и т.д.
        const otherLosOffers = result.allPageOffers.filter(o => {
            const t = o.title.toLowerCase();
            return /los\s+(mobilis|planitos|candies|bros|primos)/i.test(t);
        });
        
        console.log('\n🔍 Проверка на другие Los *:');
        if (otherLosOffers.length > 0) {
            console.log(`   ❌ ОШИБКА: Найдено ${otherLosOffers.length} офферов других Los *!`);
            otherLosOffers.forEach(o => console.log(`      - "${o.title.substring(0, 50)}..."`));
        } else {
            console.log(`   ✅ Офферов других Los * не найдено (это правильно!)`);
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ ТЕСТ ЗАВЕРШЁН');
        
    } catch (error) {
        console.error('❌ Ошибка теста:', error.message);
    }
}

testLos25();
