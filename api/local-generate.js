/**
 * Local Image Generator - замена Supa API
 * Использует @napi-rs/canvas для генерации изображений локально
 * 
 * Шаблон: красная неоновая рамка с ABOBA STORE заголовком
 * - Шрифт Press Start 2P для всех текстов
 * - Закруглённые углы рамки
 * - Название brainrot слева вверху
 * - Мутация справа вверху (если есть)
 * - Outline подсветка для изображения brainrot
 * - Цветофильтр в цвет мутации
 * 
 * Размер: 1920x1920
 */

const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

// Регистрируем шрифт Press Start 2P
const fontsDir = path.join(__dirname, '..', 'fonts');
if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
}

// Проверяем наличие шрифта
const fontPath = path.join(fontsDir, 'PressStart2P-Regular.ttf');
let fontRegistered = false;

async function ensureFontLoaded() {
    if (fontRegistered) return;
    
    if (!fs.existsSync(fontPath)) {
        console.log('[LocalGen] Downloading Press Start 2P font...');
        try {
            const response = await fetch('https://github.com/google/fonts/raw/main/ofl/pressstart2p/PressStart2P-Regular.ttf');
            if (response.ok) {
                const buffer = await response.buffer();
                fs.writeFileSync(fontPath, buffer);
                console.log('[LocalGen] Font downloaded successfully');
            }
        } catch (e) {
            console.error('[LocalGen] Failed to download font:', e.message);
        }
    }
    
    if (fs.existsSync(fontPath)) {
        GlobalFonts.registerFromPath(fontPath, 'Press Start 2P');
        fontRegistered = true;
        console.log('[LocalGen] Press Start 2P font registered');
    }
}

// Размер изображения
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1920;

// Стили мутаций (соответствуют app.js getMutationStyles)
const MUTATION_STYLES = {
    'Gold': {
        colors: ['#FFD700', '#FFA500'],
        textColor: '#4a3500',
        glowColor: '#FFD700',
        filterColor: 'rgba(255, 215, 0, 0.15)'
    },
    'Diamond': {
        colors: ['#00BFFF', '#87CEEB'],
        textColor: '#003366',
        glowColor: '#00BFFF',
        filterColor: 'rgba(0, 191, 255, 0.15)'
    },
    'Bloodrot': {
        colors: ['#8B0000', '#DC143C'],
        textColor: '#ffcccc',
        glowColor: '#DC143C',
        filterColor: 'rgba(220, 20, 60, 0.15)'
    },
    'Rainbow': {
        colors: ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff'],
        textColor: '#ffffff',
        glowColor: '#ff00ff',
        filterColor: 'rgba(255, 0, 255, 0.1)'
    },
    'Candy': {
        colors: ['#FF69B4', '#FF1493'],
        textColor: '#4a0020',
        glowColor: '#FF69B4',
        filterColor: 'rgba(255, 105, 180, 0.15)'
    },
    'Lava': {
        colors: ['#FF4500', '#FF6347'],
        textColor: '#3d0000',
        glowColor: '#FF4500',
        filterColor: 'rgba(255, 69, 0, 0.15)'
    },
    'Galaxy': {
        colors: ['#9400D3', '#4B0082'],
        textColor: '#e0c0ff',
        glowColor: '#9400D3',
        filterColor: 'rgba(148, 0, 211, 0.15)'
    },
    'YinYang': {
        colors: ['#333333', '#ffffff', '#333333'],
        textColor: '#000000',
        glowColor: '#888888',
        filterColor: 'rgba(128, 128, 128, 0.1)'
    },
    'Yin Yang': {
        colors: ['#333333', '#ffffff', '#333333'],
        textColor: '#000000',
        glowColor: '#888888',
        filterColor: 'rgba(128, 128, 128, 0.1)'
    },
    'Radioactive': {
        colors: ['#32CD32', '#00FF00'],
        textColor: '#003300',
        glowColor: '#32CD32',
        filterColor: 'rgba(50, 205, 50, 0.15)'
    },
    'Cursed': {
        colors: ['#1a0000', '#4a0a0a', '#8b0000'],
        textColor: '#ff6666',
        glowColor: '#ff0000',
        filterColor: 'rgba(255, 0, 0, 0.15)'
    }
};

// Цвета по умолчанию
const COLORS = {
    background: '#1a0a2e',      // Тёмный фиолетовый фон
    border: '#ff0000',          // Красная рамка
    borderGlow: '#ff0000',      // Свечение рамки
    title: '#ffff00',           // Жёлтый заголовок ABOBA STORE
    income: '#1BFF00',          // Зелёный доход
    incomeStroke: '#000000',    // Обводка текста
    nameColor: '#ffffff',       // Белый цвет для названия
};

/**
 * Получить стили мутации
 */
function getMutationStyle(mutation) {
    if (!mutation) return null;
    
    // Очищаем от HTML тегов
    let clean = mutation.replace(/<[^>]+>/g, '').trim();
    
    // Нормализуем Yin Yang
    if (clean.toLowerCase().includes('yin') && clean.toLowerCase().includes('yang')) {
        clean = 'YinYang';
    }
    
    return MUTATION_STYLES[clean] || {
        colors: ['#888888'],
        textColor: '#ffffff',
        glowColor: '#888888',
        filterColor: 'rgba(128, 128, 128, 0.1)'
    };
}

/**
 * Очистка названия мутации
 */
function cleanMutationText(mutation) {
    if (!mutation) return '';
    return mutation.replace(/<[^>]+>/g, '').trim();
}

/**
 * Скачивание изображения и конвертация в Buffer
 * Поддерживает HTTP URL и data URL (base64)
 */
async function downloadImage(imageUrl) {
    if (!imageUrl) return null;
    
    try {
        // Поддержка data URL (base64)
        if (imageUrl.startsWith('data:')) {
            console.log('[LocalGen] Decoding base64 image...');
            const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                const buffer = Buffer.from(matches[2], 'base64');
                console.log('[LocalGen] Base64 image decoded, size:', buffer.length);
                return buffer;
            }
            throw new Error('Invalid data URL format');
        }
        
        // Поддержка локального файла
        if (imageUrl.startsWith('file://') || (imageUrl.length < 500 && fs.existsSync(imageUrl))) {
            const filePath = imageUrl.startsWith('file://') ? imageUrl.slice(7) : imageUrl;
            console.log('[LocalGen] Loading local file:', filePath);
            const buffer = fs.readFileSync(filePath);
            console.log('[LocalGen] Local file loaded, size:', buffer.length);
            return buffer;
        }
        
        // HTTP/HTTPS URL
        console.log('[LocalGen] Downloading image:', imageUrl.substring(0, 100));
        
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'FarmerPanel/1.0'
            },
            timeout: 15000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const buffer = await response.buffer();
        console.log('[LocalGen] Image downloaded, size:', buffer.length);
        
        return buffer;
    } catch (error) {
        console.error('[LocalGen] Failed to download image:', error.message);
        return null;
    }
}

/**
 * Рисование закруглённого прямоугольника
 */
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Рисование неонового свечения для рамки с закруглёнными углами
 */
function drawNeonRoundedBorder(ctx, x, y, width, height, radius, color, glowSize = 25) {
    ctx.save();
    
    // Парсим цвет
    let r = 255, g = 0, b = 0;
    if (color.startsWith('#')) {
        r = parseInt(color.slice(1, 3), 16);
        g = parseInt(color.slice(3, 5), 16);
        b = parseInt(color.slice(5, 7), 16);
    }
    
    // Несколько слоёв свечения для эффекта неона
    for (let i = glowSize; i > 0; i -= 3) {
        const alpha = 0.3 - (i / glowSize) * 0.25;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = i * 2;
        roundRect(ctx, x, y, width, height, radius);
        ctx.stroke();
    }
    
    // Основная рамка (уменьшенная толщина)
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    roundRect(ctx, x, y, width, height, radius);
    ctx.stroke();
    
    // Внутреннее свечение
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
    ctx.lineWidth = 2;
    roundRect(ctx, x + 3, y + 3, width - 6, height - 6, radius - 2);
    ctx.stroke();
    
    ctx.restore();
}

/**
 * Рисование текста с обводкой и подчёркиванием
 */
function drawStyledText(ctx, text, x, y, options = {}) {
    const {
        fontSize = 40,
        fillColor = '#ffffff',
        strokeColor = '#000000',
        strokeWidth = 4,
        align = 'center',
        baseline = 'middle',
        underline = true,
        glowColor = null,
        maxWidth = null,
        fontFamily = 'Press Start 2P'
    } = options;
    
    ctx.save();
    
    // Шрифт
    ctx.font = `${fontSize}px "${fontFamily}", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    
    // Измеряем текст
    let displayText = text;
    let textMetrics = ctx.measureText(displayText);
    
    // Обрезаем текст если нужно
    if (maxWidth && textMetrics.width > maxWidth) {
        while (textMetrics.width > maxWidth && displayText.length > 3) {
            displayText = displayText.slice(0, -1);
            textMetrics = ctx.measureText(displayText + '...');
        }
        displayText = displayText + '...';
        textMetrics = ctx.measureText(displayText);
    }
    
    // Свечение
    if (glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
    
    // Обводка
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.strokeText(displayText, x, y);
    
    // Заливка
    ctx.fillStyle = fillColor;
    ctx.fillText(displayText, x, y);
    
    // Подчёркивание
    if (underline) {
        const underlineY = y + fontSize * 0.4;
        let underlineX = x;
        const underlineWidth = textMetrics.width;
        
        if (align === 'center') {
            underlineX = x - underlineWidth / 2;
        } else if (align === 'right') {
            underlineX = x - underlineWidth;
        }
        
        ctx.fillStyle = fillColor;
        ctx.fillRect(underlineX, underlineY, underlineWidth, 4);
        
        if (glowColor) {
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 10;
            ctx.fillRect(underlineX, underlineY, underlineWidth, 4);
        }
    }
    
    ctx.restore();
    
    return textMetrics.width;
}

/**
 * Рисование многострочного текста с переносом по словам
 * Переносит целые слова на новую строку если не влезают
 */
function drawMultilineText(ctx, text, x, y, options = {}) {
    const {
        fontSize = 40,
        fillColor = '#ffffff',
        strokeColor = '#000000',
        strokeWidth = 4,
        align = 'left',
        underline = true,
        glowColor = null,
        maxWidth = 500,
        lineHeight = 1.4,
        fontFamily = 'Press Start 2P'
    } = options;
    
    ctx.save();
    
    // Шрифт
    ctx.font = `${fontSize}px "${fontFamily}", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    
    // Разбиваем текст на слова
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    // Формируем строки, не разбивая слова
    for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const testMetrics = ctx.measureText(testLine);
        
        if (testMetrics.width > maxWidth && currentLine) {
            // Текущая строка заполнена, начинаем новую
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    // Добавляем последнюю строку
    if (currentLine) {
        lines.push(currentLine);
    }
    
    // Ограничиваем до 2 строк максимум
    if (lines.length > 2) {
        lines.length = 2;
        // Добавляем ... к последней строке если обрезали
        let lastLine = lines[1];
        const lastMetrics = ctx.measureText(lastLine + '...');
        while (lastMetrics.width > maxWidth && lastLine.length > 3) {
            lastLine = lastLine.slice(0, -1);
        }
        lines[1] = lastLine + '...';
    }
    
    // Свечение
    if (glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
    
    const actualLineHeight = fontSize * lineHeight;
    
    // Рисуем каждую строку
    lines.forEach((line, index) => {
        const lineY = y + index * actualLineHeight;
        const lineMetrics = ctx.measureText(line);
        
        // Обводка
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(line, x, lineY);
        
        // Заливка
        ctx.fillStyle = fillColor;
        ctx.fillText(line, x, lineY);
        
        // Подчёркивание
        if (underline) {
            const underlineY = lineY + fontSize + 4;
            let underlineX = x;
            
            if (align === 'center') {
                underlineX = x - lineMetrics.width / 2;
            } else if (align === 'right') {
                underlineX = x - lineMetrics.width;
            }
            
            ctx.fillStyle = fillColor;
            ctx.fillRect(underlineX, underlineY, lineMetrics.width, 4);
        }
    });
    
    ctx.restore();
    
    return lines.length * actualLineHeight;
}

/**
 * Рисование мутации с градиентом
 */
function drawMutationBadge(ctx, mutation, x, y, options = {}) {
    const {
        fontSize = 32,
        align = 'right',
        fontFamily = 'Press Start 2P'
    } = options;
    
    const style = getMutationStyle(mutation);
    const text = cleanMutationText(mutation);
    
    if (!text || !style) return;
    
    ctx.save();
    
    ctx.font = `${fontSize}px "${fontFamily}", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    
    const textMetrics = ctx.measureText(text);
    const padding = 15;
    const badgeWidth = textMetrics.width + padding * 2;
    const badgeHeight = fontSize + padding;
    
    let badgeX = x;
    if (align === 'right') {
        badgeX = x - badgeWidth;
    } else if (align === 'center') {
        badgeX = x - badgeWidth / 2;
    }
    
    // Свечение бейджа
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = 20;
    
    // Градиентный фон
    const gradient = ctx.createLinearGradient(badgeX, y, badgeX + badgeWidth, y);
    const colors = style.colors;
    colors.forEach((color, i) => {
        gradient.addColorStop(i / (colors.length - 1 || 1), color);
    });
    
    ctx.fillStyle = gradient;
    roundRect(ctx, badgeX, y - badgeHeight / 2, badgeWidth, badgeHeight, 8);
    ctx.fill();
    
    // Текст
    ctx.shadowBlur = 0;
    ctx.fillStyle = style.textColor;
    ctx.textAlign = 'center';
    ctx.fillText(text, badgeX + badgeWidth / 2, y);
    
    // Подчёркивание внутри бейджа
    const underlineY = y + fontSize * 0.35;
    ctx.fillStyle = style.textColor;
    ctx.fillRect(badgeX + padding, underlineY, badgeWidth - padding * 2, 3);
    
    ctx.restore();
}

/**
 * Рисование изображения brainrot с слабой подсветкой по контуру
 * Изображение масштабируется внутрь области (contain), фон не заполняется
 */
async function drawBrainrotWithOutline(ctx, imageBuffer, x, y, width, height, mutation = null, clipRadius = 0) {
    if (!imageBuffer) return false;
    
    try {
        const brainrotImg = await loadImage(imageBuffer);
        
        // Стиль мутации для подсветки
        const style = getMutationStyle(mutation);
        const outlineColor = style ? style.glowColor : '#ff0000';
        
        // Рассчитываем размеры с сохранением пропорций (CONTAIN - вписать внутрь)
        const imgAspect = brainrotImg.width / brainrotImg.height;
        const frameAspect = width / height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        // Contain: изображение полностью помещается внутри области
        if (imgAspect > frameAspect) {
            // Изображение шире - ограничиваем по ширине
            drawWidth = width * 0.9; // 90% ширины для отступов
            drawHeight = drawWidth / imgAspect;
        } else {
            // Изображение выше - ограничиваем по высоте
            drawHeight = height * 0.9; // 90% высоты для отступов
            drawWidth = drawHeight * imgAspect;
        }
        
        // Центрируем изображение в области
        drawX = x + (width - drawWidth) / 2;
        drawY = y + (height - drawHeight) / 2;
        
        ctx.save();
        
        // Clip к области (не заполняем фон, только ограничиваем область)
        if (clipRadius > 0) {
            roundRect(ctx, x, y, width, height, clipRadius);
            ctx.clip();
        }
        
        // Слабая полупрозрачная подсветка по контуру
        // Рисуем несколько слоёв с размытием для эффекта свечения
        ctx.shadowColor = outlineColor;
        ctx.shadowBlur = 40;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Первый слой - сильное свечение (полупрозрачное)
        ctx.globalAlpha = 0.3;
        ctx.drawImage(brainrotImg, drawX, drawY, drawWidth, drawHeight);
        
        // Второй слой - среднее свечение
        ctx.globalAlpha = 0.5;
        ctx.shadowBlur = 25;
        ctx.drawImage(brainrotImg, drawX, drawY, drawWidth, drawHeight);
        
        // Финальный слой - само изображение без свечения
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
        ctx.drawImage(brainrotImg, drawX, drawY, drawWidth, drawHeight);
        
        ctx.restore();
        
        return true;
    } catch (error) {
        console.error('[LocalGen] Failed to draw brainrot image:', error.message);
        return false;
    }
}

/**
 * Рисование текста дохода (income) в стиле пикселей
 */
function drawIncomeText(ctx, income, x, y, options = {}) {
    const {
        incomeColor = COLORS.income,
        fontFamily = 'Press Start 2P'
    } = options;
    
    const fontSize = 140;
    const text = income.startsWith('$') ? income.substring(1) : income;
    
    ctx.save();
    
    ctx.font = `${fontSize}px "${fontFamily}", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    const textMetrics = ctx.measureText(text);
    const padding = 25;
    const bgWidth = textMetrics.width + padding * 2;
    const bgHeight = fontSize + padding * 1.5;
    const bgX = x - bgWidth / 2;
    const bgY = y - bgHeight;
    
    // Чёрный фон с закруглёнными углами
    ctx.fillStyle = '#000000';
    roundRect(ctx, bgX, bgY, bgWidth, bgHeight, 15);
    ctx.fill();
    
    // Свечение текста
    ctx.shadowColor = incomeColor;
    ctx.shadowBlur = 15;
    
    // Обводка
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y - padding * 0.3);
    
    // Заливка
    ctx.fillStyle = incomeColor;
    ctx.fillText(text, x, y - padding * 0.3);
    
    // Подчёркивание
    const underlineY = y - padding * 0.1;
    ctx.fillRect(bgX + padding, underlineY, bgWidth - padding * 2, 5);
    
    ctx.restore();
}

/**
 * Главная функция генерации изображения
 */
async function generateBrainrotImage(options) {
    const {
        name = 'Unknown Brainrot',
        income = '0/s',
        imageUrl = null,
        borderColor = COLORS.border,
        mutation = null,
        showTitle = true,
        titleText = 'MY SHOP',
        // Новые параметры настроек
        titleColor = COLORS.title,
        titleGlow = '#ff6600',
        incomeColor = COLORS.income,
        fontFamily = 'Press Start 2P'
    } = options;
    
    console.log('[LocalGen] Starting generation:', { 
        name, 
        income, 
        mutation: mutation ? cleanMutationText(mutation) : null,
        imageUrl: imageUrl?.substring(0, 50),
        borderColor,
        titleColor,
        incomeColor,
        fontFamily
    });
    
    // Загружаем шрифт
    await ensureFontLoaded();
    
    // Создаём холст
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Градиентный фон (тёмно-фиолетовый)
    const bgGradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    bgGradient.addColorStop(0, '#2d1b4e');
    bgGradient.addColorStop(0.5, '#1a0a2e');
    bgGradient.addColorStop(1, '#0d0519');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Параметры рамки
    const borderMargin = 50;
    const headerHeight = 100; // Высота для заголовка
    const footerHeight = 220; // Высота для income
    const borderRadius = 60; // Увеличенные закруглённые углы
    
    const frameX = borderMargin;
    const frameY = headerHeight + 20;
    const frameWidth = CANVAS_WIDTH - borderMargin * 2;
    const frameHeight = CANVAS_HEIGHT - frameY - footerHeight;
    
    // Область для изображения брейнрота
    const imageMargin = 20;
    const imageX = frameX + imageMargin;
    const imageY = frameY + imageMargin;
    const imageWidth = frameWidth - imageMargin * 2;
    const imageHeight = frameHeight - imageMargin * 2;
    const imageRadius = borderRadius - imageMargin;
    
    // Загружаем и рисуем изображение брейнрота
    let imageDrawn = false;
    if (imageUrl) {
        const imageBuffer = await downloadImage(imageUrl);
        if (imageBuffer) {
            imageDrawn = await drawBrainrotWithOutline(
                ctx, imageBuffer, 
                imageX, imageY, imageWidth, imageHeight,
                mutation, imageRadius
            );
        }
    }
    
    // Placeholder если нет изображения
    if (!imageDrawn) {
        ctx.save();
        ctx.fillStyle = '#2a1a4a';
        roundRect(ctx, imageX, imageY, imageWidth, imageHeight, imageRadius);
        ctx.fill();
        
        ctx.font = '60px "Press Start 2P", monospace';
        ctx.fillStyle = '#555';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('NO IMAGE', imageX + imageWidth / 2, imageY + imageHeight / 2);
        ctx.restore();
    }
    
    // Рисуем неоновую рамку с закруглёнными углами
    drawNeonRoundedBorder(ctx, frameX, frameY, frameWidth, frameHeight, borderRadius, borderColor, 30);
    
    // Заголовок с настраиваемыми цветами
    if (showTitle) {
        drawStyledText(ctx, titleText, CANVAS_WIDTH / 2, 60, {
            fontSize: 70,
            fillColor: titleColor,
            strokeColor: '#000000',
            strokeWidth: 5,
            glowColor: titleGlow,
            underline: true,
            fontFamily: fontFamily
        });
    }
    
    // Название brainrot (слева вверху внутри рамки, с переносом слов)
    const nameY = frameY + 70;
    const nameX = frameX + 50;
    const maxNameWidth = mutation ? frameWidth * 0.45 : frameWidth * 0.75;
    
    drawMultilineText(ctx, name, nameX, nameY, {
        fontSize: 56,
        fillColor: COLORS.nameColor,
        strokeColor: '#000000',
        strokeWidth: 5,
        align: 'left',
        underline: true,
        glowColor: '#ffffff',
        maxWidth: maxNameWidth,
        lineHeight: 1.3,
        fontFamily: fontFamily
    });
    
    // Мутация (справа вверху внутри рамки, увеличена и смещена)
    if (mutation) {
        const mutationX = frameX + frameWidth - 50;
        drawMutationBadge(ctx, mutation, mutationX, nameY, {
            fontSize: 48,
            align: 'right',
            fontFamily: fontFamily
        });
    }
    
    // Income текст внизу с настраиваемым цветом
    const incomeY = CANVAS_HEIGHT - 50;
    drawIncomeText(ctx, income, CANVAS_WIDTH / 2, incomeY, {
        incomeColor: incomeColor,
        fontFamily: fontFamily
    });
    
    // Конвертируем в buffer
    const buffer = await canvas.encode('png');
    console.log('[LocalGen] Image generated, size:', buffer.length);
    
    return buffer;
}

/**
 * Сохранение изображения в файл
 */
async function saveGeneratedImage(buffer, filename) {
    const outputDir = path.join(__dirname, '..', 'generated');
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, buffer);
    
    console.log('[LocalGen] Image saved to:', outputPath);
    return outputPath;
}

/**
 * Генерация уникального имени файла
 */
function generateFilename(name) {
    const safeName = (name || 'brainrot').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const timestamp = Date.now();
    return `${safeName}_${timestamp}.png`;
}

// Express handler
module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { 
            name, 
            income, 
            price, 
            imageUrl, 
            borderColor, 
            mutation,
            accountId, 
            accountName,
            titleText,
            returnBuffer = false 
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        console.log('[LocalGen] === Generate Request ===');
        console.log('[LocalGen] Name:', name);
        console.log('[LocalGen] Income:', income);
        console.log('[LocalGen] Mutation:', mutation ? cleanMutationText(mutation) : 'none');
        console.log('[LocalGen] Image URL:', imageUrl);
        console.log('[LocalGen] Border Color:', borderColor);
        console.log('[LocalGen] Title:', titleText);

        // Генерируем изображение
        const imageBuffer = await generateBrainrotImage({
            name,
            income: income || '0/s',
            imageUrl,
            borderColor: borderColor || '#ff0000',
            mutation,
            titleText: titleText || 'ABOBA STORE'
        });

        // Сохраняем файл
        const filename = generateFilename(name);
        const savedPath = await saveGeneratedImage(imageBuffer, filename);
        
        // Build full URL с доменом панели для Tampermonkey
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
        const host = req.get('host') || 'localhost:3000';
        const baseUrl = `${protocol}://${host}`;
        const resultUrl = `${baseUrl}/generated/${filename}`;

        console.log('[LocalGen] Generation complete, URL:', resultUrl);

        res.json({
            success: true,
            resultUrl,
            localPath: savedPath,
            brainrotName: name,
            accountId,
            accountName,
            generator: 'local'
        });

    } catch (error) {
        console.error('[LocalGen] Generate error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Экспортируем функции для использования в других модулях
module.exports.generateBrainrotImage = generateBrainrotImage;
module.exports.saveGeneratedImage = saveGeneratedImage;
module.exports.generateFilename = generateFilename;
module.exports.getMutationStyle = getMutationStyle;
module.exports.cleanMutationText = cleanMutationText;
