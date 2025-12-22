/**
 * Тест новой системы ценообразования v9.9.0
 * 
 * Тестируемые функции:
 * 1. Медианная рекомендованная цена (на основе страницы с компетитором)
 * 2. Цена относительно следующего компетитора
 * 3. Текущая логика (для сравнения)
 * 
 * Тестовые брейнроты (разнообразные по income):
 * - B/s уровень (1000+ M/s)
 * - 500-999 M/s
 * - 250-499 M/s  
 * - 100-249 M/s
 * - 50-99 M/s
 * - 0-49 M/s
 */

const https = require('https');
const { MongoClient } = require('mongodb');

// Тестовые брейнроты (hardcoded для стабильности тестов)
const TEST_BRAINROTS = [
    // B/s уровень (1000+ M/s = 1+ B/s)
    { name: 'La Secret Combinasion', income: 1500, expectedRange: '1+ B/s', mutation: 'Radioactive' },
    { name: 'Los Planitos', income: 1200, expectedRange: '1+ B/s', mutation: 'Gold' },
    { name: 'Tralalero Tralala', income: 1100, expectedRange: '1+ B/s', mutation: 'None' },
    
    // 500-999 M/s
    { name: 'Swaggy Bros', income: 660, expectedRange: '500-749 M/s', mutation: 'Radioactive' },
    { name: 'Bombardiro Crocodilo', income: 550, expectedRange: '500-749 M/s', mutation: 'None' },
    
    // 250-499 M/s
    { name: 'Los Primos', income: 496, expectedRange: '250-499 M/s', mutation: 'None' },
    { name: 'Los Mobilis', income: 363, expectedRange: '250-499 M/s', mutation: 'YinYang' },
    
    // 100-249 M/s
    { name: 'Eviledon', income: 220.5, expectedRange: '100-249 M/s', mutation: 'None' },
    { name: 'Esok Sekolah', income: 150, expectedRange: '100-249 M/s', mutation: 'Gold' },
    { name: 'La Secret Combinasion', income: 187.5, expectedRange: '100-249 M/s', mutation: 'None' },
    
    // 50-99 M/s
    { name: 'Los Nooo My Hotspotsitos', income: 96.2, expectedRange: '50-99 M/s', mutation: 'None' },
    { name: 'Los 25', income: 85, expectedRange: '50-99 M/s', mutation: 'None' },
];

// Конфигурация Eldorado API
const ELDORADO_GAME_ID = '259';

/**
 * M/s диапазоны и их ID для фильтрации
 */
const MS_RANGE_CONFIG = {
    '0-24 M/s': { id: '0-1', min: 0, max: 24 },
    '25-49 M/s': { id: '0-2', min: 25, max: 49 },
    '50-99 M/s': { id: '0-3', min: 50, max: 99 },
    '100-249 M/s': { id: '0-4', min: 100, max: 249 },
    '250-499 M/s': { id: '0-5', min: 250, max: 499 },
    '500-749 M/s': { id: '0-6', min: 500, max: 749 },
    '750-999 M/s': { id: '0-7', min: 750, max: 999 },
    '1+ B/s': { id: '0-8', min: 1000, max: 99999 }
};

/**
 * Определяет M/s диапазон по income
 */
function getMsRange(income) {
    if (income >= 1000) return '1+ B/s';
    if (income >= 750) return '750-999 M/s';
    if (income >= 500) return '500-749 M/s';
    if (income >= 250) return '250-499 M/s';
    if (income >= 100) return '100-249 M/s';
    if (income >= 50) return '50-99 M/s';
    if (income >= 25) return '25-49 M/s';
    if (income > 0) return '0-24 M/s';
    return '0';
}

/**
 * Парсит income из title оффера
 */
function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    // Проверка на диапазоны (skip)
    const rangePatterns = [
        /(\d+)\s*[mM]?\s*[-~]\s*(\d+)\s*[mM]\/[sS]/i,
        /(\d+)\s*[mM]?\s+to\s+(\d+)\s*[mM]\/[sS]/i,
    ];
    
    for (const pattern of rangePatterns) {
        if (pattern.test(title)) return null;
    }
    
    // M/s паттерны
    const mPatterns = [
        /(\d+[.,]?\d*)\s*M\/s/i,
        /(\d+[.,]?\d*)\s*m\/sec/i,
    ];

    for (const pattern of mPatterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            if (value >= 1 && value <= 9999) return value;
        }
    }
    
    // B/s паттерны
    const bPatterns = [
        /(\d+[.,]?\d*)\s*B\/S/i,
        /(\d+[.,]?\d*)B\/s/i,
    ];
    
    for (const pattern of bPatterns) {
        const match = title.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(',', '.'));
            const msValue = value * 1000;
            if (msValue >= 1000 && msValue <= 99999) return msValue;
        }
    }
    
    return null;
}

/**
 * Проверяет является ли оффер от нашего магазина
 */
function isOurStoreOffer(offer) {
    const title = (offer.offerTitle || '').toLowerCase();
    const description = (offer.description || '').toLowerCase();
    return title.includes('#gs') || description.includes('#gs') || 
           title.includes('glitched store');
}

/**
 * Запрос к Eldorado API
 */
function fetchEldoradoPage(pageIndex, msRangeAttrId, brainrotName = null) {
    return new Promise((resolve) => {
        const params = new URLSearchParams({
            gameId: ELDORADO_GAME_ID,
            category: 'CustomItem',
            tradeEnvironmentValue0: 'Brainrot',
            pageSize: '24',  // Размер страницы UI
            pageIndex: String(pageIndex),
            offerSortingCriterion: 'Price',
            isAscending: 'true'
        });
        
        if (msRangeAttrId) params.set('offerAttributeIdsCsv', msRangeAttrId);
        if (brainrotName) params.set('tradeEnvironmentValue2', brainrotName);

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
                        totalCount: parsed.recordCount || 0,
                        totalPages: parsed.totalPages || 0
                    });
                } catch (e) {
                    resolve({ error: e.message, results: [] });
                }
            });
        });

        req.on('error', (e) => resolve({ error: e.message, results: [] }));
        req.setTimeout(15000, () => { req.destroy(); resolve({ error: 'timeout', results: [] }); });
        req.end();
    });
}

/**
 * Вычисляет медиану массива чисел
 */
function calculateMedian(numbers) {
    if (!numbers || numbers.length === 0) return null;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

/**
 * НОВАЯ ЛОГИКА: Расширенный поиск с медианой и следующим компетитором
 * 
 * @param {string} brainrotName - имя брейнрота
 * @param {number} targetIncome - целевой income
 * @returns {Object} - результаты с тремя вариантами цен
 */
async function searchWithExtendedPricing(brainrotName, targetIncome) {
    const msRange = getMsRange(targetIncome);
    const rangeConfig = MS_RANGE_CONFIG[msRange];
    
    if (!rangeConfig) {
        return { error: 'Unknown M/s range' };
    }
    
    console.log(`\n🔍 Searching: ${brainrotName} @ ${targetIncome} M/s (${msRange})`);
    
    const allOffers = [];
    let upperOffer = null;        // Первый компетитор (income >= target)
    let nextCompetitor = null;    // Следующий компетитор после upper
    let lowerOffer = null;        // Lower оффер (income < target)
    let competitorPage = 0;       // Страница где найден компетитор
    const seenIds = new Set();
    
    // Сканируем до 4 страниц (по 24 оффера = 96 офферов максимум)
    const MAX_PAGES = 4;
    
    for (let page = 1; page <= MAX_PAGES; page++) {
        console.log(`   Page ${page}...`);
        
        const response = await fetchEldoradoPage(page, rangeConfig.id, brainrotName);
        
        if (response.error || !response.results?.length) {
            console.log(`   No results: ${response.error || 'empty'}`);
            
            // Если первая страница пустая - пробуем без фильтра по имени
            if (page === 1) {
                console.log('   Trying without name filter...');
                const fallbackResponse = await fetchEldoradoPage(page, rangeConfig.id, null);
                if (fallbackResponse.results?.length) {
                    response.results = fallbackResponse.results;
                    response.totalPages = fallbackResponse.totalPages;
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        
        const pageOffers = [];
        
        for (const item of response.results) {
            const offer = item.offer || item;
            const offerId = offer.id;
            if (seenIds.has(offerId)) continue;
            seenIds.add(offerId);
            
            // Пропускаем наши офферы
            if (isOurStoreOffer(offer)) continue;
            
            const offerTitle = offer.offerTitle || '';
            const price = offer.pricePerUnitInUSD?.amount || 0;
            if (price <= 0) continue;
            
            // Проверяем что оффер соответствует брейнроту
            const titleLower = offerTitle.toLowerCase();
            const nameLower = brainrotName.toLowerCase();
            if (!titleLower.includes(nameLower) && nameLower.length > 3) {
                // Для длинных имён требуем частичное совпадение
                const nameWords = nameLower.split(/\s+/).filter(w => w.length >= 3);
                const matchCount = nameWords.filter(w => titleLower.includes(w)).length;
                if (matchCount < Math.min(2, nameWords.length)) continue;
            }
            
            const parsedIncome = parseIncomeFromTitle(offerTitle);
            
            const offerData = {
                title: offerTitle,
                income: parsedIncome || 0,
                price: price,
                page: page
            };
            
            pageOffers.push(offerData);
            allOffers.push(offerData);
            
            // Ищем upper (первый с income >= target)
            if (!upperOffer && parsedIncome && parsedIncome >= targetIncome) {
                upperOffer = offerData;
                competitorPage = page;
                console.log(`   ✓ Found UPPER: ${parsedIncome}M/s @ $${price.toFixed(2)}`);
            }
            // Ищем next competitor (после upper)
            else if (upperOffer && !nextCompetitor && parsedIncome && parsedIncome >= targetIncome && price > upperOffer.price) {
                nextCompetitor = offerData;
                console.log(`   ✓ Found NEXT: ${parsedIncome}M/s @ $${price.toFixed(2)}`);
            }
        }
        
        // Если нашли upper на этой странице - ищем lower и вычисляем медиану
        if (upperOffer && competitorPage === page) {
            // Ищем lower
            const lowerCandidates = pageOffers.filter(o => 
                o.income > 0 && 
                o.income < targetIncome && 
                o.price <= upperOffer.price
            );
            if (lowerCandidates.length > 0) {
                lowerCandidates.sort((a, b) => b.income - a.income);
                lowerOffer = lowerCandidates[0];
                console.log(`   ✓ Found LOWER: ${lowerOffer.income}M/s @ $${lowerOffer.price.toFixed(2)}`);
            }
            
            // Продолжаем ещё 1 страницу для поиска nextCompetitor
            if (!nextCompetitor && page < MAX_PAGES) {
                continue;
            }
            break;
        }
        
        // Небольшая задержка
        await new Promise(r => setTimeout(r, 200));
    }
    
    // ==================== РАСЧЁТ ЦЕН ====================
    
    const result = {
        brainrotName,
        targetIncome,
        msRange,
        
        // Текущая логика
        suggestedPrice: null,
        priceSource: null,
        
        // Новое: медианная цена
        medianPrice: null,
        medianData: null,
        
        // Новое: цена следующего компетитора
        nextCompetitorPrice: null,
        nextCompetitorData: null,
        
        // Данные конкурентов
        upperOffer,
        lowerOffer,
        nextCompetitor,
        competitorPage,
        totalOffersFound: allOffers.length
    };
    
    // 1. ТЕКУЩАЯ ЛОГИКА (upper/lower)
    if (upperOffer) {
        const competitorPrice = upperOffer.price;
        
        if (lowerOffer) {
            const priceDiff = competitorPrice - lowerOffer.price;
            if (priceDiff >= 1) {
                result.suggestedPrice = Math.round((competitorPrice - 1) * 100) / 100;
                result.priceSource = `upper ${upperOffer.income}M/s @ $${competitorPrice.toFixed(2)}, lower ${lowerOffer.income}M/s @ $${lowerOffer.price.toFixed(2)}, diff $${priceDiff.toFixed(2)} >= $1 → -$1`;
            } else {
                result.suggestedPrice = Math.round((competitorPrice - 0.5) * 100) / 100;
                result.priceSource = `upper ${upperOffer.income}M/s @ $${competitorPrice.toFixed(2)}, lower ${lowerOffer.income}M/s @ $${lowerOffer.price.toFixed(2)}, diff $${priceDiff.toFixed(2)} < $1 → -$0.50`;
            }
        } else {
            result.suggestedPrice = Math.round((competitorPrice - 0.5) * 100) / 100;
            result.priceSource = `upper ${upperOffer.income}M/s @ $${competitorPrice.toFixed(2)}, no lower → -$0.50`;
        }
    } else if (allOffers.length > 0) {
        // Выше рынка
        const offersWithIncome = allOffers.filter(o => o.income > 0);
        if (offersWithIncome.length > 0) {
            const maxIncomeOffer = offersWithIncome.reduce((max, o) => o.income > max.income ? o : max);
            result.suggestedPrice = Math.round((maxIncomeOffer.price - 0.5) * 100) / 100;
            result.priceSource = `above market (max: ${maxIncomeOffer.income}M/s @ $${maxIncomeOffer.price.toFixed(2)}) → -$0.50`;
        }
    }
    
    // 2. МЕДИАННАЯ ЦЕНА (на основе страницы с компетитором)
    if (competitorPage > 0) {
        // Берём офферы со страницы компетитора
        const pageOffers = allOffers.filter(o => o.page === competitorPage && o.price > 0);
        const prices = pageOffers.map(o => o.price);
        
        if (prices.length >= 3) {
            const median = calculateMedian(prices);
            result.medianPrice = Math.round((median - 0.5) * 100) / 100;
            result.medianData = {
                pageNumber: competitorPage,
                offersOnPage: pageOffers.length,
                medianValue: median,
                pricesUsed: prices.slice(0, 10)  // Первые 10 для отладки
            };
            console.log(`   📊 Median: $${median.toFixed(2)} → suggested $${result.medianPrice.toFixed(2)} (${prices.length} offers)`);
        }
    }
    
    // 3. ЦЕНА СЛЕДУЮЩЕГО КОМПЕТИТОРА
    if (nextCompetitor) {
        result.nextCompetitorPrice = Math.round((nextCompetitor.price - 0.5) * 100) / 100;
        result.nextCompetitorData = {
            income: nextCompetitor.income,
            price: nextCompetitor.price,
            title: nextCompetitor.title.substring(0, 50)
        };
        console.log(`   📈 Next competitor: ${nextCompetitor.income}M/s @ $${nextCompetitor.price.toFixed(2)} → suggested $${result.nextCompetitorPrice.toFixed(2)}`);
    }
    
    return result;
}

/**
 * Запуск тестов
 */
async function runTests() {
    console.log('='.repeat(80));
    console.log('PRICING SYSTEM TEST v9.9.0');
    console.log('Testing: Median Price + Next Competitor Price');
    console.log('='.repeat(80));
    
    const results = [];
    
    for (const brainrot of TEST_BRAINROTS) {
        try {
            const result = await searchWithExtendedPricing(brainrot.name, brainrot.income);
            results.push(result);
            
            console.log('\n   📋 RESULTS:');
            console.log(`      Current suggested: $${result.suggestedPrice?.toFixed(2) || 'N/A'}`);
            console.log(`      Median suggested:  $${result.medianPrice?.toFixed(2) || 'N/A'}`);
            console.log(`      Next competitor:   $${result.nextCompetitorPrice?.toFixed(2) || 'N/A'}`);
            
            // Задержка между запросами
            await new Promise(r => setTimeout(r, 500));
            
        } catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
        }
    }
    
    // Сводка
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    console.log('\n| Brainrot | Income | Range | Current | Median | Next |');
    console.log('|----------|--------|-------|---------|--------|------|');
    
    for (const r of results) {
        console.log(`| ${r.brainrotName.substring(0, 20).padEnd(20)} | ${String(r.targetIncome).padStart(6)} | ${r.msRange.padEnd(13)} | $${(r.suggestedPrice?.toFixed(2) || 'N/A').padStart(5)} | $${(r.medianPrice?.toFixed(2) || 'N/A').padStart(5)} | $${(r.nextCompetitorPrice?.toFixed(2) || 'N/A').padStart(5)} |`);
    }
    
    // Статистика
    const withMedian = results.filter(r => r.medianPrice !== null);
    const withNext = results.filter(r => r.nextCompetitorPrice !== null);
    
    console.log('\nStatistics:');
    console.log(`  Total tested: ${results.length}`);
    console.log(`  With median price: ${withMedian.length} (${Math.round(withMedian.length / results.length * 100)}%)`);
    console.log(`  With next competitor: ${withNext.length} (${Math.round(withNext.length / results.length * 100)}%)`);
    
    return results;
}

// Запуск
runTests().then(() => {
    console.log('\n✅ Tests completed');
    process.exit(0);
}).catch(err => {
    console.error('❌ Tests failed:', err);
    process.exit(1);
});
