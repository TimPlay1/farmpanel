/**
 * Brainrot Images Auto-Sync
 * Автоматически парсит изображения с stealabrainrot wiki 
 * и синхронизирует с farmpanel
 * 
 * Запуск: node scripts/sync-images.js
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync, copyFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import crypto from 'crypto';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WIKI_URL = 'https://stealabrainrot.fandom.com';
const TEMP_DIR = join(__dirname, '../temp_images');
const PUBLIC_BRAINROTS_DIR = join(__dirname, '../public/brainrots');
const MAPPING_FILE = join(__dirname, '../public/brainrots-mapping.json');
const BATCH_SIZE = 10;
const DOWNLOAD_BATCH = 15;

// Keep-alive агенты
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 20 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 20 });

function getFetchOptions(url) {
    const parsed = new URL(url);
    return {
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        agent: parsed.protocol === 'https:' ? httpsAgent : httpAgent
    };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3, expectJson = true) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, getFetchOptions(url));
            const text = await response.text();
            
            if (expectJson) {
                if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
                    console.log(`  ⚠️ HTML вместо JSON, попытка ${i + 2}...`);
                    if (i < retries - 1) { await sleep(3000 * (i + 1)); continue; }
                    throw new Error('Server returned HTML (возможно CAPTCHA)');
                }
                return JSON.parse(text);
            }
            return text;
        } catch (err) {
            if (i === retries - 1) throw err;
            await sleep(2000 * (i + 1));
        }
    }
}

function getFullResolutionUrl(href) {
    if (!href) return null;
    let url = href.replace(/\/scale-to-width-down\/\d+/, '');
    return url;
}

function getExtension(url) {
    const match = url.match(/\/([^\/]+\.(png|jpg|jpeg|gif|webp))/i);
    if (match) return match[2].toLowerCase();
    return 'png';
}

function sanitizeFilename(name) {
    return name
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .trim();
}

function getFileHash(filepath) {
    try {
        const content = readFileSync(filepath);
        return crypto.createHash('md5').update(content).digest('hex');
    } catch {
        return null;
    }
}

function getBufferHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

async function downloadImageBuffer(url) {
    try {
        const response = await fetch(url, getFetchOptions(url));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
    } catch (err) {
        return null;
    }
}

async function getAllPages() {
    const pages = [];
    let apcontinue = '';
    
    console.log('📋 Получаю список всех страниц...');
    
    while (true) {
        const params = new URLSearchParams({
            action: 'query',
            list: 'allpages',
            aplimit: '500',
            format: 'json',
            origin: '*'
        });
        
        if (apcontinue) params.set('apcontinue', apcontinue);
        
        try {
            const data = await fetchWithRetry(`${WIKI_URL}/api.php?${params}`);
            if (data.query?.allpages) {
                for (const page of data.query.allpages) {
                    pages.push(page.title);
                }
                console.log(`  Страниц: ${pages.length}`);
            }
            if (data.continue?.apcontinue) {
                apcontinue = data.continue.apcontinue;
            } else {
                break;
            }
        } catch (err) {
            console.log(`  ❌ Ошибка: ${err.message}`);
            break;
        }
    }
    
    return pages;
}

async function getPageHtml(title) {
    const params = new URLSearchParams({
        action: 'parse',
        page: title,
        prop: 'text',
        format: 'json',
        origin: '*'
    });
    
    try {
        const data = await fetchWithRetry(`${WIKI_URL}/api.php?${params}`);
        return data.parse?.text?.['*'] || '';
    } catch {
        return '';
    }
}

function extractMainImage(html, pageTitle) {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    // Ищем figure.pi-item.pi-image с data-source="image1"
    const figure = doc.querySelector('figure.pi-item.pi-image[data-source="image1"]');
    if (!figure) return null;
    
    const link = figure.querySelector('a.image');
    if (!link) return null;
    
    const href = link.getAttribute('href');
    if (!href || !href.includes('static.wikia.nocookie.net')) return null;
    
    const fullUrl = getFullResolutionUrl(href);
    if (!fullUrl) return null;
    
    // Получаем название из инфобокса
    const infobox = doc.querySelector('.portable-infobox');
    const titleEl = infobox?.querySelector('.pi-title');
    const name = titleEl ? titleEl.textContent.trim() : pageTitle;
    
    return { url: fullUrl, name };
}

// Создаём маппинг с разными вариантами написания имён
function createMapping(images) {
    const mapping = {};
    
    for (const [filename, data] of images) {
        const name = data.name;
        const nameLower = name.toLowerCase();
        const nameUnderscore = name.replace(/\s+/g, '_').toLowerCase();
        const nameNoSpace = name.replace(/\s+/g, '').toLowerCase();
        
        // Добавляем все варианты
        mapping[nameLower] = filename;
        mapping[nameUnderscore] = filename;
        mapping[nameNoSpace] = filename;
        
        // Также добавляем оригинальное имя
        mapping[name] = filename;
    }
    
    return mapping;
}

async function main() {
    console.log('═'.repeat(60));
    console.log('🖼️  Brainrot Images Auto-Sync');
    console.log('   Синхронизация изображений с stealabrainrot wiki');
    console.log('═'.repeat(60));
    
    // Создаём директории
    if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });
    if (!existsSync(PUBLIC_BRAINROTS_DIR)) mkdirSync(PUBLIC_BRAINROTS_DIR, { recursive: true });
    
    // Индекс существующих файлов
    const existingFiles = new Map();
    for (const file of readdirSync(PUBLIC_BRAINROTS_DIR)) {
        const filepath = join(PUBLIC_BRAINROTS_DIR, file);
        const hash = getFileHash(filepath);
        if (hash) existingFiles.set(file, hash);
    }
    console.log(`📂 Существующих файлов: ${existingFiles.size}`);
    
    // Получаем все страницы
    const pages = await getAllPages();
    console.log(`\n✅ Всего страниц: ${pages.length}`);
    
    // Парсим страницы
    const images = new Map();
    console.log(`\n🔍 Ищу главные изображения...\n`);
    
    for (let i = 0; i < pages.length; i += BATCH_SIZE) {
        const batch = pages.slice(i, i + BATCH_SIZE);
        
        const results = await Promise.all(batch.map(async (title) => {
            const html = await getPageHtml(title);
            if (!html) return null;
            const img = extractMainImage(html, title);
            return img ? { ...img, pageTitle: title } : null;
        }));
        
        for (const result of results) {
            if (!result) continue;
            
            const ext = getExtension(result.url);
            
            // Пропускаем GIF (анимации большие и не нужны)
            if (ext === 'gif') continue;
            
            const filename = `${sanitizeFilename(result.name)}.${ext}`;
            
            let finalFilename = filename;
            let counter = 1;
            while (images.has(finalFilename) && images.get(finalFilename).url !== result.url) {
                finalFilename = `${sanitizeFilename(result.name)}_${counter}.${ext}`;
                counter++;
            }
            
            images.set(finalFilename, { url: result.url, name: result.name });
        }
        
        const progress = Math.min(i + BATCH_SIZE, pages.length);
        process.stdout.write(`\r  Обработано: ${progress}/${pages.length} | Найдено: ${images.size}`);
    }
    
    console.log('\n');
    console.log(`📊 Найдено изображений: ${images.size}`);
    
    // Определяем что качать
    const toDownload = [];
    
    for (const [filename, data] of images) {
        if (!existingFiles.has(filename)) {
            toDownload.push({ filename, url: data.url, name: data.name, action: 'new' });
        } else {
            toDownload.push({ filename, url: data.url, name: data.name, action: 'check' });
        }
    }
    
    const newCount = toDownload.filter(x => x.action === 'new').length;
    const checkCount = toDownload.filter(x => x.action === 'check').length;
    
    console.log(`   🆕 Новых: ${newCount}`);
    console.log(`   🔄 Проверить на обновление: ${checkCount}`);
    
    // Скачиваем/обновляем
    console.log(`\n⬇️  Загрузка...\n`);
    
    let downloaded = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    
    for (let i = 0; i < toDownload.length; i += DOWNLOAD_BATCH) {
        const batch = toDownload.slice(i, i + DOWNLOAD_BATCH);
        
        await Promise.all(batch.map(async (item) => {
            const filepath = join(PUBLIC_BRAINROTS_DIR, item.filename);
            
            const buffer = await downloadImageBuffer(item.url);
            if (!buffer) {
                failed++;
                return;
            }
            
            const newHash = getBufferHash(buffer);
            
            if (item.action === 'new') {
                writeFileSync(filepath, buffer);
                downloaded++;
                console.log(`  ✅ ${item.filename}`);
            } else {
                const oldHash = existingFiles.get(item.filename);
                if (oldHash !== newHash) {
                    writeFileSync(filepath, buffer);
                    updated++;
                    console.log(`  🔄 ${item.filename} (обновлено)`);
                } else {
                    skipped++;
                }
            }
        }));
        
        const progress = Math.min(i + DOWNLOAD_BATCH, toDownload.length);
        if (skipped > 0 || progress % 50 === 0) {
            process.stdout.write(`\r  Прогресс: ${progress}/${toDownload.length} | ⏭️ Без изменений: ${skipped}`);
        }
    }
    
    console.log('\n');
    
    // Создаём маппинг
    const mapping = createMapping(images);
    writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
    
    // Создаём также список для API
    const brainrotsList = [];
    for (const [filename, data] of images) {
        brainrotsList.push({
            name: data.name,
            image: filename,
            hasImage: existsSync(join(PUBLIC_BRAINROTS_DIR, filename))
        });
    }
    writeFileSync(join(__dirname, '../public/brainrots.json'), JSON.stringify(brainrotsList, null, 2));
    
    // Итоги
    console.log('═'.repeat(60));
    console.log('📊 ИТОГИ:');
    console.log(`   🆕 Загружено новых: ${downloaded}`);
    console.log(`   🔄 Обновлено: ${updated}`);
    console.log(`   ⏭️  Без изменений: ${skipped}`);
    console.log(`   ❌ Ошибок: ${failed}`);
    console.log(`   📄 Всего в маппинге: ${Object.keys(mapping).length} ключей`);
    console.log(`   📂 Изображений: ${images.size}`);
    console.log('═'.repeat(60));
}

main().catch(console.error);
