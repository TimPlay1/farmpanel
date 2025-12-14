module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        // Fetch from Roblox Thumbnails API
        const response = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
        );
        
        const data = await response.json();
        
        if (data.data && data.data[0]) {
            return res.status(200).json({ 
                imageUrl: data.data[0].imageUrl || null 
            });
        }
        
        return res.status(200).json({ imageUrl: null });
    } catch (error) {
        console.error('Avatar fetch error:', error);
        return res.status(200).json({ imageUrl: null });
    }
};
