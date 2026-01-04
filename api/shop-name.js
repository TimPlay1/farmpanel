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
 * Более простой подход - просто проверяем что строка не пустая
 */
function parseShopName(fullName) {
    if (!fullName || typeof fullName !== 'string' || fullName.length < 3) {
        return null;
    }
    
    // Простой подход: считаем что формат корректный если есть хоть какой-то текст
    // Первые 1-2 символа - левый эмодзи, последние 1-2 - правый
    // Валидацию формата делаем на клиенте
    return {
        leftEmoji: fullName.substring(0, 2),
        text: fullName.substring(2, fullName.length - 2),
        rightEmoji: fullName.substring(fullName.length - 2)
    };
}

/**
 * Валидирует shop name - упрощённая версия
 */
function validateShopName(fullName) {
    if (!fullName || typeof fullName !== 'string') {
        return { valid: false, error: 'Shop name is required' };
    }
    
    if (fullName.length < 3) {
        return { valid: false, error: 'Shop name too short' };
    }
    
    if (fullName.length > 50) {
        return { valid: false, error: 'Shop name too long' };
    }
    
    // Упрощённая проверка - просто принимаем любое название
    const parsed = {
        text: fullName
    };
    
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
        const { db } = await connectToDatabase();
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
            
            // Используем проекцию для получения только shopName (быстрее)
            const farmer = await farmersCollection.findOne(
                { farmKey }, 
                { projection: { shopName: 1, _id: 0 } }
            );
            
            // Если farmer не найден - возвращаем пустой shopName (не ошибку)
            if (!farmer) {
                // Кэшируем негативный результат на 1 минуту
                res.setHeader('Cache-Control', 'public, max-age=60');
                return res.status(200).json({ 
                    success: true,
                    shopName: null,
                    parsed: null,
                    isConfigured: false
                });
            }
            
            const shopName = farmer.shopName || null;
            const parsed = shopName ? parseShopName(shopName) : null;
            
            // Кэшируем позитивный результат на 5 минут (shop name редко меняется)
            res.setHeader('Cache-Control', 'public, max-age=300');
            
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
            const farmer = await farmersCollection.findOne({ farmKey });
            if (!farmer) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Farmer not found' 
                });
            }
            
            // Обновляем shop name
            await farmersCollection.updateOne(
                { farmKey },
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
