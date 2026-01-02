const { connectToDatabase } = require('./_lib/db');

/**
 * API для управления названиями магазинов пользователей
 * 
 * Каждый пользователь может настроить уникальное название своего магазина
 * Формат: {emoji}{text max 15 chars}{emoji}
 * Например: "👾Glitched Store👾" или "🔥Fire Shop🔥"
 * 
 * Название используется в Tampermonkey скрипте для автозаполнения формы Eldorado
 */

/**
 * Парсит shop name на компоненты (эмодзи + текст + эмодзи)
 */
function parseShopName(fullName) {
    if (!fullName || typeof fullName !== 'string') {
        return null;
    }
    
    // Unicode regex для эмодзи
    const emojiRegex = /^(\p{Emoji}+)(.+?)(\p{Emoji}+)$/u;
    const match = fullName.match(emojiRegex);
    
    if (match) {
        return {
            leftEmoji: match[1],
            text: match[2],
            rightEmoji: match[3]
        };
    }
    
    // Fallback: попробуем найти эмодзи в начале и конце
    const simpleEmojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojis = fullName.match(simpleEmojiRegex);
    
    if (emojis && emojis.length >= 2) {
        const leftEmoji = emojis[0];
        const rightEmoji = emojis[emojis.length - 1];
        const text = fullName.slice(leftEmoji.length, -rightEmoji.length);
        return { leftEmoji, text, rightEmoji };
    }
    
    return null;
}

/**
 * Валидирует shop name
 */
function validateShopName(fullName) {
    if (!fullName || typeof fullName !== 'string') {
        return { valid: false, error: 'Shop name is required' };
    }
    
    if (fullName.length > 50) {
        return { valid: false, error: 'Shop name too long' };
    }
    
    const parsed = parseShopName(fullName);
    if (!parsed) {
        return { valid: false, error: 'Invalid format. Expected: emoji + text + emoji' };
    }
    
    if (parsed.text.length > 15) {
        return { valid: false, error: 'Text must be 15 characters or less' };
    }
    
    if (parsed.text.length < 1) {
        return { valid: false, error: 'Shop name text is required' };
    }
    
    return { valid: true, parsed };
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const db = await connectToDatabase();
        const farmersCollection = db.collection('farmers');
        
        // GET - получить shop name для farmKey
        if (req.method === 'GET') {
            const { farmKey } = req.query;
            
            if (!farmKey) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'farmKey is required' 
                });
            }
            
            const farmer = await farmersCollection.findOne({ key: farmKey });
            
            if (!farmer) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Farmer not found' 
                });
            }
            
            const shopName = farmer.shopName || null;
            const parsed = shopName ? parseShopName(shopName) : null;
            
            return res.status(200).json({
                success: true,
                shopName: shopName,
                parsed: parsed,
                isConfigured: !!shopName
            });
        }
        
        // POST - сохранить shop name
        if (req.method === 'POST') {
            const { farmKey, shopName } = req.body;
            
            if (!farmKey) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'farmKey is required' 
                });
            }
            
            if (!shopName) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'shopName is required' 
                });
            }
            
            // Валидация
            const validation = validateShopName(shopName);
            if (!validation.valid) {
                return res.status(400).json({ 
                    success: false, 
                    error: validation.error 
                });
            }
            
            // Проверяем что farmer существует
            const farmer = await farmersCollection.findOne({ key: farmKey });
            if (!farmer) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Farmer not found' 
                });
            }
            
            // Обновляем shop name
            await farmersCollection.updateOne(
                { key: farmKey },
                { 
                    $set: { 
                        shopName: shopName,
                        shopNameUpdatedAt: new Date()
                    } 
                }
            );
            
            console.log(`✅ Shop name updated for ${farmKey}: ${shopName}`);
            
            return res.status(200).json({
                success: true,
                shopName: shopName,
                parsed: validation.parsed,
                message: 'Shop name saved successfully'
            });
        }
        
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed' 
        });
        
    } catch (error) {
        console.error('❌ Shop name API error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Server error: ' + error.message 
        });
    }
};
