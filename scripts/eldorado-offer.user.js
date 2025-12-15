// ==UserScript==
// @name         Glitched Store - Eldorado Auto Offer
// @namespace    http://tampermonkey.net/
// @version      3.6
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

    // Минимальные стили
    GM_addStyle(`
        .glitched-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 13px;
            z-index: 999999;
            box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4);
            animation: glitched-slide-in 0.2s ease;
            max-width: 300px;
        }
        .glitched-notification.success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
        .glitched-notification.error { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
        @keyframes glitched-slide-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        .glitched-mini {
            position: fixed;
            top: 80px;
            right: 20px;
            width: 260px;
            background: #1a1a2e;
            border-radius: 12px;
            padding: 12px;
            z-index: 999998;
            box-shadow: 0 15px 40px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', sans-serif;
            color: white;
        }
        .glitched-mini .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .glitched-mini .title {
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .glitched-mini .close {
            cursor: pointer;
            opacity: 0.6;
            font-size: 16px;
        }
        .glitched-mini .close:hover { opacity: 1; }
        .glitched-mini .info {
            display: flex;
            gap: 10px;
            align-items: center;
            background: #2a2a4a;
            border-radius: 8px;
            padding: 8px;
            margin-bottom: 8px;
        }
        .glitched-mini .info img {
            width: 45px;
            height: 45px;
            border-radius: 6px;
            object-fit: cover;
        }
        .glitched-mini .info .name {
            font-weight: 600;
            font-size: 12px;
        }
        .glitched-mini .info .details {
            font-size: 11px;
            color: #888;
        }
        .glitched-mini .info .details span { margin-right: 8px; }
        .glitched-mini .info .income { color: #38ef7d; }
        .glitched-mini .info .price { color: #ffc950; }
        .glitched-mini .status {
            font-size: 11px;
            padding: 6px 8px;
            background: rgba(255,255,255,0.05);
            border-radius: 6px;
            color: #888;
            text-align: center;
        }
        .glitched-mini .status.working { color: #ffc950; background: rgba(255, 201, 80, 0.1); }
        .glitched-mini .status.ready { color: #38ef7d; background: rgba(56, 239, 125, 0.1); }
        .glitched-mini .status.error { color: #f45c43; background: rgba(244, 92, 67, 0.1); }
    `);

    let offerData = null;
    let statusEl = null;

    // Логирование
    function log(message, type = 'info') {
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warn' ? '⚠️' : 'ℹ️';
        console.log(`[Glitched ${prefix}] ${message}`);
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

    // Генерация ID оффера
    function generateOfferId() {
        return `GS-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`.toUpperCase();
    }

    // Генерация названия (макс 160) - income передаётся как есть
    function generateOfferTitle(brainrotName, income) {
        return `🔥${brainrotName} l ${income || '0/s'}🔥 Fast Delivery🚚 👾Glitched Store👾`.substring(0, 160);
    }

    // Генерация описания (макс 2000)
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

    // Определить диапазон M/s
    function getIncomeRange(income) {
        if (!income) return '0-24 M/s';
        const match = income.match(/[\d.]+/);
        if (!match) return '0-24 M/s';
        const value = parseFloat(match[0]);
        
        if (value < 25) return '0-24 M/s';
        if (value < 50) return '25-49 M/s';
        if (value < 100) return '50-99 M/s';
        if (value < 250) return '100-249 M/s';
        if (value < 500) return '250-499 M/s';
        if (value < 750) return '500-749 M/s';
        if (value < 1000) return '750-999 M/s';
        return '1+ B/s';
    }

    // Ждем загрузки страницы
    async function waitForPage(timeout = 30000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const ngSelects = document.querySelectorAll('ng-select');
            if (ngSelects.length >= 3) return true;
            await new Promise(r => setTimeout(r, 500));
        }
        return false;
    }

    // Установить значение в input для Angular
    function setInputValue(input, value) {
        if (!input) return false;
        
        input.focus();
        const setter = Object.getOwnPropertyDescriptor(
            input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            'value'
        )?.set;
        
        if (setter) setter.call(input, value);
        else input.value = value;
        
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
    }

    // Закрыть все открытые dropdown'ы
    function closeAllDropdowns() {
        const panels = document.querySelectorAll('ng-dropdown-panel');
        panels.forEach(p => p.remove());
        document.querySelectorAll('ng-select.ng-select-opened').forEach(s => {
            s.classList.remove('ng-select-opened');
        });
    }

    // Выбрать опцию в ng-select v3.6
    async function selectNgOption(ngSelect, optionText) {
        if (!ngSelect) return false;
        
        try {
            log(`Selecting "${optionText}"...`);
            
            // Закрываем все открытые dropdown'ы
            closeAllDropdowns();
            await new Promise(r => setTimeout(r, 200));
            
            // Находим input внутри ng-select и фокусируемся
            const input = ngSelect.querySelector('input');
            const container = ngSelect.querySelector('.ng-select-container');
            const arrow = ngSelect.querySelector('.ng-arrow-wrapper');
            
            // Метод 1: клик по стрелке
            if (arrow) {
                arrow.click();
                await new Promise(r => setTimeout(r, 400));
            }
            
            // Проверяем открылся ли dropdown
            let panel = document.querySelector('ng-dropdown-panel');
            
            // Метод 2: клик по контейнеру
            if (!panel && container) {
                container.click();
                await new Promise(r => setTimeout(r, 400));
                panel = document.querySelector('ng-dropdown-panel');
            }
            
            // Метод 3: фокус на input
            if (!panel && input) {
                input.focus();
                input.click();
                await new Promise(r => setTimeout(r, 400));
                panel = document.querySelector('ng-dropdown-panel');
            }
            
            // Метод 4: просто клик по ng-select
            if (!panel) {
                ngSelect.click();
                await new Promise(r => setTimeout(r, 400));
                panel = document.querySelector('ng-dropdown-panel');
            }
            
            // Ждём ещё немного
            if (!panel) {
                for (let i = 0; i < 10; i++) {
                    await new Promise(r => setTimeout(r, 200));
                    panel = document.querySelector('ng-dropdown-panel');
                    if (panel) break;
                }
            }
            
            if (!panel) {
                log(`Dropdown panel not found for: ${optionText}`, 'warn');
                return false;
            }
            
            // Ищем опцию
            const options = panel.querySelectorAll('.ng-option');
            log(`Found ${options.length} options`);
            
            for (const opt of options) {
                const label = opt.querySelector('.ng-option-label')?.textContent?.trim() || opt.textContent.trim();
                if (label.toLowerCase().includes(optionText.toLowerCase())) {
                    opt.click();
                    log(`Selected: ${label}`, 'success');
                    await new Promise(r => setTimeout(r, 400));
                    return true;
                }
            }
            
            log(`Option "${optionText}" not found`, 'warn');
            closeAllDropdowns();
            return false;
            
        } catch (e) {
            log(`Error selecting: ${e.message}`, 'error');
            closeAllDropdowns();
            return false;
        }
    }
    
    // Найти ng-select по placeholder тексту
    function findNgSelectByPlaceholder(text) {
        const selects = document.querySelectorAll('ng-select');
        for (const s of selects) {
            const placeholder = s.querySelector('.ng-placeholder')?.textContent?.toLowerCase() || '';
            const value = s.querySelector('.ng-value-label')?.textContent?.toLowerCase() || '';
            if (placeholder.includes(text.toLowerCase()) || value.includes(text.toLowerCase())) {
                return s;
            }
        }
        return null;
    }
    
    // Ждать появления ng-select с определённым placeholder
    async function waitForNgSelect(placeholderText, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const sel = findNgSelectByPlaceholder(placeholderText);
            if (sel) return sel;
            await new Promise(r => setTimeout(r, 300));
        }
        return null;
    }

    // Загрузить изображение
    async function uploadImage(imageUrl) {
        try {
            updateStatus('📥 Загрузка изображения...', 'working');
            
            const blob = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: imageUrl,
                    responseType: 'blob',
                    onload: r => r.status === 200 ? resolve(r.response) : reject(new Error(`${r.status}`)),
                    onerror: reject
                });
            });
            
            const fileInput = document.querySelector('input[type="file"]');
            if (!fileInput) return false;
            
            const file = new File([blob], 'brainrot.png', { type: 'image/png' });
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            log('Image uploaded', 'success');
            return true;
        } catch (e) {
            log('Image upload failed: ' + e.message, 'error');
            return false;
        }
    }

    // Основная функция заполнения v3.5
    async function fillForm() {
        if (!offerData) return;

        const { name, income, generatedImageUrl, minPrice, maxPrice, rarity, quantity } = offerData;
        const offerId = generateOfferId();

        updateStatus('🔄 Заполняем форму...', 'working');
        log('Starting auto-fill v3.5...');

        try {
            // Ждём загрузки страницы
            await waitForPage();
            await new Promise(r => setTimeout(r, 2000));

            const getSelects = () => [...document.querySelectorAll('ng-select')];
            
            // === 1. Income range (первый dropdown) ===
            log('Step 1: Income range -> ' + getIncomeRange(income));
            let selects = getSelects();
            if (selects[0]) {
                await selectNgOption(selects[0], getIncomeRange(income));
                await new Promise(r => setTimeout(r, 600));
            }
            
            // === 2. Mutations - None (второй dropdown) ===
            log('Step 2: Mutations -> None');
            selects = getSelects();
            if (selects[1]) {
                await selectNgOption(selects[1], 'None');
                await new Promise(r => setTimeout(r, 600));
            }
            
            // === 3. Item type - выбираем Brainrot ===
            log('Step 3: Item type -> Brainrot');
            selects = getSelects();
            if (selects[2]) {
                await selectNgOption(selects[2], 'Brainrot');
                await new Promise(r => setTimeout(r, 1000)); // Ждём появления Rarity
            }
            
            // === 4. Rarity - выбираем Secret (или указанный) ===
            log('Step 4: Rarity -> ' + (rarity || 'Secret'));
            selects = getSelects();
            if (selects.length > 3) {
                await selectNgOption(selects[3], rarity || 'Secret');
                await new Promise(r => setTimeout(r, 1000)); // Ждём появления Brainrot select
            }
            
            // === 5. Brainrot name - выбираем название или Other ===
            log('Step 5: Brainrot -> ' + name);
            selects = getSelects();
            if (selects.length > 4) {
                const selected = await selectNgOption(selects[4], name);
                if (!selected) {
                    log('Brainrot not found, selecting Other');
                    await selectNgOption(selects[4], 'Other');
                }
                await new Promise(r => setTimeout(r, 600));
            }

            // === 6. Title (maxlength=160) ===
            log('Step 6: Title');
            const titleInput = document.querySelector('textarea[maxlength="160"]');
            if (titleInput) {
                setInputValue(titleInput, generateOfferTitle(name, income));
                log('Title filled', 'success');
            }
            await new Promise(r => setTimeout(r, 300));

            // === 7. Image ===
            log('Step 7: Image');
            if (generatedImageUrl) {
                await uploadImage(generatedImageUrl);
            }
            await new Promise(r => setTimeout(r, 500));

            // === 8. Description (maxlength=2000) ===
            log('Step 8: Description');
            const descInput = document.querySelector('textarea[maxlength="2000"]');
            if (descInput) {
                setInputValue(descInput, generateOfferDescription(offerId));
                log('Description filled', 'success');
            }
            await new Promise(r => setTimeout(r, 300));

            // === 9. Delivery time ===
            log('Step 9: Delivery time');
            const deliverySelect = findNgSelectByPlaceholder('delivery');
            if (deliverySelect) {
                await selectNgOption(deliverySelect, '20 min');
            }
            await new Promise(r => setTimeout(r, 300));

            // === 10. Price ===
            log('Step 10: Price');
            const price = maxPrice || minPrice || 10;
            const priceInput = document.querySelector('input[formcontrolname="price"]') ||
                              document.querySelector('input[placeholder*="rice"]');
            if (priceInput) {
                setInputValue(priceInput, String(price));
                log(`Price set to ${price}`, 'success');
            } else {
                // Ищем по контексту
                const allInputs = document.querySelectorAll('input');
                for (const inp of allInputs) {
                    const parent = inp.closest('section, .form-group');
                    if (parent) {
                        const label = parent.querySelector('label');
                        if (label?.textContent?.toLowerCase().includes('price') && 
                            !label.textContent.toLowerCase().includes('minimum')) {
                            setInputValue(inp, String(price));
                            log(`Price set to ${price}`, 'success');
                            break;
                        }
                    }
                }
            }
            await new Promise(r => setTimeout(r, 300));

            // === 11. Quantity ===
            log('Step 11: Quantity');
            if (quantity && quantity > 1) {
                const qtyInput = document.querySelector('input[formcontrolname="quantity"]');
                if (qtyInput) {
                    setInputValue(qtyInput, String(quantity));
                    log(`Quantity set to ${quantity}`, 'success');
                }
            }

            // === 12. Checkboxes ===
            log('Step 12: Checkboxes');
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (!cb.checked) {
                    const label = cb.closest('label') || cb.parentElement?.querySelector('label');
                    (label || cb).click();
                }
            });

            updateStatus('✅ Готово! Проверьте и нажмите Place offer', 'ready');
            showNotification('✅ Форма заполнена!', 'success');

        } catch (e) {
            log('Error: ' + e.message, 'error');
            updateStatus('❌ Ошибка: ' + e.message, 'error');
            showNotification('Ошибка заполнения', 'error');
        }
    }

    // Создаём минимальную панель
    function createPanel() {
        const existing = document.querySelector('.glitched-mini');
        if (existing) existing.remove();

        if (!offerData) return;

        const price = offerData.maxPrice || offerData.minPrice || 0;
        const qty = offerData.quantity || 1;

        const panel = document.createElement('div');
        panel.className = 'glitched-mini';
        panel.innerHTML = `
            <div class="header">
                <div class="title">👾 Glitched Store</div>
                <span class="close" id="g-close">✕</span>
            </div>
            <div class="info">
                ${offerData.generatedImageUrl ? `<img src="${offerData.generatedImageUrl}" alt="">` : ''}
                <div>
                    <div class="name">${offerData.name || 'Unknown'}${qty > 1 ? ` <span style="color:#f59e0b;">x${qty}</span>` : ''}</div>
                    <div class="details">
                        <span class="income">💰 ${offerData.income || '0/s'}</span>
                        ${price > 0 ? `<span class="price">💵 $${price.toFixed(2)}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="status" id="g-status">⏳ Авто-заполнение через 3 сек...</div>
        `;

        document.body.appendChild(panel);
        statusEl = document.getElementById('g-status');
        document.getElementById('g-close').onclick = () => panel.remove();
    }

    // Инициализация
    async function init() {
        console.log('🎮 Glitched Store v3.3 loaded');

        offerData = getOfferDataFromURL();
        
        if (offerData) {
            console.log('✅ Offer data:', offerData);
            
            // Очищаем URL
            const url = new URL(window.location.href);
            url.searchParams.delete('glitched_data');
            window.history.replaceState({}, '', url.toString());
            
            await new Promise(r => setTimeout(r, 2000));
            createPanel();
            
            // Авто-заполнение через 3 секунды
            await new Promise(r => setTimeout(r, 3000));
            await fillForm();
        }
    }

    // Запуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }
})();
