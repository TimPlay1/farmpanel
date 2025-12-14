// Generate brainrot images mapping
// Run: node generate-mapping.js

const fs = require('fs');
const path = require('path');

const BRAINROTS_JSON = path.join(__dirname, 'data', 'brainrots.json');
const IMAGES_FOLDER = path.join(__dirname, 'public', 'brainrots');
const OUTPUT_FILE = path.join(__dirname, 'public', 'brainrots-mapping.json');

// Load brainrots data
let brainrotsData = JSON.parse(fs.readFileSync(BRAINROTS_JSON, 'utf8'));

// Handle both array and object format
if (Array.isArray(brainrotsData)) {
    brainrotsData = { brainrots: brainrotsData };
}

// Get available images
const availableImages = new Set(
    fs.readdirSync(IMAGES_FOLDER)
        .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
);

console.log(`Found ${availableImages.size} images in folder`);

// Create mapping
const mapping = {};
let matched = 0;
let skipped = 0;

brainrotsData.brainrots.forEach(b => {
    if (!b.image) {
        skipped++;
        return;
    }
    
    let imageName = b.image;
    
    // Skip GIFs, find PNG alternative
    if (imageName.toLowerCase().endsWith('.gif')) {
        const baseName = imageName.slice(0, -4);
        const alternatives = [
            baseName + '.png',
            baseName + '.jpg',
            baseName + '.webp',
            baseName + '_1.png'
        ];
        
        const found = alternatives.find(alt => availableImages.has(alt));
        if (found) {
            imageName = found;
        } else {
            skipped++;
            return;
        }
    }
    
    // Check if image exists
    if (availableImages.has(imageName)) {
        mapping[b.name.toLowerCase()] = imageName;
        // Also add normalized versions
        mapping[b.name.toLowerCase().replace(/\s+/g, '_')] = imageName;
        mapping[b.name.toLowerCase().replace(/\s+/g, '')] = imageName;
        matched++;
    } else {
        skipped++;
    }
});

// Save mapping
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mapping, null, 2));

console.log(`Created mapping: ${matched} matched, ${skipped} skipped`);
console.log(`Output: ${OUTPUT_FILE}`);
