const fetch = require('node-fetch');

const SUPA_API_KEY = process.env.SUPA_API_KEY || 'dZddxo0zt0u1MHC8YXoUgzBu5tW5JuiM';
const SUPA_API_BASE = 'https://api.supa.ru/public/v2';

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { taskId } = req.query;

    if (!taskId) {
        return res.status(400).json({ error: 'taskId is required' });
    }

    try {
        const response = await fetch(`${SUPA_API_BASE}/tasks/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${SUPA_API_KEY}`
            }
        });

        const status = await response.json();
        
        res.json({
            taskId,
            state: status.state,
            resultUrl: status.result_url || null,
            error: status.error || null
        });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: error.message });
    }
};
