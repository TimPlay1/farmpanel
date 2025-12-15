// Generate unique color for account based on account ID
function getAccountColor(accountId) {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8B500', '#00CED1', '#FF69B4', '#7FFF00', '#FF4500'
    ];
    
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

    // Get accountIds from query
    const { accountIds } = req.query;

    if (!accountIds) {
        return res.json({ colors: {} });
    }

    // Parse account IDs (comma-separated)
    const ids = accountIds.split(',').filter(id => id.trim());
    
    const colors = {};
    ids.forEach(id => {
        colors[id] = getAccountColor(id);
    });

    res.json({ colors });
};
