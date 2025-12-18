/**
 * API для управления цветом рамки пользователя
 * 
 * GET /api/user-color?farmKey=XXX - получить цвет
 * POST /api/user-color - установить цвет { farmKey, color }
 */

const { connectToDatabase } = require('./_lib/db');

// Упрощённая палитра - 12 легко различимых цветов
const DISTINCT_COLORS = [
    '#FF0000',  // Красный
    '#00FF00',  // Зелёный (лайм)
    '#0066FF',  // Синий
    '#FFFF00',  // Жёлтый
    '#FF00FF',  // Маджента
    '#00FFFF',  // Циан
    '#FF6600',  // Оранжевый
    '#9933FF',  // Фиолетовый
    '#00CC66',  // Бирюзовый
    '#FF3399',  // Розовый
    '#66FF33',  // Салатовый
    '#3399FF',  // Голубой
];

// Генерация цвета на основе farmKey
function getDefaultColorForFarmKey(farmKey) {
    if (!farmKey) return DISTINCT_COLORS[0];
    
    let hash = 0;
    const str = String(farmKey);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    
    return DISTINCT_COLORS[Math.abs(hash) % DISTINCT_COLORS.length];
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const db = await connectToDatabase();
    const collection = db.collection('user_colors');

    // GET - получить цвет пользователя
    if (req.method === 'GET') {
        const { farmKey } = req.query;
        
        if (!farmKey) {
            return res.status(400).json({ error: 'farmKey required' });
        }
        
        try {
            // Ищем сохранённый цвет
            const saved = await collection.findOne({ _id: farmKey });
            
            if (saved && saved.color) {
                return res.json({
                    farmKey,
                    color: saved.color,
                    isCustom: true,
                    palette: DISTINCT_COLORS
                });
            }
            
            // Возвращаем цвет по умолчанию
            return res.json({
                farmKey,
                color: getDefaultColorForFarmKey(farmKey),
                isCustom: false,
                palette: DISTINCT_COLORS
            });
            
        } catch (e) {
            console.error('Error getting user color:', e);
            return res.status(500).json({ error: e.message });
        }
    }

    // POST - установить цвет пользователя
    if (req.method === 'POST') {
        const { farmKey, color } = req.body;
        
        if (!farmKey) {
            return res.status(400).json({ error: 'farmKey required' });
        }
        
        // Валидация цвета
        let validColor = color;
        if (color && !DISTINCT_COLORS.includes(color)) {
            // Проверяем что это валидный HEX цвет
            if (!/^#[0-9A-F]{6}$/i.test(color)) {
                validColor = getDefaultColorForFarmKey(farmKey);
            }
        }
        
        // Если цвет не передан - генерируем по умолчанию
        if (!validColor) {
            validColor = getDefaultColorForFarmKey(farmKey);
        }
        
        try {
            await collection.updateOne(
                { _id: farmKey },
                { 
                    $set: { 
                        color: validColor,
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
            
            return res.json({
                success: true,
                farmKey,
                color: validColor,
                palette: DISTINCT_COLORS
            });
            
        } catch (e) {
            console.error('Error saving user color:', e);
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};

module.exports.DISTINCT_COLORS = DISTINCT_COLORS;
module.exports.getDefaultColorForFarmKey = getDefaultColorForFarmKey;
