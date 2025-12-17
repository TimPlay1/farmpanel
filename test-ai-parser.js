/**
 * Тест AI парсера на реальных примерах
 * Использует parseIncomeAI из ai-scanner.js
 */

const https = require('https');

// Читаем API ключ из env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY не установлен в environment!');
    console.error('Установи: $env:GEMINI_API_KEY = "твой_ключ"');
    process.exit(1);
}

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${GEMINI_API_KEY}`;

// Тестовые офферы (реальные примеры где regex сложно)
const testOffers = [
    // Простые
    { title: '270M/s LA SECRET', expected: 270 },
    { title: '350m/s Italian Brainrot', expected: 350 },
    { title: '18,5M/s DIAMOND RARITY', expected: 18.5 },
    { title: '531K/s Common Brainrot', expected: 0.531 },
    
    // Сложные форматы
    { title: 'Planitos Legendarius 300 m DIAMOND', expected: 300 },
    { title: 'Lucky Block 250M/s', expected: 250 },
    { title: '1.5B/s Super Rare Ultra', expected: 1500 },
    { title: 'x5 Gyattos 125m/s LA SECRET', expected: 125 },
    
    // Range - должны вернуть null
    { title: '0-24M/s Random Brainrot', expected: null, expectedReason: 'range' },
    { title: '10m-13m/s Some Pet', expected: null, expectedReason: 'range' },
    { title: '100->150M/s Mystery Box', expected: null, expectedReason: 'range' },
    
    // Random - должны вернуть null
    { title: 'Random Brainrot $4.50', expected: null, expectedReason: 'random' },
    { title: 'Spin The Wheel Mystery', expected: null, expectedReason: 'random' },
    { title: 'Random ms/s Any Pet', expected: null, expectedReason: 'random' },
    
    // Проблемные для regex
    { title: 'Los Nooo My Hotspotsitos 150m/s', expected: 150 },
    { title: 'LEGENDARIO 200 m/s DIAMOND', expected: 200 },
    { title: 'Combinacion TITANICO + GRINGO 350M', expected: 350 },
];

// Списки для AI
const eldoradoLists = {
    brainrots: ['Italian Brainrot', 'Planitos', 'Lucky Block', 'Gyattos', 
                'Los Nooo My Hotspotsitos', 'Combinacion', 'TITANICO', 'GRINGO'],
    mutations: ['DIAMOND', 'GOLDEN', 'PLASMA', 'FIRE', 'ICE', 'POISON'],
    rarities: ['LA SECRET', 'Legendary', 'Ultra Rare', 'Super Rare', 'Common']
};

function stripEmojis(text) {
    return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]/gu, '').trim();
}

function createAIPrompt(offers) {
    const cleanedOffers = offers.map(o => ({
        ...o,
        cleanTitle: stripEmojis(o.title || '')
    }));
    
    const brainrotsSample = eldoradoLists.brainrots.join(', ');
    const mutationsList = eldoradoLists.mutations.join(', ');
    const raritiesList = eldoradoLists.rarities.join(', ');
    
    return `TASK: Extract income values from Roblox "Steal a Brainrot" marketplace titles.

CONTEXT - Known Brainrot Names (IGNORE these in income detection):
${brainrotsSample}

MUTATIONS (IGNORE - NOT income): ${mutationsList}
RARITIES (IGNORE - NOT income): ${raritiesList}

OFFERS TO PARSE:
${cleanedOffers.map((o, i) => `${i + 1}. "${o.cleanTitle}"`).join('\n')}

EXTRACT for each offer:
- "m" (income): Income in M/s (millions/second), or null
- "r" (reason): If m=null: "range", "random", or "no_value"

INCOME FORMATS - CRITICAL - EXTRACT ANY NUMBER + M/m/K/B pattern:
- "270M/s" → 270
- "135m/s" → 135  
- "350 m" or "350m" → 350
- "18,5M/s" → 18.5 (COMMA IS DECIMAL SEPARATOR, NOT RANGE!)
- "18.5 mil" → 18.5
- "531K/s" → 0.531 (K=thousands, divide by 1000)
- "1.5B/s" → 1500 (B=billions, multiply by 1000)
- "125m/s LA SECRET" → 125 (ignore text after number!)
- "300M DIAMOND" → 300 (DIAMOND is mutation, ignore!)

CRITICAL RULES:
1. Look for NUMBER + M/m/K/B ANYWHERE in title (start, middle, end)
2. "m" alone after number = millions (e.g., "350 m" = 350 M/s)
3. Ignore all brainrot names, mutations, rarities
4. Ignore prices ($4.50, $12, etc.)
5. COMMA IN NUMBER (18,5) = DECIMAL (18.5), NOT A RANGE!

RANGE = null (MUST HAVE DASH/ARROW/TILDE BETWEEN TWO NUMBERS):
- "0-24M/s", "10m-13m/s" → null, r="range" (dash between numbers)
- "100->150m/s" → null, r="range" (arrow between numbers)  
- "50~100M" → null, r="range" (tilde between numbers)
- "18,5M/s" is NOT a range - comma is decimal separator!

RANDOM = null (when title contains "random" word or similar):
- "Random Brainrot" → null, r="random" (word "random" in title)
- "Random ms/s" → null, r="random"
- "Spin The Wheel" → null, r="random"
- "Mystery Box" → null, r="random"

OUTPUT STRICT JSON (no markdown, no explanation):
{"results":[{"i":1,"m":350},{"i":2,"m":null,"r":"range"}]}`;
}

async function parseWithAI(offers) {
    const prompt = createAIPrompt(offers);
    
    console.log('\n📝 Prompt отправлен в Gemini...');
    console.log('Длина промпта:', prompt.length, 'символов');
    
    return new Promise((resolve, reject) => {
        const requestBody = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048,
                topP: 0.8
            }
        });

        const url = new URL(GEMINI_API_URL);
        
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    
                    if (parsed.error) {
                        reject(new Error(parsed.error.message));
                        return;
                    }
                    
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    console.log('\n📥 Ответ AI:', text.substring(0, 200) + '...');
                    
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const result = JSON.parse(jsonMatch[0]);
                        resolve(result.results || []);
                    } else {
                        resolve([]);
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}\nData: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        
        req.write(requestBody);
        req.end();
    });
}

async function runTest() {
    console.log('🧪 Тестирование AI парсера (Gemini gemma-3-27b-it)');
    console.log('═'.repeat(60));
    
    try {
        const aiResults = await parseWithAI(testOffers);
        
        console.log('\n📊 РЕЗУЛЬТАТЫ:');
        console.log('─'.repeat(60));
        
        let passed = 0;
        let failed = 0;
        
        for (let i = 0; i < testOffers.length; i++) {
            const expected = testOffers[i];
            const ai = aiResults.find(r => r.i === i + 1);
            const aiIncome = ai?.m ?? null;
            const aiReason = ai?.r;
            
            const incomeMatch = expected.expected === aiIncome;
            const reasonMatch = !expected.expectedReason || expected.expectedReason === aiReason;
            const isPass = incomeMatch && reasonMatch;
            
            if (isPass) {
                passed++;
                console.log(`✅ ${i + 1}. "${expected.title}"`);
                console.log(`   → ${aiIncome !== null ? aiIncome + 'M/s' : `null (${aiReason})`}`);
            } else {
                failed++;
                console.log(`❌ ${i + 1}. "${expected.title}"`);
                console.log(`   Ожидали: ${expected.expected}${expected.expectedReason ? ` (${expected.expectedReason})` : ''}`);
                console.log(`   Получили: ${aiIncome}${aiReason ? ` (${aiReason})` : ''}`);
            }
        }
        
        console.log('\n' + '═'.repeat(60));
        console.log(`📈 Результат: ${passed}/${testOffers.length} (${Math.round(passed/testOffers.length*100)}%)`);
        
        if (failed > 0) {
            console.log(`⚠️  ${failed} тестов не прошли`);
        } else {
            console.log('🎉 Все тесты прошли успешно!');
        }
        
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
    }
}

runTest();
