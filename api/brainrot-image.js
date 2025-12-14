// Brainrot images mapping - fetched from sabwikiparser
// This file is auto-generated

const BRAINROT_IMAGES = {
    // Will be populated from brainrots.json
    // Format: "brainrot_name": "image_filename"
};

// Load brainrots from JSON if available
let brainrotsData = null;
try {
    // This will be bundled or loaded dynamically
    brainrotsData = require('../data/brainrots.json');
} catch (e) {
    // File not found, use empty
}

if (brainrotsData && brainrotsData.brainrots) {
    brainrotsData.brainrots.forEach(b => {
        if (b.image && !b.image.toLowerCase().endsWith('.gif')) {
            BRAINROT_IMAGES[b.name.toLowerCase()] = b.image;
        }
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name } = req.query;
        
        if (!name) {
            // Return all brainrot images
            return res.status(200).json({ images: BRAINROT_IMAGES });
        }

        // Find specific brainrot image
        const normalized = name.toLowerCase().trim();
        const image = BRAINROT_IMAGES[normalized] || 
                      BRAINROT_IMAGES[normalized.replace(/\s+/g, '_')] ||
                      BRAINROT_IMAGES[normalized.replace(/\s+/g, '')];
        
        if (image) {
            return res.status(200).json({ 
                name: name,
                image: image,
                url: `https://raw.githubusercontent.com/YOUR_USERNAME/farmerpanel/main/public/brainrots/${image}`
            });
        }
        
        return res.status(404).json({ error: 'Brainrot image not found' });
    } catch (error) {
        console.error('Brainrot image error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
