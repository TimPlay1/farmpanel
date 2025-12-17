/**
 * Тест гибридной интеграции AI+Regex
 * Проверяет что eldorado-price.js правильно использует AI для офферов
 * где regex не справился
 */

// Устанавливаем API ключ
process.env.GEMINI_API_KEY = 'AIzaSyB8PIO3ATq0piSl5vFGy7a7ERNQ0esiWdc';

const { calculateOptimalPrice, parseIncomeFromTitle, searchBrainrotOffers } = require('./api/eldorado-price.js');

console.log('═'.repeat(60));
console.log('🧪 Тест гибридной интеграции AI + Regex');
console.log('═'.repeat(60));

// Тест парсера
const testCases = [
    // Простые - regex справится
    { title: '270M/s Los 67 Fast Delivery', expectedParsed: true },
    { title: '350m/s Italian Brainrot', expectedParsed: true },
    { title: '18,5M/s DIAMOND RARITY', expectedParsed: true },
    
    // Сложные - AI нужен
    { title: 'LOS PLANITOS GOLD 450', expectedParsed: false },  // без M/s
    { title: 'Eviledon only $7.50 CHEAP', expectedParsed: false },  // только цена
    { title: 'Fast delivery brainrot god', expectedParsed: false },  // нет income
];

console.log('\n📋 Тест parseIncomeFromTitle:');
console.log('─'.repeat(60));

for (const tc of testCases) {
    const income = parseIncomeFromTitle(tc.title);
    const parsed = income !== null;
    const status = parsed === tc.expectedParsed ? '✅' : '❌';
    console.log(`${status} "${tc.title.substring(0, 40)}..." → ${income ? income + 'M/s' : 'null'}`);
}

// Тест реального API запроса (если есть интернет)
async function testRealAPI() {
    console.log('\n📡 Тест реального API (требует интернет):');
    console.log('─'.repeat(60));
    
    try {
        // Тестируем на популярном брейнроте
        const result = await calculateOptimalPrice('Los 67', 300);
        
        console.log(`Брейнрот: ${result.brainrotName}`);
        console.log(`Найдено офферов: ${result.offersFound}`);
        console.log(`Источник парсинга: ${result.parsingSource}`);
        console.log(`AI распарсил: ${result.aiParsedCount || 0} офферов`);
        console.log(`Рекомендуемая цена: $${result.suggestedPrice?.toFixed(2) || 'N/A'}`);
        console.log(`Источник цены: ${result.priceSource}`);
        
        if (result.samples?.length > 0) {
            console.log('\nПримеры офферов:');
            for (const s of result.samples) {
                console.log(`  - ${s.income}M/s @ $${s.price.toFixed(2)} [${s.source || 'regex'}]`);
                console.log(`    "${s.title}"`);
            }
        }
        
        console.log('\n' + '═'.repeat(60));
        console.log('✅ Тест завершён успешно!');
        
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
    }
}

testRealAPI();
