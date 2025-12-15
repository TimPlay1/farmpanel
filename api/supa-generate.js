const fetch = require('node-fetch');
const FormData = require('form-data');

// Supa API Configuration
const SUPA_API_KEY = process.env.SUPA_API_KEY || 'dZddxo0zt0u1MHC8YXoUgzBu5tW5JuiM';
const SUPA_API_BASE = 'https://api.supa.ru/public/v2';
const TEMPLATE_ID = 21157229;

// Template object names
const TEMPLATE_OBJECTS = {
    IMAGE: 'brainrot_image',
    NAME: 'brainrot_name',
    INCOME: 'brainrot_income'
};

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
    console.log('Image response headers:', JSON.stringify(Object.fromEntries(imageResponse.headers.entries())));
    
    if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.buffer();
    console.log('Image buffer size:', imageBuffer.length);
    
    if (imageBuffer.length === 0) {
        throw new Error('Downloaded image is empty');
    }
    
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    console.log('Content-Type:', contentType);
    
    let extension = 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        extension = 'jpg';
    } else if (contentType.includes('webp')) {
        extension = 'webp';
    }

    const formData = new FormData();
    formData.append('file', imageBuffer, {
        filename: `brainrot.${extension}`,
        contentType: contentType
    });

    console.log('Uploading to Supa API...');
    
    const uploadResponse = await fetch(`${SUPA_API_BASE}/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPA_API_KEY}`
        },
        body: formData
    });

    const uploadResult = await uploadResponse.json();
    console.log('Upload response status:', uploadResponse.status);
    console.log('Upload result:', JSON.stringify(uploadResult));

    if (uploadResult.result === 'success' && uploadResult.url) {
        console.log('=== uploadImageToSupa SUCCESS ===');
        return uploadResult.url;
    } else {
        throw new Error(uploadResult.reason || uploadResult.error || 'Upload failed - unknown reason');
    }
}

// Request render
async function requestRender(brainrotData) {
    const { name, income, supaImageUrl, borderColor } = brainrotData;

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

    let cleanIncome = income || '0/s';
    if (cleanIncome.startsWith('$')) {
        cleanIncome = cleanIncome.substring(1);
    }
    objectsOverrides[TEMPLATE_OBJECTS.INCOME] = {
        text: cleanIncome
    };

    console.log('Requesting render with overrides:', JSON.stringify(objectsOverrides, null, 2));

    const renderRequest = {
        design_id: TEMPLATE_ID,
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
        const { name, income, imageUrl, borderColor, accountId, accountName } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        console.log('=== Generate Request ===');
        console.log('Name:', name);
        console.log('Income:', income);
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
        const renderResult = await requestRender({
            name,
            income,
            supaImageUrl,
            borderColor
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
                imageUploadError: imageUploadError || null
            });
        }

        res.json({
            success: true,
            taskId: renderResult.task_id,
            resultUrl: finalResult.result_url,
            state: finalResult.state,
            brainrotName: name,
            accountId,
            accountName,
            imageUploaded: !!supaImageUrl,
            imageUploadError: imageUploadError || null
        });

    } catch (error) {
        console.error('Generate error:', error);
        res.status(500).json({ error: error.message });
    }
};
