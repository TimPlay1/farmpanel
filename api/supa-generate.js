const fetch = require('node-fetch');
const FormData = require('form-data');

// ============================================
// LOCAL GENERATOR MODE (временная замена Supa API)
// Установите USE_LOCAL_GENERATOR = true для использования локального генератора
// ============================================
const USE_LOCAL_GENERATOR = process.env.USE_LOCAL_GENERATOR === 'true' || true; // По умолчанию включён

// Local generator import
let localGenerator;
try {
    localGenerator = require('./local-generate');
    console.log('[SupaGen] Local generator loaded successfully');
} catch (e) {
    console.log('[SupaGen] Local generator not available:', e.message);
    localGenerator = null;
}

// Sharp для конвертации webp в png
let sharp;
try {
    sharp = require('sharp');
    console.log('Sharp loaded successfully');
} catch (e) {
    console.log('Sharp not available, will try without conversion');
    sharp = null;
}

// Supa API Configuration (used when USE_LOCAL_GENERATOR = false)
const SUPA_API_KEY = process.env.SUPA_API_KEY || 'dZddxo0zt0u1MHC8YXoUgzBu5tW5JuiM';
const SUPA_API_BASE = 'https://api.supa.ru/public/v2';
const DEFAULT_TEMPLATE_ID = 21157229; // Default Supa template

// Template object names
const TEMPLATE_OBJECTS = {
    IMAGE: 'brainrot_image',
    NAME: 'brainrot_name',
    INCOME: 'brainrot_income',
    PRICE: 'brainrot_price'  // v9.12.50: Добавлена поддержка цены
};

// Detect image format by magic bytes
function detectImageFormat(buffer) {
    if (buffer.length < 12) return { extension: 'bin', contentType: 'application/octet-stream' };
    
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return { extension: 'png', contentType: 'image/png', format: 'png' };
    }
    
    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return { extension: 'jpg', contentType: 'image/jpeg', format: 'jpeg' };
    }
    
    // GIF: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
        return { extension: 'gif', contentType: 'image/gif', format: 'gif' };
    }
    
    // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return { extension: 'webp', contentType: 'image/webp', format: 'webp' };
    }
    
    return { extension: 'png', contentType: 'image/png', format: 'unknown' };
}

// Upload image to Supa
async function uploadImageToSupa(imageUrl) {
    console.log('=== uploadImageToSupa START ===');
    console.log('Downloading image from:', imageUrl);
    
    const imageResponse = await fetch(imageUrl, {
        headers: {
            'User-Agent': 'FarmerPanel/1.0'
        }
    });
    
    console.log('Image response status:', imageResponse.status);
    
    if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
    }

    let imageBuffer = await imageResponse.buffer();
    console.log('Image buffer size:', imageBuffer.length);
    
    if (imageBuffer.length === 0) {
        throw new Error('Downloaded image is empty');
    }
    
    // Detect actual format by magic bytes (more reliable than content-type)
    const detected = detectImageFormat(imageBuffer);
    console.log('Detected format by magic bytes:', detected);
    
    const headerContentType = imageResponse.headers.get('content-type') || 'image/png';
    console.log('Header Content-Type:', headerContentType);
    
    let extension = 'png';
    let uploadContentType = 'image/png';
    
    // Если это webp и sharp доступен - конвертируем в png
    if (detected.format === 'webp' && sharp) {
        console.log('Converting WebP to PNG using sharp...');
        try {
            imageBuffer = await sharp(imageBuffer)
                .png()
                .toBuffer();
            console.log('Converted to PNG, new size:', imageBuffer.length);
            extension = 'png';
            uploadContentType = 'image/png';
        } catch (convertError) {
            console.error('Failed to convert WebP:', convertError.message);
            // Попробуем отправить как есть
        }
    } else if (detected.format === 'jpeg' || detected.extension === 'jpg') {
        extension = 'jpg';
        uploadContentType = 'image/jpeg';
    } else if (detected.format === 'gif') {
        extension = 'gif';
        uploadContentType = 'image/gif';
    }
    
    console.log(`Using format: extension=${extension}, contentType=${uploadContentType} (original: ${detected.format})`);

    const formData = new FormData();
    formData.append('file', imageBuffer, {
        filename: `brainrot.${extension}`,
        contentType: uploadContentType
    });

    console.log('Uploading to Supa API with filename:', `brainrot.${extension}`, 'contentType:', uploadContentType);
    
    const uploadResponse = await fetch(`${SUPA_API_BASE}/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPA_API_KEY}`
        },
        body: formData
    });

    const responseText = await uploadResponse.text();
    console.log('Upload response status:', uploadResponse.status);
    console.log('Upload response body:', responseText);
    
    let uploadResult;
    try {
        uploadResult = JSON.parse(responseText);
    } catch (e) {
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
    }

    if (uploadResult.result === 'success' && uploadResult.url) {
        console.log('=== uploadImageToSupa SUCCESS ===');
        console.log('Uploaded image URL:', uploadResult.url);
        return uploadResult.url;
    } else {
        throw new Error(uploadResult.reason || uploadResult.error || uploadResult.message || `Upload failed: ${responseText.substring(0, 200)}`);
    }
}

// Request render
async function requestRender(brainrotData) {
    const { name, income, price, supaImageUrl, borderColor, customTemplateId } = brainrotData;

    const objectsOverrides = {};

    if (supaImageUrl) {
        const imageOverride = {
            background: {
                type: 'image',
                path: supaImageUrl
            }
        };
        
        // Согласно документации Supa API, border требует: width, color, style
        if (borderColor) {
            imageOverride.border = {
                width: 5,
                color: borderColor,
                style: 'solid'  // обязательное поле: "solid" или "dashed"
            };
        }
        
        objectsOverrides[TEMPLATE_OBJECTS.IMAGE] = imageOverride;
    }

    objectsOverrides[TEMPLATE_OBJECTS.NAME] = {
        text: name || 'Unknown Brainrot'
    };

    // Income - используем substyle для зелёного цвета #1BFF00
    let cleanIncome = income || '0/s';
    if (cleanIncome.startsWith('$')) {
        cleanIncome = cleanIncome.substring(1);
    }
    objectsOverrides[TEMPLATE_OBJECTS.INCOME] = {
        text: `<substyle color="#1BFF00">${cleanIncome}</substyle>`
    };

    // v9.12.50: Price - жёлтый цвет для цены
    // v9.12.52: DISABLED - объект brainrot_price не существует в текущем шаблоне Supa
    // Чтобы включить - нужно добавить текстовый объект brainrot_price в шаблон на сupa.ru
    // if (price && price.trim()) {
    //     objectsOverrides[TEMPLATE_OBJECTS.PRICE] = {
    //         text: `<substyle color="#FFD700">${price}</substyle>`
    //     };
    //     console.log('Price override added:', price);
    // }
    console.log('Price received but not rendered (no brainrot_price object in template):', price);

    console.log('Requesting render with overrides:', JSON.stringify(objectsOverrides, null, 2));

    // v9.9.5: Use custom templateId if provided, otherwise use default
    const templateId = customTemplateId || DEFAULT_TEMPLATE_ID;
    
    const renderRequest = {
        design_id: templateId,
        format: 'png',
        objects_overrides: objectsOverrides
    };

    const response = await fetch(`${SUPA_API_BASE}/render`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPA_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(renderRequest)
    });

    const result = await response.json();
    console.log('Render request result:', result);

    if (result.error) {
        throw new Error(`Render error: ${result.error} - ${result.description}`);
    }

    return result;
}

// Check render status
async function checkRenderStatus(taskId) {
    const response = await fetch(`${SUPA_API_BASE}/tasks/${taskId}`, {
        headers: {
            'Authorization': `Bearer ${SUPA_API_KEY}`
        }
    });

    return response.json();
}

// Wait for render to complete (optimized for Vercel 10s limit)
async function waitForRender(taskId, maxAttempts = 4) {
    for (let i = 0; i < maxAttempts; i++) {
        const status = await checkRenderStatus(taskId);
        console.log(`Render status (attempt ${i + 1}):`, status.state);

        if (status.state === 'done') {
            return status;
        }

        if (status.state === 'error') {
            throw new Error('Render failed');
        }

        // Wait 1.5 seconds between checks (total ~6s max for polling)
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Return pending status instead of error - client will poll
    return { state: 'pending', task_id: taskId };
}

// ============================================
// LOCAL GENERATION HANDLER
// ============================================
async function handleLocalGeneration(req, res, params) {
    const { 
        name, income, price, imageUrl, accountId, accountName, mutation, titleText,
        // Новые параметры настроек генератора
        borderColor, titleColor, titleGlow, incomeColor, fontFamily
    } = params;
    
    console.log('[SupaGen] Using LOCAL generator');
    console.log('[SupaGen] === Local Generate Request ===');
    console.log('[SupaGen] Name:', name);
    console.log('[SupaGen] Income:', income);
    console.log('[SupaGen] Price:', price);
    console.log('[SupaGen] Image URL:', imageUrl?.substring(0, 50));
    console.log('[SupaGen] Border Color:', borderColor);
    console.log('[SupaGen] Title Color:', titleColor);
    console.log('[SupaGen] Income Color:', incomeColor);
    console.log('[SupaGen] Font:', fontFamily);
    console.log('[SupaGen] Mutation:', mutation || 'none');
    console.log('[SupaGen] Title:', titleText || 'MY SHOP');

    try {
        // Генерируем изображение локально с полными настройками
        const imageBuffer = await localGenerator.generateBrainrotImage({
            name,
            income: income || '0/s',
            imageUrl,
            borderColor: borderColor || '#ff0000',
            mutation,
            titleText: titleText || 'MY SHOP',
            // Настройки генератора
            titleColor: titleColor || '#ffff00',
            titleGlow: titleGlow || '#ff6600',
            incomeColor: incomeColor || '#1bff00',
            fontFamily: fontFamily || 'Press Start 2P'
        });

        // Сохраняем файл
        const filename = localGenerator.generateFilename(name);
        const savedPath = await localGenerator.saveGeneratedImage(imageBuffer, filename);
        
        // URL для доступа к файлу
        const resultUrl = `/generated/${filename}`;

        console.log('[SupaGen] Local generation complete, URL:', resultUrl);

        return res.json({
            success: true,
            resultUrl,
            localPath: savedPath,
            brainrotName: name,
            accountId,
            accountName,
            generator: 'local',
            imageUploaded: true,
            imageUploadError: null
        });

    } catch (error) {
        console.error('[SupaGen] Local generate error:', error);
        throw error;
    }
}

// ============================================
// SUPA API GENERATION HANDLER
// ============================================
async function handleSupaGeneration(req, res, params) {
    const { name, income, price, imageUrl, borderColor, accountId, accountName, templateId } = params;
    
    console.log('[SupaGen] Using SUPA API generator');
    console.log('=== Supa Generate Request ===');
    console.log('Name:', name);
    console.log('Income:', income);
    console.log('Price:', price);
    console.log('Image URL:', imageUrl);
    console.log('Border Color:', borderColor);

    // Upload image to Supa
    let supaImageUrl = null;
    let imageUploadError = null;
    
    if (imageUrl && imageUrl.startsWith('http')) {
        try {
            supaImageUrl = await uploadImageToSupa(imageUrl);
            console.log('Supa image URL:', supaImageUrl);
        } catch (uploadError) {
            imageUploadError = uploadError.message;
            console.error('Failed to upload image:', uploadError.message);
            console.error('Stack:', uploadError.stack);
        }
    } else {
        console.log('No valid imageUrl provided:', imageUrl);
    }

    // Request render
    // v9.9.5: Support custom templateId
    const customTemplateId = templateId ? parseInt(templateId, 10) : null;
    const renderResult = await requestRender({
        name,
        income,
        price,
        supaImageUrl,
        borderColor,
        customTemplateId
    });

    console.log('Render requested with supaImageUrl:', supaImageUrl);

    if (!renderResult.task_id) {
        throw new Error('No task_id received');
    }

    // Wait for render
    console.log('Waiting for render to complete...');
    const finalResult = await waitForRender(renderResult.task_id);

    console.log('Render result:', finalResult);

    // If still pending, return task_id for client polling
    if (finalResult.state === 'pending') {
        return res.json({
            success: true,
            pending: true,
            taskId: renderResult.task_id,
            statusUrl: `/api/supa-status?taskId=${renderResult.task_id}`,
            brainrotName: name,
            accountId,
            accountName,
            imageUploaded: !!supaImageUrl,
            imageUploadError: imageUploadError || null,
            generator: 'supa'
        });
    }

    return res.json({
        success: true,
        taskId: renderResult.task_id,
        resultUrl: finalResult.result_url,
        state: finalResult.state,
        brainrotName: name,
        accountId,
        accountName,
        imageUploaded: !!supaImageUrl,
        imageUploadError: imageUploadError || null,
        generator: 'supa'
    });
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, income, price, imageUrl, borderColor, accountId, accountName, templateId, useLocal, mutation, titleText } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        const params = { name, income, price, imageUrl, borderColor, accountId, accountName, templateId, mutation, titleText };

        // Выбираем генератор: локальный или Supa
        // Приоритет: 1) параметр запроса useLocal, 2) глобальная настройка USE_LOCAL_GENERATOR, 3) наличие локального генератора
        const shouldUseLocal = useLocal !== undefined 
            ? useLocal 
            : (USE_LOCAL_GENERATOR && localGenerator);

        if (shouldUseLocal && localGenerator) {
            return await handleLocalGeneration(req, res, params);
        } else {
            return await handleSupaGeneration(req, res, params);
        }

    } catch (error) {
        console.error('Generate error:', error);
        res.status(500).json({ error: error.message });
    }
};
