/**
 * Скрипт для исправления офферов с income=0 в БД
 * Запуск: node fix-offers-income.js
 * 
 * Для каждого оффера с income=0 или null:
 * 1. Парсим income из eldoradoTitle (если есть)
 * 2. Парсим income из incomeRaw (если есть)
 * 3. Обновляем в БД
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';

function parseIncomeValue(income) {
    if (typeof income === 'number' && income > 0) return income;
    if (!income) return null;
    
    const str = String(income).replace(/[$,]/g, '').trim();
    
    // Паттерн: число (с опциональной точкой), опциональный пробел, K/M/B/T, /s
    const match = str.match(/([\d.]+)\s*([KMBT])?\/s/i);
    if (!match) {
        // Попробуем просто число
        const num = parseFloat(str);
        return num > 0 ? num : null;
    }
    
    let value = parseFloat(match[1]);
    const suffix = (match[2] || 'M').toUpperCase(); // Default M
    
    // Конвертируем в M/s
    if (suffix === 'K') value *= 0.001;
    else if (suffix === 'B') value *= 1000;
    else if (suffix === 'T') value *= 1000000;
    // M = уже в M/s
    
    return value > 0 ? value : null;
}

function parseIncomeFromTitle(title) {
    if (!title) return null;
    
    // Паттерн: $310.0M/s или 310M/s или 1.5B/s
    const match = title.match(/\$?([\d.]+)\s*([KMBT])\/s/i);
    if (!match) return null;
    
    let income = parseFloat(match[1]);
    const suffix = match[2].toUpperCase();
    
    if (suffix === 'K') income *= 0.001;
    else if (suffix === 'B') income *= 1000;
    else if (suffix === 'T') income *= 1000000;
    
    return income > 0 ? income : null;
}

async function fixOffersIncome() {
    if (!MONGODB_URI) {
        console.error('MONGODB_URI not set in environment');
        process.exit(1);
    }
    
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('farmerpanel');
        const offersCollection = db.collection('offers');
        
        // Находим все офферы с income = 0, null, или undefined
        const brokenOffers = await offersCollection.find({
            $or: [
                { income: 0 },
                { income: null },
                { income: { $exists: false } }
            ]
        }).toArray();
        
        console.log(`Found ${brokenOffers.length} offers with invalid income`);
        
        let fixed = 0;
        let failed = 0;
        
        for (const offer of brokenOffers) {
            let newIncome = null;
            let source = '';
            
            // Способ 1: Из eldoradoTitle
            if (offer.eldoradoTitle) {
                newIncome = parseIncomeFromTitle(offer.eldoradoTitle);
                if (newIncome) source = 'eldoradoTitle';
            }
            
            // Способ 2: Из incomeRaw
            if (!newIncome && offer.incomeRaw) {
                newIncome = parseIncomeValue(offer.incomeRaw);
                if (newIncome) source = 'incomeRaw';
            }
            
            if (newIncome && newIncome > 0) {
                await offersCollection.updateOne(
                    { _id: offer._id },
                    { $set: { income: newIncome, updatedAt: new Date() } }
                );
                console.log(`✅ Fixed offer ${offer.offerId}: "${offer.brainrotName}" income=${newIncome} (from ${source})`);
                fixed++;
            } else {
                console.log(`❌ Cannot fix offer ${offer.offerId}: "${offer.brainrotName}" - no valid income source`);
                console.log(`   eldoradoTitle: ${offer.eldoradoTitle || 'N/A'}`);
                console.log(`   incomeRaw: ${offer.incomeRaw || 'N/A'}`);
                failed++;
            }
        }
        
        console.log(`\nDone! Fixed: ${fixed}, Failed: ${failed}`);
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

fixOffersIncome();
