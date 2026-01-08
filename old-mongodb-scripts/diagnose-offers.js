/**
 * Диагностический скрипт для проверки статусов офферов
 */
const { MongoClient } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/?appName=farmpanel';

async function diagnose() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('farmerpanel');
    
    const farmKey = 'FARM-7VZV-EY4Y-1OOX-IOQJ';
    
    console.log('=== ДИАГНОСТИКА ОФФЕРОВ ===\n');
    
    // 1. Получаем все офферы пользователя
    const offers = await db.collection('offers').find({ farmKey }).toArray();
    console.log(`Всего офферов: ${offers.length}\n`);
    
    // 2. Группируем по статусам
    const byStatus = { active: [], pending: [], paused: [] };
    for (const o of offers) {
        const status = o.status || 'unknown';
        if (!byStatus[status]) byStatus[status] = [];
        byStatus[status].push(o);
    }
    
    console.log('По статусам:');
    console.log(`  Active: ${byStatus.active?.length || 0}`);
    console.log(`  Pending: ${byStatus.pending?.length || 0}`);
    console.log(`  Paused: ${byStatus.paused?.length || 0}`);
    
    // 3. Примеры pending офферов
    console.log('\n=== PENDING офферы (должны быть активны?) ===');
    const pendingSample = (byStatus.pending || []).slice(0, 10);
    for (const o of pendingSample) {
        console.log(`  ${o.offerId}: ${o.brainrotName} | income=${o.income} | price=$${o.currentPrice || 'N/A'}`);
        console.log(`    createdAt: ${o.createdAt}`);
        console.log(`    updatedAt: ${o.updatedAt}`);
        console.log(`    lastScannedAt: ${o.lastScannedAt || 'NEVER'}`);
    }
    
    // 4. Примеры paused офферов
    console.log('\n=== PAUSED офферы (возможно активны на Eldorado?) ===');
    const pausedSample = (byStatus.paused || []).slice(0, 10);
    for (const o of pausedSample) {
        console.log(`  ${o.offerId}: ${o.brainrotName} | income=${o.income} | price=$${o.currentPrice || 'N/A'}`);
        console.log(`    pausedAt: ${o.pausedAt}`);
        console.log(`    lastScannedAt: ${o.lastScannedAt || 'NEVER'}`);
    }
    
    // 5. Los Bros и Los Primos для проверки
    console.log('\n=== Los Bros офферы ===');
    const losBros = offers.filter(o => o.brainrotName?.toLowerCase().includes('los bros'));
    for (const o of losBros) {
        console.log(`  ${o.offerId}: ${o.brainrotName} | income=${o.income} | status=${o.status} | mutation=${o.mutation || 'none'}`);
        console.log(`    currentPrice=$${o.currentPrice} | lastScannedAt=${o.lastScannedAt || 'NEVER'}`);
    }
    
    console.log('\n=== Los Primos офферы ===');
    const losPrimos = offers.filter(o => o.brainrotName?.toLowerCase().includes('los primos'));
    for (const o of losPrimos) {
        console.log(`  ${o.offerId}: ${o.brainrotName} | income=${o.income} | status=${o.status} | mutation=${o.mutation || 'none'}`);
        console.log(`    currentPrice=$${o.currentPrice} | lastScannedAt=${o.lastScannedAt || 'NEVER'}`);
    }
    
    // 6. Проверяем scan_state
    console.log('\n=== SCAN STATE ===');
    const scanState = await db.collection('scan_state').find({}).toArray();
    for (const s of scanState) {
        console.log(`  ${s._id}:`, JSON.stringify(s, null, 2));
    }
    
    // 7. Проверяем офферы которые давно не сканировались
    console.log('\n=== ОФФЕРЫ НЕ СКАНИРОВАВШИЕСЯ >1 часа ===');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const notScanned = offers.filter(o => !o.lastScannedAt || new Date(o.lastScannedAt) < oneHourAgo);
    console.log(`Не сканировались >1 часа: ${notScanned.length} из ${offers.length}`);
    
    if (notScanned.length > 0) {
        console.log('Примеры:');
        for (const o of notScanned.slice(0, 5)) {
            console.log(`  ${o.offerId}: ${o.brainrotName} | status=${o.status} | lastScanned=${o.lastScannedAt || 'NEVER'}`);
        }
    }
    
    await client.close();
}

diagnose().catch(console.error);
