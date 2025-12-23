/**
 * Тест для проблемы фильтрации "Los 25" и других брейнротов
 * 
 * ПРОБЛЕМА: checkBrainrotMatch() проверяет ВСЕ офферы на ВСЕ брейнроты
 * Должен: проверять только если в оффере обнаружено название брейнрота из списка
 * И только если фильтр активен - сравнивать с активным фильтром
 */

const https = require('https');

// Динамический кэш брейнротов - примерный список для тестирования
const KNOWN_BRAINROTS = [
    'la secret combinasion', 'swaggy bros', 'la ginger sekolah', 'mieteteira bicicleteira',
    'los mobilis', 'los 67', 'los candies', 'la spooky grande', 'chimnino', 'los planitos',
    'los 25', 'ketupat kepat', 'la taco combinasion', 'los bros', 'los primos',
    'los puggies', 'los spaghettis', 'los tacoritas', 'los combinasionas', 'tralalero tralala',
    'la grande combinasion', 'la extinct grande', 'la casa boo', 'la vacca saturno saturnita',
    '67', 'meowl', 'pot hotspot', 'esok sekolah', 'matteo'
];

const MUTATIONS = ['none', 'gold', 'diamond', 'bloodrot', 'candy', 'lava', 'galaxy', 'yin-yang', 'radioactive', 'rainbow'];
const RARITIES = ['common', 'rare', 'festive', 'epic', 'legendary', 'mythical', 'brainrot god', 'secret', 'og', 'admin', 'taco', 'normal'];

/**
 * СТАРАЯ (НЕПРАВИЛЬНАЯ) логика проверки
 * Проблема: проверяет ВСЕ офферы на все брейнроты
 */
function checkBrainrotMatch_OLD(titleLower, nameLower, dynamicBrainrotsCache) {
    // Разбиваем title на слова для более точного поиска
    const titleWords = titleLower.split(/[\s\-_|,.!:]+/).filter(w => w.length >= 3);
    
    for (const otherBrainrot of dynamicBrainrotsCache) {
        // Пропускаем если это наш брейнрот (или его часть)
        if (nameLower.includes(otherBrainrot) || otherBrainrot.includes(nameLower)) continue;
        
        // Проверяем полное имя брейнрота в title
        if (titleLower.includes(otherBrainrot)) {
            console.log(`⚠️ OLD: Skipping (found: ${otherBrainrot}, expected: ${nameLower})`);
            return false;
        }
        
        // Для многословных брейнротов проверяем ключевые слова
        const brainrotWords = otherBrainrot.split(/\s+/).filter(w => w.length >= 5);
        if (brainrotWords.length >= 2) {
            const matchedWords = [...new Set(brainrotWords.filter(w => titleLower.includes(w)))];
            if (matchedWords.length >= 2) {
                console.log(`⚠️ OLD: Skipping (found words: ${matchedWords.join(', ')} → ${otherBrainrot}, expected: ${nameLower})`);
                return false;
            }
        }
    }
    
    // Точное совпадение имени в title
    if (titleLower.includes(nameLower)) return true;
    
    // Для комбинированных имён проверяем ключевые слова
    const nameWords = nameLower
        .replace(/\s+(and|the|of|los|la|las)\s+/gi, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4);
    
    if (nameWords.length >= 2) {
        const matchCount = nameWords.filter(w => titleLower.includes(w)).length;
        if (matchCount >= 2) return true;
    } else if (nameWords.length === 1) {
        if (titleLower.includes(nameWords[0])) return true;
    }
    
    return false;
}

/**
 * НОВАЯ (ИСПРАВЛЕННАЯ) логика проверки v9.10.15
 * 
 * ЛОГИКА:
 * 1. СНАЧАЛА проверяем - содержит ли title наш целевой брейнрот
 *    Если да - это наш оффер, пропускаем проверку на другие брейнроты
 * 2. Если НЕТ нашего брейнрота - проверяем есть ли ДРУГОЙ известный брейнрот
 *    Это защита от офферов типа "Los 67 100M/s" в фильтре "Los 25"
 * 3. Специальная обработка паттерна "Los XX" - требуем точное совпадение номера
 */
function checkBrainrotMatch_NEW(titleLower, nameLower, dynamicBrainrotsCache, envValue = '') {
    // === ШАГ 1: Проверяем содержит ли title наш брейнрот ===
    const containsOurBrainrot = () => {
        // 1a. Точное совпадение полного имени
        if (titleLower.includes(nameLower)) return true;
        
        // 1b. Проверяем tradeEnvironmentValue
        if (envValue && (envValue.includes(nameLower) || nameLower.includes(envValue))) return true;
        
        // 1c. Специальная обработка для паттерна "Los XX" (Los 25, Los 67 и т.д.)
        const isLosPattern = /^los\s+\d+$/i.test(nameLower);
        
        if (isLosPattern) {
            // Для "Los 25", "Los 67" и т.д. - требуем точное совпадение
            const numberMatch = nameLower.match(/\d+/);
            if (numberMatch) {
                // Ищем паттерн "Los XX" где XX = наш номер
                const pattern = new RegExp(`los\\s+${numberMatch[0]}(?!\\d)`, 'i');
                return pattern.test(titleLower);
            }
        }
        
        // 1d. Для остальных брейнротов - проверяем ключевые слова
        const nameWords = nameLower
            .replace(/\s+(and|the|of)\s+/gi, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 4 && !['los', 'las', 'la'].includes(w));
        
        if (nameWords.length >= 2) {
            const matchCount = nameWords.filter(w => titleLower.includes(w)).length;
            if (matchCount >= 2) return true;
        } else if (nameWords.length === 1 && nameWords[0].length >= 5) {
            if (titleLower.includes(nameWords[0])) return true;
        }
        
        return false;
    };
    
    // Если title содержит наш брейнрот - это наш оффер, разрешаем!
    if (containsOurBrainrot()) {
        return { match: true, reason: 'contains_our_brainrot' };
    }
    
    // === ШАГ 2: Title НЕ содержит наш брейнрот ===
    // Проверяем есть ли там ДРУГОЙ известный брейнрот
    
    for (const otherBrainrot of dynamicBrainrotsCache) {
        // Пропускаем слишком короткие названия
        if (otherBrainrot.length < 5) continue;
        
        // Пропускаем если это наш брейнрот или его часть
        if (nameLower === otherBrainrot) continue;
        if (nameLower.includes(otherBrainrot) || otherBrainrot.includes(nameLower)) continue;
        
        // Специальная обработка для паттерна "Los XX"
        const isOtherLosPattern = /^los\s+\d+$/i.test(otherBrainrot);
        const isOurLosPattern = /^los\s+\d+$/i.test(nameLower);
        
        if (isOtherLosPattern && isOurLosPattern) {
            // Оба "Los XX" - проверяем точное совпадение номера
            const otherNumber = otherBrainrot.match(/\d+/)?.[0];
            const ourNumber = nameLower.match(/\d+/)?.[0];
            if (otherNumber && ourNumber && otherNumber !== ourNumber) {
                // Разные номера - проверяем есть ли ДРУГОЙ Los XX в title
                const pattern = new RegExp(`los\\s+${otherNumber}(?!\\d)`, 'i');
                if (pattern.test(titleLower)) {
                    return { match: false, reason: 'wrong_brainrot_los', found: otherBrainrot };
                }
            }
            continue; // Не проверяем полное совпадение для Los XX vs Los YY
        }
        
        // Полное совпадение другого брейнрота в title
        if (titleLower.includes(otherBrainrot)) {
            return { match: false, reason: 'wrong_brainrot', found: otherBrainrot };
        }
        
        // Проверка многословных брейнротов по ключевым словам
        const brainrotWords = otherBrainrot.split(/\s+/).filter(w => w.length >= 5);
        if (brainrotWords.length >= 2) {
            const matchedWords = [...new Set(brainrotWords.filter(w => titleLower.includes(w)))];
            if (matchedWords.length >= 2) {
                return { match: false, reason: 'wrong_brainrot_words', found: otherBrainrot, words: matchedWords };
            }
        }
    }
    
    // ШАГ 3: В title нет ни нашего брейнрота, ни других известных
    // Это может быть валидный оффер с опечаткой или кастомным описанием
    // РАЗРЕШАЕМ - AI парсер сможет перепроверить при необходимости
    return { match: true, reason: 'no_other_brainrot_found' };
}

/**
 * Вычисляет схожесть двух строк (0-1)
 * Используется для определения опечаток в названиях
 */
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    // Levenshtein distance
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,     // deletion
                    dp[i][j - 1] + 1,     // insertion
                    dp[i - 1][j - 1] + 1  // substitution
                );
            }
        }
    }
    
    return dp[m][n];
}

// Тестовые офферы (реальные примеры из Eldorado для Los 25)
const TEST_OFFERS = [
    // Валидные офферы для Los 25
    { title: 'Los 25 125m/s ⚡ INSTANT DELIVERY ⚡ Best price', expected: true },
    { title: 'LOS 25 82,5M DIAMOND 01', expected: true },
    { title: 'RADIOACTIVE LOS 25 105M/S 01', expected: true },
    { title: 'LOS 25 GOLD 100M/s Fast Delivery!', expected: true },
    { title: 'Los 25 Rainbow 222.5M/s #GS', expected: true },
    { title: 'LOS 25 100M/S INSTANT', expected: true },
    
    // Офферы с опечатками (должны пройти - AI разберётся)
    { title: 'LOS25 100M/s delivery', expected: true },  // без пробела - но позже на AI
    { title: 'LAS 25 GOLD 80M/s', expected: true },      // опечатка - но нет другого брейнрота
    
    // Офферы ДРУГИХ брейнротов (должны быть пропущены)
    { title: 'Los 67 150M/s Rainbow', expected: false },
    { title: 'LOS MOBILIS 200M/S GOLD', expected: false },
    { title: 'Los Planitos 240M/s cheap!', expected: false },
    { title: 'Chimnino 266M/s Gold Fast', expected: false },
    { title: 'La Secret Combinasion 1.5B/s RAINBOW', expected: false },
    { title: 'Swaggy Bros Radioactive 660M/s', expected: false },
    
    // Неоднозначные (разрешаем - AI разберётся)
    { title: '25 Gold 100M/s cheap delivery', expected: true },  // Просто "25" без "Los" - нет другого брейнрота
    { title: 'Los Bros 150M/s instant', expected: false },       // Los Bros != Los 25
];

// Тест для конкретных брейнротов с последнего скриншота
const BRAINROTS_TO_TEST = [
    { name: 'La Secret Combinasion', income: 1500 },   // 1.5B/s
    { name: 'Swaggy Bros', income: 660 },
    { name: 'La Ginger Sekolah', income: 618.8 },
    { name: 'Mieteteira Bicicleteira', income: 390 },
    { name: 'Los Mobilis', income: 363 },
    { name: 'Los 67', income: 337.5 },
    { name: 'Los Candies', income: 310.5 },
    { name: 'La Ginger Sekolah', income: 300 },
    { name: 'La Spooky Grande', income: 269.5 },
    { name: 'Chimnino', income: 266 },
    { name: 'Los Planitos', income: 240.5 },
    { name: 'Los 25', income: 222.5 },
    { name: 'Ketupat Kepat', income: 218.8 },
    { name: 'La Taco Combinasion', income: 218.8 },
    { name: 'Ketupat Kepat', income: 210 },
    { name: 'Los Mobilis', income: 198 },
];

function fetchEldoradoOffers(brainrotName, msRangeAttrId = '0-4') {
    return new Promise((resolve) => {
        const encodedName = encodeURIComponent(brainrotName);
        const params = new URLSearchParams({
            gameId: '259',
            category: 'CustomItem',
            tradeEnvironmentValue0: 'Brainrot',
            tradeEnvironmentValue2: brainrotName,
            offerAttributeIdsCsv: msRangeAttrId,
            pageSize: '24',
            pageIndex: '1',
            offerSortingCriterion: 'Price',
            isAscending: 'true'
        });

        const options = {
            hostname: 'www.eldorado.gg',
            path: '/api/flexibleOffers?' + params.toString(),
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'swagger': 'Swager request'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({
                        results: parsed.results || [],
                        totalCount: parsed.recordCount || 0
                    });
                } catch (e) {
                    resolve({ error: e.message, results: [] });
                }
            });
        });

        req.on('error', (e) => resolve({ error: e.message, results: [] }));
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({ error: 'timeout', results: [] });
        });
        req.end();
    });
}

async function testFiltering() {
    console.log('=' . repeat(80));
    console.log('🧪 ТЕСТ ФИЛЬТРАЦИИ БРЕЙНРОТОВ');
    console.log('=' . repeat(80));
    
    // Тест 1: Проверка логики на статических примерах
    console.log('\n📋 ТЕСТ 1: Статические примеры для "Los 25"');
    console.log('-'.repeat(80));
    
    const targetBrainrot = 'los 25';
    let oldPassed = 0, oldFailed = 0;
    let newPassed = 0, newFailed = 0;
    
    for (const test of TEST_OFFERS) {
        const titleLower = test.title.toLowerCase();
        
        const oldResult = checkBrainrotMatch_OLD(titleLower, targetBrainrot, KNOWN_BRAINROTS);
        const newResult = checkBrainrotMatch_NEW(titleLower, targetBrainrot, KNOWN_BRAINROTS);
        
        const oldMatch = oldResult === true ? true : (oldResult === 'maybe' ? 'maybe' : false);
        const newMatch = newResult.match;
        
        const oldCorrect = oldMatch === test.expected;
        const newCorrect = newMatch === test.expected;
        
        if (oldCorrect) oldPassed++; else oldFailed++;
        if (newCorrect) newPassed++; else newFailed++;
        
        const emoji = newCorrect ? '✅' : '❌';
        const oldEmoji = oldCorrect ? '✓' : '✗';
        const newEmoji = newCorrect ? '✓' : '✗';
        
        console.log(`${emoji} "${test.title.substring(0, 50)}..."`);
        console.log(`   Expected: ${test.expected} | OLD: ${oldMatch} ${oldEmoji} | NEW: ${newMatch} ${newEmoji}`);
        if (newResult.reason) {
            console.log(`   Reason: ${newResult.reason}${newResult.found ? ` (found: ${newResult.found})` : ''}`);
        }
    }
    
    console.log('\n' + '-'.repeat(80));
    console.log(`📊 Результаты статических тестов:`);
    console.log(`   OLD логика: ${oldPassed}/${TEST_OFFERS.length} passed (${Math.round(oldPassed/TEST_OFFERS.length*100)}%)`);
    console.log(`   NEW логика: ${newPassed}/${TEST_OFFERS.length} passed (${Math.round(newPassed/TEST_OFFERS.length*100)}%)`);
    
    // Тест 2: Реальные данные из Eldorado для Los 25
    console.log('\n\n📋 ТЕСТ 2: Реальные офферы Los 25 из Eldorado API');
    console.log('-'.repeat(80));
    
    const response = await fetchEldoradoOffers('Los 25', '0-4'); // 100-249 M/s
    console.log(`Получено офферов: ${response.results?.length || 0}`);
    
    if (response.results && response.results.length > 0) {
        let skippedByOld = 0, skippedByNew = 0;
        
        for (const item of response.results.slice(0, 15)) {
            const offer = item.offer || item;
            const title = offer.offerTitle || '';
            const titleLower = title.toLowerCase();
            const price = offer.pricePerUnitInUSD?.amount || 0;
            
            const oldResult = checkBrainrotMatch_OLD(titleLower, targetBrainrot, KNOWN_BRAINROTS);
            const newResult = checkBrainrotMatch_NEW(titleLower, targetBrainrot, KNOWN_BRAINROTS);
            
            if (!oldResult) skippedByOld++;
            if (newResult.match === false) skippedByNew++;
            
            const oldEmoji = oldResult ? '✅' : '⛔';
            const newEmoji = newResult.match === true ? '✅' : (newResult.match === 'maybe' ? '🔶' : '⛔');
            
            console.log(`${newEmoji} $${price.toFixed(2)} "${title.substring(0, 55)}..."`);
            console.log(`   OLD: ${oldResult ? 'pass' : 'skip'} | NEW: ${newResult.match} (${newResult.reason})`);
        }
        
        console.log('\n' + '-'.repeat(80));
        console.log(`📊 Пропущено офферов:`);
        console.log(`   OLD логика: ${skippedByOld}`);
        console.log(`   NEW логика: ${skippedByNew}`);
    }
    
    // Тест 3: Проверка всех брейнротов со скриншота
    console.log('\n\n📋 ТЕСТ 3: Все брейнроты с последнего скриншота');
    console.log('-'.repeat(80));
    
    for (const brainrot of BRAINROTS_TO_TEST) { // Все брейнроты для полного теста
        console.log(`\n🔍 ${brainrot.name} (${brainrot.income}M/s):`);
        
        // Определяем M/s диапазон
        let msAttrId = '0-4'; // 100-249 M/s по умолчанию
        if (brainrot.income >= 1000) msAttrId = '0-8';
        else if (brainrot.income >= 750) msAttrId = '0-7';
        else if (brainrot.income >= 500) msAttrId = '0-6';
        else if (brainrot.income >= 250) msAttrId = '0-5';
        else if (brainrot.income >= 100) msAttrId = '0-4';
        else if (brainrot.income >= 50) msAttrId = '0-3';
        else if (brainrot.income >= 25) msAttrId = '0-2';
        else msAttrId = '0-1';
        
        const resp = await fetchEldoradoOffers(brainrot.name, msAttrId);
        const nameLower = brainrot.name.toLowerCase();
        
        let totalOffers = resp.results?.length || 0;
        let skippedOld = 0, skippedNew = 0, maybeNew = 0;
        
        for (const item of (resp.results || [])) {
            const offer = item.offer || item;
            const titleLower = (offer.offerTitle || '').toLowerCase();
            
            const oldResult = checkBrainrotMatch_OLD(titleLower, nameLower, KNOWN_BRAINROTS);
            const newResult = checkBrainrotMatch_NEW(titleLower, nameLower, KNOWN_BRAINROTS);
            
            if (!oldResult) skippedOld++;
            if (newResult.match === false) skippedNew++;
            if (newResult.match === 'maybe') maybeNew++;
        }
        
        console.log(`   Всего: ${totalOffers} | OLD skip: ${skippedOld} | NEW skip: ${skippedNew} | NEW maybe (AI): ${maybeNew}`);
        
        // Задержка между запросами
        await new Promise(r => setTimeout(r, 300));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ ТЕСТЫ ЗАВЕРШЕНЫ');
}

// Запуск тестов
testFiltering().catch(console.error);
