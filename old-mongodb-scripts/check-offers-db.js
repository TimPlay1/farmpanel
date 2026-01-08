/**
 * Check offers in MongoDB to find source of $109 price
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';

async function checkOffers() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('farmpanel');
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name).join(', '));
    
    // Check offers collection
    for (const colName of ['offers', 'eldorado_offers', 'user_offers']) {
        try {
            const collection = db.collection(colName);
            const count = await collection.countDocuments();
            console.log(`\n${colName}: ${count} documents`);
            
            if (count > 0) {
                // Find Esok Sekolah offers
                const esokOffers = await collection.find({
                    $or: [
                        { brainrotName: /esok sekolah/i },
                        { name: /esok sekolah/i },
                        { title: /esok sekolah/i }
                    ]
                }).limit(5).toArray();
                
                console.log(`  Esok Sekolah offers: ${esokOffers.length}`);
                for (const offer of esokOffers) {
                    console.log(`    - income: ${offer.income}, currentPrice: $${offer.currentPrice}, recommendedPrice: $${offer.recommendedPrice}, nextCompetitorPrice: $${offer.nextCompetitorPrice}`);
                }
                
                // Find any offer with price ~$109
                const highPrices = await collection.find({
                    $or: [
                        { currentPrice: { $gte: 100, $lte: 120 } },
                        { recommendedPrice: { $gte: 100, $lte: 120 } },
                        { nextCompetitorPrice: { $gte: 100, $lte: 120 } }
                    ]
                }).limit(10).toArray();
                
                console.log(`  Offers with price ~$100-120: ${highPrices.length}`);
                for (const offer of highPrices) {
                    console.log(`    - ${offer.brainrotName || offer.name}: current=$${offer.currentPrice}, rec=$${offer.recommendedPrice}, next=$${offer.nextCompetitorPrice}`);
                }
            }
        } catch (e) {
            console.log(`${colName}: ${e.message}`);
        }
    }
    
    // Check farmers collection for stored prices
    try {
        const farmersCol = db.collection('farmers');
        const count = await farmersCol.countDocuments();
        console.log(`\nfarmers: ${count} documents`);
        
        if (count > 0) {
            const sample = await farmersCol.findOne();
            console.log('  Sample keys:', Object.keys(sample).join(', '));
            
            // Check if prices are stored inside farmers
            if (sample.prices) {
                console.log('  Has prices field!');
                const priceKeys = Object.keys(sample.prices).slice(0, 5);
                console.log('  Price keys sample:', priceKeys);
            }
        }
    } catch (e) {
        console.log(`farmers: ${e.message}`);
    }
    
    await client.close();
}

checkOffers().catch(console.error);
