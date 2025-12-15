// ==UserScript==
// @name         Glitched Store - Eldorado Auto Offer
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Auto-fill Eldorado.gg offer form with brainrot data from Farmer Panel
// @author       Glitched Store
// @match        https://www.eldorado.gg/sell/offer/*
// @match        https://eldorado.gg/sell/offer/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      farmerpanel.vercel.app
// @connect      api.supa.ru
// @connect      storage.supa.ru
// @connect      localhost
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Стили для уведомлений и панели
    GM_addStyle(`
        .glitched-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
            animation: glitched-slide-in 0.3s ease;
            max-width: 300px;
        }
        .glitched-notification.success {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }
        .glitched-notification.error {
            background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        }
        @keyframes glitched-slide-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        .glitched-panel {
            position: fixed;
            top: 100px;
            right: 20px;
            width: 300px;
            background: #1a1a2e;
            border-radius: 16px;
            padding: 20px;
            z-index: 999998;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', sans-serif;
            color: white;
        }
        .glitched-panel h3 {
            margin: 0 0 16px 0;
            font-size: 18px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .glitched-panel .status {
            font-size: 12px;
            color: #888;
            margin-bottom: 12px;
            padding: 8px;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
        }
        .glitched-panel .status.ready {
            color: #38ef7d;
            background: rgba(56, 239, 125, 0.1);
        }
        .glitched-panel .status.working {
            color: #ffc950;
            background: rgba(255, 201, 80, 0.1);
        }
        .glitched-panel button {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-bottom: 8px;
            transition: all 0.2s;
        }
        .glitched-panel button.primary {
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            color: white;
        }
        .glitched-panel button.primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(255, 107, 53, 0.4);
        }
        .glitched-panel button.secondary {
            background: #2a2a4a;
            color: white;
        }
        .glitched-panel button.secondary:hover {
            background: #3a3a5a;
        }
        .glitched-panel button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .glitched-panel .brainrot-info {
            background: #2a2a4a;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
        }
        .glitched-panel .brainrot-info img {
            width: 60px;
            height: 60px;
            border-radius: 8px;
            object-fit: cover;
        }
        .glitched-panel .brainrot-info .details {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        .glitched-panel .brainrot-info .name {
            font-weight: 600;
            font-size: 14px;
        }
        .glitched-panel .brainrot-info .income {
            font-size: 12px;
            color: #38ef7d;
        }
        .glitched-panel .brainrot-info .price {
            font-size: 12px;
            color: #ffc950;
        }
        .glitched-panel .log {
            font-size: 11px;
            color: #666;
            max-height: 100px;
            overflow-y: auto;
            margin-top: 8px;
            padding: 8px;
            background: rgba(0,0,0,0.2);
            border-radius: 6px;
        }
        .glitched-panel .log-entry {
            margin-bottom: 4px;
        }
        .glitched-panel .log-entry.success {
            color: #38ef7d;
        }
        .glitched-panel .log-entry.error {
            color: #f45c43;
        }
    `);

    let offerData = null;
    let logEl = null;
    let statusEl = null;

    // Логирование
    function log(message, type = 'info') {
        console.log(`[Glitched Store] ${message}`);
        if (logEl) {
            const entry = document.createElement('div');
            entry.className = `log-entry ${type}`;
            entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
            logEl.appendChild(entry);
            logEl.scrollTop = logEl.scrollHeight;
        }
    }

    function updateStatus(message, className = '') {
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `status ${className}`;
        }
    }

    // Получаем данные из URL параметров
    function getOfferDataFromURL() {
        const params = new URLSearchParams(window.location.search);
        const dataParam = params.get('glitched_data');
        if (dataParam) {
            try {
                return JSON.parse(decodeURIComponent(dataParam));
            } catch (e) {
                console.error('Failed to parse offer data:', e);
            }
        }
        return null;
    }

    // Показать уведомление
    function showNotification(message, type = 'info') {
        const existing = document.querySelector('.glitched-notification');
        if (existing) existing.remove();

        const notif = document.createElement('div');
        notif.className = `glitched-notification ${type}`;
        notif.textContent = message;
        document.body.appendChild(notif);

        setTimeout(() => notif.remove(), 4000);
    }

    // Генерация уникального ID оффера
    function generateOfferId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 6);
        return `GS-${timestamp}-${random}`.toUpperCase();
    }

    // Генерация названия оффера (макс 160 символов)
    function generateOfferTitle(brainrotName, income) {
        let incomeFormatted = income || '0/s';
        incomeFormatted = incomeFormatted.replace('$', '');
        const title = `🔥${brainrotName} l ${incomeFormatted}🔥 Fast Delivery🚚 👾Glitched Store👾`;
        return title.substring(0, 160);
    }

    // Генерация описания оффера (макс 2000 символов)
    function generateOfferDescription(offerId) {
        return `📦 How We Delivery
1️⃣ After purchase, send your Roblox username in live chat.
2️⃣ I will send you a private sever's link to join or direct add if cant join by link.
3️⃣ Once join sever I will give you Brainrot you purchased.

NOTE: please read before buy
💥 Give me EXACTLY your @Username (not display name). If you gave me wrong spelling, we NOT take any responsibility if you gave me a wrong @Username.
💥 Every Private sever we sent to you is 100% New Generated which mean ONLY you and me know that link. If I saw any other person than you (@username given) and me join the room → WE WILL CANCEL THE ORDER IMMEDIATELY.
💥 If you cant join link. We will add you by your @username given by you. WE NOT ACCEPT ADDING FROM YOUR SIDE so please dont buy if you can't give us your @username to add.

❤️ Why Choosing Us - 👾Glitched Store👾
1️⃣ Fast Delivery and Respond
2️⃣ All brainrot/item are clean. (No dupe/exploit)
3️⃣ Safe for information

Thanks for choosing and working with 👾Glitched Store👾! Cheers 🎁🎁

#${offerId}`;
    }

    // Ждем когда страница полностью загрузится (Angular)
    function waitForAngularLoad(timeout = 45000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const check = () => {
                // Проверяем что скелетоны исчезли и появились реальные элементы формы
                const skeletons = document.querySelectorAll('eld-skeleton');
                const visibleSkeletons = [...skeletons].filter(s => s.offsetParent !== null);
                
                // Ищем реальные элементы формы Eldorado
                const titleInput = document.querySelector('input[formcontrolname="title"], input[placeholder*="Type here"], input[data-testid*="title"]');
                const descTextarea = document.querySelector('textarea[formcontrolname="description"], textarea[placeholder*="Type here"], textarea[data-testid*="description"]');
                const fileInput = document.querySelector('input[type="file"]');
                
                // Также проверяем наличие основного контейнера формы
                const formContainer = document.querySelector('eld-place-offer, [data-testid*="create-offer"]');
                
                log(`Check: skeletons=${visibleSkeletons.length}, title=${!!titleInput}, desc=${!!descTextarea}, file=${!!fileInput}`);
                
                if ((titleInput || descTextarea) && visibleSkeletons.length < 3) {
                    log('Page loaded - form elements found');
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    log('Timeout waiting for page load', 'error');
                    resolve(false);
                } else {
                    setTimeout(check, 1000);
                }
            };
            setTimeout(check, 3000); // Начальная задержка для Angular
        });
    }

    // Установить значение в input для Angular
    function setInputValue(input, value) {
        if (!input) {
            log('Input not found', 'error');
            return false;
        }

        // Фокусируемся на элементе
        input.focus();
        input.click();
        
        // Очищаем текущее значение
        input.value = '';
        
        // Для Angular нужно использовать нативный setter и симулировать пользовательский ввод
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
            'value'
        ).set;
        
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, value);
        } else {
            input.value = value;
        }
        
        // Триггерим события для Angular - важен порядок
        input.dispatchEvent(new Event('focus', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        
        // Дополнительно для reactive forms Angular
        if (typeof input.ngControl !== 'undefined') {
            input.ngControl.control.setValue(value);
        }
        
        log(`Set value: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
        return true;
    }

    // Загрузка изображения через GM_xmlhttpRequest
    async function downloadImageAsBlob(imageUrl) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: imageUrl,
                responseType: 'blob',
                onload: function(response) {
                    if (response.status === 200) {
                        resolve(response.response);
                    } else {
                        reject(new Error(`Failed to download: ${response.status}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Загрузить изображение
    async function uploadImage(imageUrl) {
        try {
            log('Downloading image...');
            updateStatus('⬇️ Скачиваем изображение...', 'working');
            
            const blob = await downloadImageAsBlob(imageUrl);
            log('Image downloaded, size: ' + blob.size);
            
            // Находим input для файла
            const fileInput = document.querySelector('input[type="file"]');
            if (!fileInput) {
                log('File input not found', 'error');
                return false;
            }

            // Создаем File объект
            const file = new File([blob], 'brainrot.png', { type: 'image/png' });
            
            // Создаем DataTransfer
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            
            // Триггерим change event
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            log('Image uploaded', 'success');
            return true;
        } catch (error) {
            log('Image upload failed: ' + error.message, 'error');
            return false;
        }
    }

    // Заполнить форму
    async function fillOfferForm() {
        if (!offerData) {
            showNotification('Нет данных для заполнения', 'error');
            return;
        }

        const { name, income, generatedImageUrl } = offerData;
        const offerId = generateOfferId();
        offerData.offerId = offerId;

        updateStatus('🔄 Заполняем форму...', 'working');
        log('Starting auto-fill...');

        try {
            // Ждем загрузки страницы
            const loaded = await waitForAngularLoad();
            if (!loaded) {
                log('Page did not load properly, trying anyway...', 'error');
            }
            
            // Дополнительная задержка для Angular
            await new Promise(r => setTimeout(r, 2000));
            
            // === ЗАПОЛНЯЕМ НАЗВАНИЕ ===
            log('Looking for title input...');
            
            // Пробуем разные селекторы для title
            let titleInput = document.querySelector('input[formcontrolname="title"]');
            if (!titleInput) titleInput = document.querySelector('input[data-testid*="title"]');
            if (!titleInput) titleInput = document.querySelector('input[name="title"]');
            
            // Fallback: ищем по placeholder или по структуре
            if (!titleInput) {
                const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');
                for (const input of allInputs) {
                    const placeholder = (input.placeholder || '').toLowerCase();
                    const parentText = (input.closest('div, section')?.textContent || '').toLowerCase();
                    
                    // Пропускаем скрытые и уже заполненные
                    if (input.offsetParent === null) continue;
                    if (input.type === 'file' || input.type === 'hidden') continue;
                    
                    if (placeholder.includes('type here') || 
                        placeholder.includes('title') ||
                        (parentText.includes('offer title') && placeholder)) {
                        titleInput = input;
                        log('Found title by placeholder/context');
                        break;
                    }
                }
            }
            
            // Ещё один fallback - первый видимый text input
            if (!titleInput) {
                const visibleInputs = [...document.querySelectorAll('input')].filter(
                    i => i.offsetParent !== null && 
                         i.type !== 'file' && 
                         i.type !== 'hidden' &&
                         i.type !== 'checkbox' &&
                         i.type !== 'radio'
                );
                if (visibleInputs.length > 0) {
                    titleInput = visibleInputs[0];
                    log('Using first visible input as title');
                }
            }
            
            if (titleInput) {
                const title = generateOfferTitle(name, income);
                setInputValue(titleInput, title);
                log('Title filled ✓', 'success');
            } else {
                log('Title input NOT found', 'error');
            }

            // Задержка между заполнениями
            await new Promise(r => setTimeout(r, 1000));

            // === ЗАПОЛНЯЕМ ОПИСАНИЕ ===
            log('Looking for description textarea...');
            
            let descInput = document.querySelector('textarea[formcontrolname="description"]');
            if (!descInput) descInput = document.querySelector('textarea[data-testid*="description"]');
            if (!descInput) descInput = document.querySelector('textarea[name="description"]');
            
            // Fallback по placeholder
            if (!descInput) {
                const allTextareas = document.querySelectorAll('textarea');
                for (const textarea of allTextareas) {
                    if (textarea.offsetParent === null) continue;
                    
                    const placeholder = (textarea.placeholder || '').toLowerCase();
                    if (placeholder.includes('type here') || placeholder.includes('description')) {
                        descInput = textarea;
                        log('Found description by placeholder');
                        break;
                    }
                }
            }
            
            // Ещё fallback - первая видимая textarea
            if (!descInput) {
                const visibleTextareas = [...document.querySelectorAll('textarea')].filter(
                    t => t.offsetParent !== null
                );
                if (visibleTextareas.length > 0) {
                    descInput = visibleTextareas[0];
                    log('Using first visible textarea as description');
                }
            }
            
            if (descInput) {
                const description = generateOfferDescription(offerId);
                setInputValue(descInput, description);
                log('Description filled ✓', 'success');
            } else {
                log('Description textarea NOT found', 'error');
            }

            await new Promise(r => setTimeout(r, 1000));

            // === ЗАГРУЖАЕМ ИЗОБРАЖЕНИЕ ===
            if (generatedImageUrl) {
                log('Uploading image...');
                const imageUploaded = await uploadImage(generatedImageUrl);
                if (imageUploaded) {
                    log('Image uploaded ✓', 'success');
                }
            } else {
                log('No image URL provided', 'error');
            }

            updateStatus('✅ Форма заполнена!', 'ready');
            showNotification('Форма заполнена! Проверьте данные и нажмите Place offer.', 'success');

        } catch (error) {
            log('Error: ' + error.message, 'error');
            updateStatus('❌ Ошибка заполнения', 'error');
            showNotification('Ошибка заполнения: ' + error.message, 'error');
        }
    }

    // Заполнить только название
    async function fillTitleOnly() {
        if (!offerData) return;
        
        log('Filling title only...');
        
        // Ждем загрузки
        await waitForAngularLoad();
        await new Promise(r => setTimeout(r, 1000));
        
        // Ищем input для title
        let titleInput = document.querySelector('input[formcontrolname="title"]');
        if (!titleInput) {
            const visibleInputs = [...document.querySelectorAll('input')].filter(
                i => i.offsetParent !== null && 
                     i.type !== 'file' && 
                     i.type !== 'hidden' &&
                     i.type !== 'checkbox'
            );
            if (visibleInputs.length > 0) titleInput = visibleInputs[0];
        }
        
        if (titleInput) {
            const title = generateOfferTitle(offerData.name, offerData.income);
            setInputValue(titleInput, title);
            showNotification('Название заполнено!', 'success');
        } else {
            showNotification('Поле названия не найдено', 'error');
        }
    }

    // Заполнить только описание
    async function fillDescriptionOnly() {
        if (!offerData) return;
        
        log('Filling description only...');
        
        // Ждем загрузки
        await waitForAngularLoad();
        await new Promise(r => setTimeout(r, 1000));
        
        // Ищем textarea для description
        let descInput = document.querySelector('textarea[formcontrolname="description"]');
        if (!descInput) {
            const visibleTextareas = [...document.querySelectorAll('textarea')].filter(
                t => t.offsetParent !== null
            );
            if (visibleTextareas.length > 0) descInput = visibleTextareas[0];
        }
        
        if (descInput) {
            const offerId = offerData.offerId || generateOfferId();
            const description = generateOfferDescription(offerId);
            setInputValue(descInput, description);
            showNotification('Описание заполнено!', 'success');
        } else {
            showNotification('Поле описания не найдено', 'error');
        }
    }

    // Создаем панель управления
    function createControlPanel() {
        const existingPanel = document.querySelector('.glitched-panel');
        if (existingPanel) existingPanel.remove();

        const panel = document.createElement('div');
        panel.className = 'glitched-panel';

        const hasData = offerData !== null;

        panel.innerHTML = `
            <h3>👾 Glitched Store</h3>
            <div class="status ${hasData ? 'ready' : ''}" id="glitched-status">
                ${hasData ? '✅ Данные получены' : '⏳ Ожидание данных...'}
            </div>
            ${hasData ? `
                <div class="brainrot-info">
                    <div class="details">
                        ${offerData.generatedImageUrl ? `<img src="${offerData.generatedImageUrl}" alt="${offerData.name}">` : ''}
                        <div>
                            <div class="name">${offerData.name || 'Unknown'}</div>
                            <div class="income">${offerData.income || '0/s'}</div>
                        </div>
                    </div>
                </div>
                <button class="primary" id="glitched-autofill">
                    🚀 Auto-Fill Form
                </button>
                <button class="secondary" id="glitched-fill-title">
                    📝 Fill Title Only
                </button>
                <button class="secondary" id="glitched-fill-desc">
                    📄 Fill Description Only
                </button>
                <button class="secondary" id="glitched-upload-img">
                    🖼️ Upload Image Only
                </button>
            ` : `
                <p style="font-size: 12px; color: #888;">
                    Откройте панель Farmer Panel и нажмите "Post to Eldorado" после генерации изображения.
                </p>
            `}
            <button class="secondary" id="glitched-close" style="margin-top: 8px;">
                ✕ Close Panel
            </button>
            <div class="log" id="glitched-log"></div>
            <div style="font-size: 10px; color: #666; margin-top: 8px; text-align: center;">
                Offer ID: ${offerData?.offerId || generateOfferId()}
            </div>
        `;

        document.body.appendChild(panel);
        
        // Сохраняем ссылки на элементы
        logEl = document.getElementById('glitched-log');
        statusEl = document.getElementById('glitched-status');

        // Обработчики кнопок
        document.getElementById('glitched-close').addEventListener('click', () => panel.remove());

        if (hasData) {
            document.getElementById('glitched-autofill').addEventListener('click', fillOfferForm);
            document.getElementById('glitched-fill-title').addEventListener('click', fillTitleOnly);
            document.getElementById('glitched-fill-desc').addEventListener('click', fillDescriptionOnly);
            document.getElementById('glitched-upload-img').addEventListener('click', () => {
                if (offerData.generatedImageUrl) {
                    uploadImage(offerData.generatedImageUrl);
                } else {
                    showNotification('Нет сгенерированного изображения', 'error');
                }
            });
        }

        log('Panel created');
    }

    // Автоматический запуск заполнения
    async function autoFillIfData() {
        if (offerData) {
            log('Auto-fill starting in 5 seconds...');
            updateStatus('⏳ Авто-заполнение через 5 сек...', 'working');
            
            // Показываем уведомление
            showNotification('🔄 Авто-заполнение начнётся через 5 секунд...', 'info');
            
            await new Promise(r => setTimeout(r, 5000));
            await fillOfferForm();
        }
    }

    // Инициализация
    async function init() {
        console.log('🎮 Glitched Store - Eldorado Auto Offer v2.1 loaded');
        console.log('URL:', window.location.href);

        // Получаем данные из URL
        offerData = getOfferDataFromURL();
        
        if (offerData) {
            console.log('✅ Offer data received:', offerData);
            showNotification('✅ Данные брейнрота получены! Начинаем заполнение...', 'success');
            
            // Очищаем URL от параметров (для красоты)
            const url = new URL(window.location.href);
            url.searchParams.delete('glitched_data');
            window.history.replaceState({}, '', url.toString());
        } else {
            console.log('ℹ️ No offer data in URL');
        }

        // Ждем пока DOM полностью готов
        await new Promise(r => setTimeout(r, 3000));
        
        // Создаем панель управления
        createControlPanel();
        
        // Автоматически заполняем если есть данные
        if (offerData) {
            autoFillIfData();
        }
    }

    // Запуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Небольшая задержка для Angular
        setTimeout(init, 1000);
    }
})();
