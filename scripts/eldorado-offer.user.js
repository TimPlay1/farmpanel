// ==UserScript==
// @name         Glitched Store - Eldorado Auto Offer
// @namespace    http://tampermonkey.net/
// @version      3.2
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
// @connect      supa-temp.storage.yandexcloud.net
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
            max-width: 350px;
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
            top: 80px;
            right: 20px;
            width: 320px;
            background: #1a1a2e;
            border-radius: 16px;
            padding: 20px;
            z-index: 999998;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', sans-serif;
            color: white;
            max-height: 85vh;
            overflow-y: auto;
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
            margin-top: 4px;
        }
        .glitched-panel .brainrot-info .rarity {
            font-size: 11px;
            color: #a78bfa;
            margin-top: 2px;
        }
        .glitched-panel .log {
            font-size: 11px;
            color: #666;
            max-height: 150px;
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
        .glitched-panel .log-entry.warn {
            color: #ffc950;
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

        setTimeout(() => notif.remove(), 5000);
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

    // Определить диапазон M/s по income
    function getIncomeRange(income) {
        if (!income) return '0-99 M/s';
        
        // Парсим число из строки типа "618.7M/s" или "$618.7M/s"
        const match = income.match(/[\d.]+/);
        if (!match) return '0-99 M/s';
        
        const value = parseFloat(match[0]);
        
        if (value < 100) return '0-99 M/s';
        if (value < 250) return '100-249 M/s';
        if (value < 500) return '250-499 M/s';
        if (value < 750) return '500-749 M/s';
        if (value < 1000) return '750-999 M/s';
        if (value < 2000) return '1000-1999 M/s';
        if (value < 5000) return '2000-4999 M/s';
        if (value < 10000) return '5000-9999 M/s';
        return '10000+ M/s';
    }

    // Ждем когда страница полностью загрузится (Angular)
    function waitForAngularLoad(timeout = 60000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const check = () => {
                // Проверяем что скелетоны исчезли
                const skeletons = document.querySelectorAll('eld-skeleton');
                const visibleSkeletons = [...skeletons].filter(s => s.offsetParent !== null);
                
                // Ищем ключевые элементы формы
                const ngSelects = document.querySelectorAll('ng-select');
                const titleInput = document.querySelector('input[placeholder*="Type here"]');
                
                log(`Check: skeletons=${visibleSkeletons.length}, ng-selects=${ngSelects.length}, title=${!!titleInput}`);
                
                if (ngSelects.length >= 3 && visibleSkeletons.length < 3) {
                    log('Page loaded - form elements found');
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    log('Timeout waiting for page load', 'error');
                    resolve(false);
                } else {
                    setTimeout(check, 1000);
                }
            };
            setTimeout(check, 3000);
        });
    }

    // Установить значение в input для Angular
    function setInputValue(input, value) {
        if (!input) {
            log('Input not found', 'error');
            return false;
        }

        input.focus();
        input.click();
        input.value = '';
        
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
            'value'
        ).set;
        
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, value);
        } else {
            input.value = value;
        }
        
        input.dispatchEvent(new Event('focus', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        
        log(`Set value: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
        return true;
    }

    // Выбрать значение в ng-select dropdown
    async function selectNgSelectOption(ngSelect, optionText, exactMatch = false) {
        if (!ngSelect) {
            log('ng-select not found', 'error');
            return false;
        }

        try {
            // Закрываем любой открытый dropdown
            const openDropdown = document.querySelector('ng-dropdown-panel');
            if (openDropdown) {
                document.body.click();
                await new Promise(r => setTimeout(r, 300));
            }

            // Находим input внутри ng-select для Angular
            const inputEl = ngSelect.querySelector('input.ng-input input') || 
                           ngSelect.querySelector('.ng-input input') || 
                           ngSelect.querySelector('input[type="text"]') ||
                           ngSelect.querySelector('input');
            
            const container = ngSelect.querySelector('.ng-select-container');
            const valueContainer = ngSelect.querySelector('.ng-value-container');
            
            // Пробуем несколько способов открыть dropdown
            log(`Trying to open dropdown for: ${optionText}`);
            
            // Способ 1: клик по контейнеру и dispatch событий
            if (container) {
                container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                await new Promise(r => setTimeout(r, 100));
                container.click();
            }
            
            await new Promise(r => setTimeout(r, 400));
            
            // Проверяем что dropdown открылся
            let dropdownPanel = document.querySelector('ng-dropdown-panel');
            
            if (!dropdownPanel) {
                // Способ 2: focus + клик на input
                if (inputEl) {
                    inputEl.focus();
                    inputEl.click();
                    await new Promise(r => setTimeout(r, 400));
                    dropdownPanel = document.querySelector('ng-dropdown-panel');
                }
            }
            
            if (!dropdownPanel) {
                // Способ 3: клик на value-container
                if (valueContainer) {
                    valueContainer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    valueContainer.click();
                    await new Promise(r => setTimeout(r, 400));
                    dropdownPanel = document.querySelector('ng-dropdown-panel');
                }
            }
            
            if (!dropdownPanel) {
                // Способ 4: клик на сам ng-select
                ngSelect.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                ngSelect.click();
                await new Promise(r => setTimeout(r, 500));
                dropdownPanel = document.querySelector('ng-dropdown-panel');
            }

            // Проверяем класс ng-select-opened
            if (!dropdownPanel && ngSelect.classList.contains('ng-select-opened')) {
                await new Promise(r => setTimeout(r, 300));
                dropdownPanel = document.querySelector('ng-dropdown-panel');
            }

            if (!dropdownPanel) {
                log(`Dropdown not opened for: ${optionText}`, 'warn');
                return false;
            }

            log(`Dropdown opened, searching for: ${optionText}`);

            // Ищем все опции
            const options = dropdownPanel.querySelectorAll('.ng-option:not(.ng-option-disabled)');
            log(`Found ${options.length} options`);
            
            for (const option of options) {
                const text = option.textContent.trim();
                const matches = exactMatch ? 
                    text === optionText : 
                    text.toLowerCase().includes(optionText.toLowerCase());
                
                if (matches) {
                    // Прокручиваем к опции если нужно
                    option.scrollIntoView({ block: 'nearest' });
                    await new Promise(r => setTimeout(r, 100));
                    
                    // Симулируем hover и клик
                    option.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    option.click();
                    
                    log(`Selected: ${text}`, 'success');
                    await new Promise(r => setTimeout(r, 300));
                    return true;
                }
            }

            // Если не нашли, выводим доступные опции и закрываем
            const availableOptions = [...options].map(o => o.textContent.trim()).slice(0, 5);
            log(`Option "${optionText}" not found. Available: ${availableOptions.join(', ')}...`, 'warn');
            document.body.click();
            return false;

        } catch (error) {
            log(`Error selecting option: ${error.message}`, 'error');
            return false;
        }
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
            
            const fileInput = document.querySelector('input[type="file"]');
            if (!fileInput) {
                log('File input not found', 'error');
                return false;
            }

            const file = new File([blob], 'brainrot.png', { type: 'image/png' });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            log('Image uploaded ✓', 'success');
            return true;
        } catch (error) {
            log('Image upload failed: ' + error.message, 'error');
            return false;
        }
    }

    // Установить чекбокс
    function setCheckbox(checkbox, checked = true) {
        if (!checkbox) return false;
        
        if (checkbox.checked !== checked) {
            checkbox.click();
        }
        return true;
    }

    // Заполнить форму полностью
    async function fillOfferForm() {
        if (!offerData) {
            showNotification('Нет данных для заполнения', 'error');
            return;
        }

        const { name, income, generatedImageUrl, minPrice, maxPrice, rarity, quantity } = offerData;
        const offerId = generateOfferId();
        offerData.offerId = offerId;

        updateStatus('🔄 Заполняем форму...', 'working');
        log('Starting auto-fill v3.0...');

        try {
            // Ждем загрузки страницы
            const loaded = await waitForAngularLoad();
            if (!loaded) {
                log('Page did not load properly, trying anyway...', 'warn');
            }
            
            await new Promise(r => setTimeout(r, 2000));

            // === 1. OFFER DETAILS - выбираем значения в dropdown'ах ===
            log('Filling Offer Details...');
            
            // Функция для получения актуального списка ng-select
            const getNgSelects = () => document.querySelectorAll('ng-select');
            
            let ngSelects = getNgSelects();
            log(`Found ${ngSelects.length} ng-selects initially`);

            // 1. M/s диапазон (первый dropdown)
            const incomeRange = getIncomeRange(income);
            log(`Income range: ${incomeRange}`);
            if (ngSelects.length > 0) {
                await selectNgSelectOption(ngSelects[0], incomeRange);
                await new Promise(r => setTimeout(r, 800));
            }

            // 2. Mutations - выбираем None (второй dropdown)
            ngSelects = getNgSelects();
            if (ngSelects.length > 1) {
                await selectNgSelectOption(ngSelects[1], 'None');
                await new Promise(r => setTimeout(r, 800));
            }

            // 3. Item type - выбираем Brainrot (третий dropdown)
            ngSelects = getNgSelects();
            if (ngSelects.length > 2) {
                await selectNgSelectOption(ngSelects[2], 'Brainrot');
                await new Promise(r => setTimeout(r, 1000)); // Дольше ждём - появляется новый dropdown
            }

            // 4. Rarity - ВАЖНО: выбираем Secret (или другую rarity)
            // После выбора Brainrot появляется dropdown Rarity
            ngSelects = getNgSelects();
            log(`After Item type, found ${ngSelects.length} ng-selects`);
            if (ngSelects.length > 3) {
                // Rarity: Secret, Mythical, Legendary, etc.
                const rarityToSelect = rarity || 'Secret';
                log(`Selecting Rarity: ${rarityToSelect}`);
                await selectNgSelectOption(ngSelects[3], rarityToSelect);
                await new Promise(r => setTimeout(r, 1000)); // Ждём появления dropdown с названиями
            }

            // 5. Brainrot name - появляется после выбора Rarity
            ngSelects = getNgSelects();
            log(`After Rarity, found ${ngSelects.length} ng-selects`);
            if (ngSelects.length > 4) {
                // Пробуем найти наш brainrot, если нет - выбираем "Other"
                log(`Trying to select brainrot: ${name}`);
                const selected = await selectNgSelectOption(ngSelects[4], name);
                if (!selected) {
                    log('Brainrot not found, selecting Other');
                    await selectNgSelectOption(ngSelects[4], 'Other');
                }
                await new Promise(r => setTimeout(r, 600));
            }

            // === 2. OFFER TITLE ===
            log('Filling Offer Title...');
            // Ищем textarea для title с maxlength="160" (НЕ 2000 - это description)
            let titleInput = document.querySelector('textarea[maxlength="160"]');
            
            // Fallback - ищем в секции title-body или description-body с 160 лимитом
            if (!titleInput) {
                const titleSections = document.querySelectorAll('.description-body, [class*="title"]');
                for (const section of titleSections) {
                    const lengthSpan = section.querySelector('.length');
                    if (lengthSpan && lengthSpan.textContent.includes('/160')) {
                        titleInput = section.querySelector('textarea');
                        if (titleInput) break;
                    }
                }
            }
            
            // Fallback 2 - ищем по formcontrolname
            if (!titleInput) {
                titleInput = document.querySelector('textarea[formcontrolname="title"]') ||
                            document.querySelector('input[formcontrolname="title"]');
            }
            
            if (titleInput) {
                const title = generateOfferTitle(name, income);
                setInputValue(titleInput, title);
                log('Title filled ✓', 'success');
            } else {
                log('Title input not found', 'error');
            }

            await new Promise(r => setTimeout(r, 1000));

            // === 3. UPLOAD IMAGE ===
            if (generatedImageUrl) {
                log('Uploading image...');
                await uploadImage(generatedImageUrl);
            }

            await new Promise(r => setTimeout(r, 1000));

            // === 4. DESCRIPTION ===
            log('Filling Description...');
            // ВАЖНО: Description textarea имеет maxlength="2000", НЕ 160!
            let descTextarea = document.querySelector('textarea[maxlength="2000"]');
            
            // Fallback - ищем по data-testid содержащему "description"
            if (!descTextarea) {
                descTextarea = document.querySelector('textarea[data-testid*="description"]');
            }
            
            // Fallback 2 - ищем в секции где span показывает /2000
            if (!descTextarea) {
                const sections = document.querySelectorAll('.section-body, [class*="description"]');
                for (const section of sections) {
                    const lengthSpan = section.querySelector('.length');
                    if (lengthSpan && lengthSpan.textContent.includes('/2000')) {
                        descTextarea = section.querySelector('textarea');
                        if (descTextarea) break;
                    }
                }
            }
            
            // Fallback 3 - formcontrolname
            if (!descTextarea) {
                descTextarea = document.querySelector('textarea[formcontrolname="description"]');
            }
            
            if (descTextarea) {
                const description = generateOfferDescription(offerId);
                setInputValue(descTextarea, description);
                log('Description filled ✓', 'success');
            } else {
                log('Description textarea not found (looking for maxlength=2000)', 'error');
            }

            await new Promise(r => setTimeout(r, 1000));

            // === 5. DELIVERY TIME - выбираем 20 min ===
            log('Setting Delivery Time...');
            // Delivery time обычно находится в секции ниже - ищем по контексту
            const allSections = document.querySelectorAll('section, .section, [class*="delivery"]');
            let deliverySelected = false;
            
            for (const section of allSections) {
                if (section.textContent.toLowerCase().includes('delivery')) {
                    const deliveryNgSelect = section.querySelector('ng-select');
                    if (deliveryNgSelect) {
                        await selectNgSelectOption(deliveryNgSelect, '20 min');
                        deliverySelected = true;
                        break;
                    }
                }
            }
            
            // Fallback - пробуем последние ng-select на странице
            if (!deliverySelected) {
                const updatedNgSelects = document.querySelectorAll('ng-select');
                for (let i = updatedNgSelects.length - 1; i >= 5; i--) {
                    const result = await selectNgSelectOption(updatedNgSelects[i], '20 min');
                    if (result) {
                        deliverySelected = true;
                        break;
                    }
                }
            }

            await new Promise(r => setTimeout(r, 1000));

            // === 6. PRICE ===
            log('Setting Price...');
            // Ищем числовой input для цены
            const priceInputs = document.querySelectorAll('input[type="number"], input[type="text"]');
            let priceSet = false;
            
            for (const input of priceInputs) {
                const parent = input.closest('section, div');
                const parentText = parent ? parent.textContent.toLowerCase() : '';
                const placeholder = (input.placeholder || '').toLowerCase();
                
                if (parentText.includes('price') && !parentText.includes('minimum') || 
                    placeholder.includes('price') ||
                    input.getAttribute('formcontrolname') === 'price') {
                    
                    const price = maxPrice || minPrice || 10;
                    setInputValue(input, price.toString());
                    log(`Price set: $${price}`, 'success');
                    priceSet = true;
                    break;
                }
            }
            
            if (!priceSet) {
                log('Price input not found', 'warn');
            }

            await new Promise(r => setTimeout(r, 1000));

            // === 7. QUANTITY (Total Quantity available) ===
            if (quantity && quantity > 1) {
                log(`Setting Quantity: ${quantity}...`);
                const quantityInputs = document.querySelectorAll('input[type="number"], input[type="text"]');
                let quantitySet = false;
                
                for (const input of quantityInputs) {
                    const parent = input.closest('section, div');
                    const parentText = parent ? parent.textContent.toLowerCase() : '';
                    const placeholder = (input.placeholder || '').toLowerCase();
                    
                    if (parentText.includes('quantity') || 
                        placeholder.includes('quantity') ||
                        input.getAttribute('formcontrolname') === 'quantity' ||
                        input.getAttribute('formcontrolname') === 'totalQuantity') {
                        
                        setInputValue(input, quantity.toString());
                        log(`Quantity set: ${quantity}`, 'success');
                        quantitySet = true;
                        break;
                    }
                }
                
                if (!quantitySet) {
                    log('Quantity input not found', 'warn');
                }
                
                await new Promise(r => setTimeout(r, 500));
            }

            // === 8. CHECKBOXES - Terms of Service и Seller Rules ===
            log('Checking agreements...');
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            let checkedCount = 0;
            
            checkboxes.forEach(checkbox => {
                // Кликаем по всем незаполненным чекбоксам в нижней части формы
                const rect = checkbox.getBoundingClientRect();
                const isInViewport = rect.top > 0;
                
                if (isInViewport && !checkbox.checked) {
                    try {
                        // Пробуем кликнуть по label если есть
                        const label = checkbox.closest('label') || checkbox.parentElement.querySelector('label');
                        if (label) {
                            label.click();
                        } else {
                            checkbox.click();
                        }
                        checkedCount++;
                    } catch (e) {
                        checkbox.click();
                        checkedCount++;
                    }
                }
            });
            
            log(`Checkboxes checked: ${checkedCount}`, checkedCount > 0 ? 'success' : 'warn');

            updateStatus('✅ Форма заполнена!', 'ready');
            showNotification('Форма заполнена! Проверьте данные и нажмите Place offer.', 'success');

        } catch (error) {
            log('Error: ' + error.message, 'error');
            updateStatus('❌ Ошибка заполнения', 'error');
            showNotification('Ошибка заполнения: ' + error.message, 'error');
        }
    }

    // Заполнить только Offer Details (dropdowns)
    async function fillOfferDetailsOnly() {
        if (!offerData) return;
        
        log('Filling Offer Details only...');
        updateStatus('🔄 Заполняем Offer Details...', 'working');
        
        const allNgSelects = document.querySelectorAll('ng-select');
        const incomeRange = getIncomeRange(offerData.income);
        
        if (allNgSelects.length > 0) {
            await selectNgSelectOption(allNgSelects[0], incomeRange);
            await new Promise(r => setTimeout(r, 500));
        }
        if (allNgSelects.length > 1) {
            await selectNgSelectOption(allNgSelects[1], 'None');
            await new Promise(r => setTimeout(r, 500));
        }
        if (allNgSelects.length > 2) {
            await selectNgSelectOption(allNgSelects[2], 'Brainrot');
            await new Promise(r => setTimeout(r, 500));
        }
        if (allNgSelects.length > 3 && offerData.rarity) {
            await selectNgSelectOption(allNgSelects[3], offerData.rarity);
            await new Promise(r => setTimeout(r, 500));
        }
        if (allNgSelects.length > 4) {
            await selectNgSelectOption(allNgSelects[4], offerData.name);
            await new Promise(r => setTimeout(r, 500));
        }
        
        updateStatus('✅ Offer Details заполнены', 'ready');
        showNotification('Offer Details заполнены!', 'success');
    }

    // Заполнить только название
    async function fillTitleOnly() {
        if (!offerData) return;
        
        log('Filling title only...');
        const titleInput = document.querySelector('input[placeholder*="Type here"]');
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
        const descTextarea = document.querySelector('textarea[placeholder*="Type here"]');
        if (descTextarea) {
            const offerId = offerData.offerId || generateOfferId();
            const description = generateOfferDescription(offerId);
            setInputValue(descTextarea, description);
            showNotification('Описание заполнено!', 'success');
        } else {
            showNotification('Поле описания не найдено', 'error');
        }
    }

    // Отметить чекбоксы
    function checkAllAgreements() {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        let count = 0;
        checkboxes.forEach(cb => {
            if (!cb.checked) {
                const label = cb.closest('label') || cb.parentElement.querySelector('label');
                if (label) {
                    label.click();
                } else {
                    cb.click();
                }
                count++;
            }
        });
        showNotification(`Отмечено чекбоксов: ${count}`, 'success');
        log(`Checkboxes checked: ${count}`, 'success');
    }

    // Создаем панель управления
    function createControlPanel() {
        const existingPanel = document.querySelector('.glitched-panel');
        if (existingPanel) existingPanel.remove();

        const panel = document.createElement('div');
        panel.className = 'glitched-panel';

        const hasData = offerData !== null;
        const price = offerData?.maxPrice || offerData?.minPrice || 0;
        const quantity = offerData?.quantity || 1;

        panel.innerHTML = `
            <h3>👾 Glitched Store v3.0</h3>
            <div class="status ${hasData ? 'ready' : ''}" id="glitched-status">
                ${hasData ? '✅ Данные получены' : '⏳ Ожидание данных...'}
            </div>
            ${hasData ? `
                <div class="brainrot-info">
                    <div class="details">
                        ${offerData.generatedImageUrl ? `<img src="${offerData.generatedImageUrl}" alt="${offerData.name}">` : ''}
                        <div>
                            <div class="name">${offerData.name || 'Unknown'}${quantity > 1 ? ` <span style="color:#f59e0b;font-weight:600;">x${quantity}</span>` : ''}</div>
                            <div class="income">💰 ${offerData.income || '0/s'}</div>
                            ${price > 0 ? `<div class="price">💵 $${price.toFixed(2)}${quantity > 1 ? ` (total: $${(price * quantity).toFixed(2)})` : ''}</div>` : ''}
                            ${offerData.rarity ? `<div class="rarity">⭐ ${offerData.rarity}</div>` : ''}
                        </div>
                    </div>
                </div>
                <button class="primary" id="glitched-autofill">
                    🚀 Auto-Fill ALL
                </button>
                <button class="secondary" id="glitched-fill-details">
                    📋 Offer Details (Dropdowns)
                </button>
                <button class="secondary" id="glitched-fill-title">
                    📝 Title
                </button>
                <button class="secondary" id="glitched-fill-desc">
                    📄 Description
                </button>
                <button class="secondary" id="glitched-upload-img">
                    🖼️ Upload Image
                </button>
                <button class="secondary" id="glitched-check-boxes">
                    ☑️ Check Agreements
                </button>
            ` : `
                <p style="font-size: 12px; color: #888;">
                    Откройте Farmer Panel и нажмите "Post to Eldorado" после генерации изображения.
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
        
        logEl = document.getElementById('glitched-log');
        statusEl = document.getElementById('glitched-status');

        document.getElementById('glitched-close').addEventListener('click', () => panel.remove());

        if (hasData) {
            document.getElementById('glitched-autofill').addEventListener('click', fillOfferForm);
            document.getElementById('glitched-fill-details').addEventListener('click', fillOfferDetailsOnly);
            document.getElementById('glitched-fill-title').addEventListener('click', fillTitleOnly);
            document.getElementById('glitched-fill-desc').addEventListener('click', fillDescriptionOnly);
            document.getElementById('glitched-upload-img').addEventListener('click', () => {
                if (offerData.generatedImageUrl) {
                    uploadImage(offerData.generatedImageUrl);
                } else {
                    showNotification('Нет изображения', 'error');
                }
            });
            document.getElementById('glitched-check-boxes').addEventListener('click', checkAllAgreements);
        }

        log('Panel created v3.0');
    }

    // Автоматический запуск заполнения
    async function autoFillIfData() {
        if (offerData) {
            log('Auto-fill starting in 5 seconds...');
            updateStatus('⏳ Авто-заполнение через 5 сек...', 'working');
            showNotification('🔄 Авто-заполнение начнётся через 5 секунд...', 'info');
            
            await new Promise(r => setTimeout(r, 5000));
            await fillOfferForm();
        }
    }

    // Инициализация
    async function init() {
        console.log('🎮 Glitched Store - Eldorado Auto Offer v3.0 loaded');
        console.log('URL:', window.location.href);

        offerData = getOfferDataFromURL();
        
        if (offerData) {
            console.log('✅ Offer data received:', offerData);
            showNotification('✅ Данные брейнрота получены!', 'success');
            
            // Очищаем URL от параметров
            const url = new URL(window.location.href);
            url.searchParams.delete('glitched_data');
            window.history.replaceState({}, '', url.toString());
        } else {
            console.log('ℹ️ No offer data in URL');
        }

        await new Promise(r => setTimeout(r, 3000));
        createControlPanel();
        
        if (offerData) {
            autoFillIfData();
        }
    }

    // Запуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }
})();
