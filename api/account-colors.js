// Упрощённая палитра - только легко различимые цвета
// 12 максимально контрастных цветов
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

// Генерация цвета на основе farmKey (не accountId!)
// Цвет привязывается к пользователю панели
function getColorForFarmKey(farmKey) {
    if (!farmKey) return DISTINCT_COLORS[0];
    
    let hash = 0;
    const str = String(farmKey);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    
    return DISTINCT_COLORS[Math.abs(hash) % DISTINCT_COLORS.length];
}

// Старая функция для совместимости
function getAccountColor(accountId) {
    const colors = DISTINCT_COLORS;
    
    let hash = 0;
    const str = String(accountId);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    
    return colors[Math.abs(hash) % colors.length];
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get accountIds or farmKey from query
    const { accountIds, farmKey } = req.query;

    // Если передан farmKey - возвращаем цвет для этого пользователя
    if (farmKey) {
        return res.json({ 
            farmKey,
            color: getColorForFarmKey(farmKey),
            palette: DISTINCT_COLORS
        });
    }

    if (!accountIds) {
        return res.json({ colors: {}, palette: DISTINCT_COLORS });
    }

    // Parse account IDs (comma-separated)
    const ids = accountIds.split(',').filter(id => id.trim());
    
    const colors = {};
    ids.forEach(id => {
        colors[id] = getAccountColor(id);
    });

    res.json({ colors });
};
