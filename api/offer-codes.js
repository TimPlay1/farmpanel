const { connectToDatabase } = require('./_lib/db');

/**
 * API для управления кодами офферов пользователей
 * 
 * Каждый пользователь панели может регистрировать свои уникальные коды
 * Коды хранятся централизованно и используются для сопоставления офферов на Eldorado
 * 
 * Collections:
 * - offer_codes: { code, farmKey, brainrotName, income, createdAt, ... }
 * - global_offers: все найденные офферы с кодами на Eldorado
 */

/**
 * Генерирует уникальный код оффера
 * Формат: 2 буквы префикса + 6 символов = 8 символов
 */
function generateOfferCode(prefix = '') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = prefix.toUpperCase().substring(0, 2);
    
    // Если префикс короче 2 символов - добавляем случайные
    while (code.length < 2) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    
    // Добавляем 6 случайных символов
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    
    return code;
}

/**
 * Проверяет уникальность кода в базе
 */
async function isCodeUnique(db, code) {
    const codesCollection = db.collection('offer_codes');
    const existing = await codesCollection.findOne({ code: code.toUpperCase() });
    return !existing;
}

/**
 * Генерирует гарантированно уникальный код
 */
async function generateUniqueCode(db, prefix = '') {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
        const code = generateOfferCode(prefix);
        if (await isCodeUnique(db, code)) {
            return code;
        }
        attempts++;
    }
    
    // Fallback: добавляем timestamp
    return generateOfferCode(prefix) + Date.now().toString(36).slice(-2).toUpperCase();
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { db } = await connectToDatabase();
        const codesCollection = db.collection('offer_codes');
        
        // Создаём индексы при первом обращении
        await codesCollection.createIndex({ code: 1 }, { unique: true });
        await codesCollection.createIndex({ farmKey: 1 });
        await codesCollection.createIndex({ createdAt: -1 });

        // GET - получить коды пользователя или проверить код
        if (req.method === 'GET') {
            const { farmKey, code, checkOwner } = req.query;
            
            // Проверка владельца кода
            if (checkOwner && code) {
                const normalizedCode = code.toUpperCase().replace(/^#/, '');
                const codeDoc = await codesCollection.findOne({ code: normalizedCode });
                
                if (codeDoc) {
                    return res.json({
                        found: true,
                        code: codeDoc.code,
                        farmKey: codeDoc.farmKey,
                        brainrotName: codeDoc.brainrotName,
                        income: codeDoc.income,
                        createdAt: codeDoc.createdAt
                    });
                }
                return res.json({ found: false, code: normalizedCode });
            }
            
            // Получить все коды пользователя
            if (!farmKey) {
                return res.status(400).json({ error: 'farmKey is required' });
            }
            
            const codes = await codesCollection.find({ farmKey })
                .sort({ createdAt: -1 })
                .toArray();
            
            return res.json({ 
                codes,
                count: codes.length
            });
        }

        // POST - зарегистрировать новый код
        if (req.method === 'POST') {
            const { 
                farmKey, 
                code,          // опционально - можно передать свой код
                brainrotName,
                income,
                incomeRaw,
                imageUrl,
                prefix = ''    // префикс для автогенерации (2 буквы магазина)
            } = req.body;

            if (!farmKey) {
                return res.status(400).json({ error: 'farmKey is required' });
            }

            let finalCode;
            
            if (code) {
                // Пользователь передал свой код - проверяем уникальность
                const normalizedCode = code.toUpperCase().replace(/^#/, '');
                
                if (normalizedCode.length < 4 || normalizedCode.length > 12) {
                    return res.status(400).json({ error: 'Code must be 4-12 characters' });
                }
                
                if (!/^[A-Z0-9]+$/.test(normalizedCode)) {
                    return res.status(400).json({ error: 'Code must contain only letters and numbers' });
                }
                
                const existing = await codesCollection.findOne({ code: normalizedCode });
                if (existing) {
                    if (existing.farmKey === farmKey) {
                        // Уже принадлежит этому пользователю - обновляем
                        await codesCollection.updateOne(
                            { code: normalizedCode },
                            { 
                                $set: { 
                                    brainrotName,
                                    income: parseFloat(income) || 0,
                                    incomeRaw,
                                    imageUrl,
                                    updatedAt: new Date()
                                }
                            }
                        );
                        return res.json({ 
                            success: true, 
                            code: normalizedCode,
                            updated: true
                        });
                    }
                    return res.status(409).json({ 
                        error: 'Code already registered by another user',
                        code: normalizedCode
                    });
                }
                finalCode = normalizedCode;
            } else {
                // Автогенерация уникального кода
                finalCode = await generateUniqueCode(db, prefix);
            }

            // Создаём запись
            const codeDoc = {
                code: finalCode,
                farmKey,
                brainrotName: brainrotName || null,
                income: parseFloat(income) || 0,
                incomeRaw: incomeRaw || null,
                imageUrl: imageUrl || null,
                status: 'pending', // pending пока не найден на Eldorado
                eldoradoOfferId: null,
                currentPrice: null,
                lastSeenAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await codesCollection.insertOne(codeDoc);

            return res.json({ 
                success: true, 
                code: finalCode,
                created: true
            });
        }

        // PUT - обновить информацию о коде
        if (req.method === 'PUT') {
            const { farmKey, code, brainrotName, income, incomeRaw, imageUrl, status } = req.body;

            if (!farmKey || !code) {
                return res.status(400).json({ error: 'farmKey and code are required' });
            }

            const normalizedCode = code.toUpperCase().replace(/^#/, '');
            
            // Проверяем что код принадлежит этому пользователю
            const existing = await codesCollection.findOne({ code: normalizedCode });
            if (!existing) {
                return res.status(404).json({ error: 'Code not found' });
            }
            if (existing.farmKey !== farmKey) {
                return res.status(403).json({ error: 'Code belongs to another user' });
            }

            const update = { updatedAt: new Date() };
            if (brainrotName !== undefined) update.brainrotName = brainrotName;
            if (income !== undefined) update.income = parseFloat(income) || 0;
            if (incomeRaw !== undefined) update.incomeRaw = incomeRaw;
            if (imageUrl !== undefined) update.imageUrl = imageUrl;
            if (status !== undefined) update.status = status;

            await codesCollection.updateOne(
                { code: normalizedCode },
                { $set: update }
            );

            return res.json({ success: true });
        }

        // DELETE - удалить код
        if (req.method === 'DELETE') {
            const { farmKey, code } = req.query;

            if (!farmKey || !code) {
                return res.status(400).json({ error: 'farmKey and code are required' });
            }

            const normalizedCode = code.toUpperCase().replace(/^#/, '');
            
            // Проверяем что код принадлежит этому пользователю
            const existing = await codesCollection.findOne({ code: normalizedCode });
            if (!existing) {
                return res.status(404).json({ error: 'Code not found' });
            }
            if (existing.farmKey !== farmKey) {
                return res.status(403).json({ error: 'Code belongs to another user' });
            }

            await codesCollection.deleteOne({ code: normalizedCode });
            
            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Offer codes API error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Экспорт функций для использования в других модулях
module.exports.generateOfferCode = generateOfferCode;
module.exports.generateUniqueCode = generateUniqueCode;
module.exports.isCodeUnique = isCodeUnique;
