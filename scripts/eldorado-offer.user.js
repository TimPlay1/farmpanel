// ==UserScript==
// @name         Glitched Store - Eldorado Auto Offer
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Auto-fill Eldorado.gg offer form with brainrot data from Farmer Panel
// @author       Glitched Store
// @match        https://www.eldorado.gg/sell/offer/*
// @match        https://eldorado.gg/sell/offer/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Минимальные стили
    GM_addStyle(`
        .glitched-notification{position:fixed;top:20px;right:20px;padding:12px 20px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:10px;font-family:'Segoe UI',sans-serif;font-size:13px;z-index:999999;box-shadow:0 8px 30px rgba(102,126,234,.4);animation:gs-slide .2s}
        .glitched-notification.success{background:linear-gradient(135deg,#11998e,#38ef7d)}
        .glitched-notification.error{background:linear-gradient(135deg,#eb3349,#f45c43)}
        @keyframes gs-slide{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        .glitched-mini{position:fixed;top:80px;right:20px;width:260px;background:#1a1a2e;border-radius:12px;padding:12px;z-index:999998;box-shadow:0 15px 40px rgba(0,0,0,.5);font-family:'Segoe UI',sans-serif;color:#fff}
        .glitched-mini .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
        .glitched-mini .title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}
        .glitched-mini .close{cursor:pointer;opacity:.6;font-size:16px}
        .glitched-mini .close:hover{opacity:1}
        .glitched-mini .info{display:flex;gap:10px;align-items:center;background:#2a2a4a;border-radius:8px;padding:8px;margin-bottom:8px}
        .glitched-mini .info img{width:45px;height:45px;border-radius:6px;object-fit:cover}
        .glitched-mini .info .name{font-weight:600;font-size:12px}
        .glitched-mini .info .details{font-size:11px;color:#888}
        .glitched-mini .info .details span{margin-right:8px}
        .glitched-mini .info .income{color:#1BFF00;background:#000;border:1px solid #27C902;padding:2px 6px;border-radius:4px}
        .glitched-mini .info .price{color:#ffc950}
        .glitched-mini .status{font-size:11px;padding:6px 8px;background:rgba(255,255,255,.05);border-radius:6px;color:#888;text-align:center}
        .glitched-mini .status.working{color:#ffc950;background:rgba(255,201,80,.1)}
        .glitched-mini .status.ready{color:#38ef7d;background:rgba(56,239,125,.1)}
        .glitched-mini .status.error{color:#f45c43;background:rgba(244,92,67,.1)}
    `);

    let offerData = null;
    let statusEl = null;
    const delay = ms => new Promise(r => setTimeout(r, ms));
    const log = (msg, type = 'info') => console.log(`[GS ${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}] ${msg}`);

    function updateStatus(message, className = '') {
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `status ${className}`;
        }
    }

    function getOfferDataFromURL() {
        const p = new URLSearchParams(location.search).get('glitched_data');
        if (p) try { return JSON.parse(decodeURIComponent(p)); } catch {}
        return null;
    }

    function showNotification(message, type = 'info') {
        document.querySelector('.glitched-notification')?.remove();
        const n = document.createElement('div');
        n.className = `glitched-notification ${type}`;
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }

    const generateOfferId = () => `GS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`.toUpperCase();
    const generateTitle = (name, income) => `🔥${name} l ${income || '0/s'}🔥 Fast Delivery🚚 👾Glitched Store👾`.slice(0, 160);
    const generateDescription = id => `📦 How We Delivery
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

#${id}`;

    function getIncomeRange(income) {
        if (!income) return '0-24 M/s';
        const v = parseFloat(income.match(/[\d.]+/)?.[0] || 0);
        if (v < 25) return '0-24 M/s';
        if (v < 50) return '25-49 M/s';
        if (v < 100) return '50-99 M/s';
        if (v < 250) return '100-249 M/s';
        if (v < 500) return '250-499 M/s';
        if (v < 750) return '500-749 M/s';
        if (v < 1000) return '750-999 M/s';
        return '1+ B/s';
    }

    function setInputValue(input, value) {
        if (!input) return false;
        input.focus();
        const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
        Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    // Найти ng-select по aria-label
    function findSelect(label) {
        for (const inp of document.querySelectorAll('.hidden.md\\:block input[aria-label]')) {
            if (inp.getAttribute('aria-label')?.toLowerCase() === label.toLowerCase()) {
                return inp.closest('ng-select');
            }
        }
        return null;
    }

    // Выбрать опцию в ng-select (оптимизировано)
    async function selectOption(ngSelect, optionText) {
        if (!ngSelect) return false;
        
        const input = ngSelect.querySelector('input[role="combobox"]');
        if (!input) return false;
        
        // Закрываем все панели
        document.querySelectorAll('ng-dropdown-panel').forEach(p => p.remove());
        
        // Открываем dropdown
        input.focus();
        input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        
        // Ждём панель (макс 1.5 сек)
        let panel = null;
        for (let i = 0; i < 15; i++) {
            panel = document.querySelector('ng-dropdown-panel');
            if (panel) break;
            await delay(100);
        }
        if (!panel) return false;
        
        // Ищем опцию
        const search = optionText.toLowerCase();
        for (const opt of panel.querySelectorAll('.ng-option')) {
            const label = opt.textContent.trim().toLowerCase();
            if (label === search || label.includes(search)) {
                opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                log(`Selected: ${opt.textContent.trim()}`, 'success');
                await delay(200);
                return true;
            }
        }
        return false;
    }

    // Ждать появления dropdown по label
    async function waitForSelect(label, timeout = 2000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const sel = findSelect(label);
            if (sel) return sel;
            await delay(150);
        }
        return null;
    }

    async function uploadImage(imageUrl) {
        try {
            const blob = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET', url: imageUrl, responseType: 'blob',
                    onload: r => r.status === 200 ? resolve(r.response) : reject(),
                    onerror: reject
                });
            });
            
            const fileInput = document.querySelector('input[type="file"]');
            if (!fileInput) return false;
            
            const dt = new DataTransfer();
            dt.items.add(new File([blob], 'brainrot.png', { type: 'image/png' }));
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        } catch { return false; }
    }

    async function fillForm() {
        if (!offerData) return;
        const { name, income, generatedImageUrl, minPrice, maxPrice, rarity, quantity } = offerData;
        const offerId = generateOfferId();

        updateStatus('🔄 Заполняем...', 'working');
        log('Starting v4.1...');

        try {
            // Ждём загрузки (макс 5 сек)
            for (let i = 0; i < 25 && document.querySelectorAll('ng-select').length < 3; i++) await delay(200);
            await delay(500);

            // 1. M/s range
            const msSelect = findSelect('M/s') || document.querySelector('.hidden.md\\:block ng-select');
            if (msSelect) await selectOption(msSelect, getIncomeRange(income));

            // 2. Mutations
            const mutSelect = findSelect('Mutations');
            if (mutSelect) await selectOption(mutSelect, 'None');

            // 3. Item type -> Brainrot
            const itemSelect = findSelect('Item type');
            if (itemSelect) {
                await selectOption(itemSelect, 'Brainrot');
                await delay(300);
            }

            // 4. Rarity
            const raritySelect = await waitForSelect('Rarity');
            if (raritySelect) {
                await selectOption(raritySelect, rarity || 'Secret');
                await delay(300);
            }

            // 5. Brainrot name
            const brainrotSelect = await waitForSelect('Brainrot');
            if (brainrotSelect) {
                const ok = await selectOption(brainrotSelect, name);
                if (!ok) await selectOption(brainrotSelect, 'Other');
            }

            // 6-8. Текстовые поля (параллельно)
            setInputValue(document.querySelector('textarea[maxlength="160"]'), generateTitle(name, income));
            setInputValue(document.querySelector('textarea[maxlength="2000"]'), generateDescription(offerId));
            
            // 9. Image
            if (generatedImageUrl) await uploadImage(generatedImageUrl);

            // 10. Delivery
            const deliverySelect = [...document.querySelectorAll('ng-select')].find(s => 
                s.querySelector('.ng-placeholder')?.textContent?.toLowerCase().includes('delivery')
            );
            if (deliverySelect) await selectOption(deliverySelect, '20 min');

            // 11. Price
            const price = maxPrice || minPrice || 10;
            const priceInput = document.querySelector('input[formcontrolname="price"]') ||
                [...document.querySelectorAll('input')].find(i => i.closest('section')?.textContent?.includes('Price'));
            setInputValue(priceInput, String(price));

            // 12. Quantity
            if (quantity > 1) {
                setInputValue(document.querySelector('input[formcontrolname="quantity"]'), String(quantity));
            }

            // 13. Checkboxes
            document.querySelectorAll('input[type="checkbox"]:not(:checked)').forEach(cb => {
                (cb.closest('label') || cb).click();
            });

            updateStatus('✅ Готово!', 'ready');
            showNotification('✅ Форма заполнена!', 'success');

        } catch (e) {
            log('Error: ' + e.message, 'error');
            updateStatus('❌ Ошибка', 'error');
        }
    }

    function createPanel() {
        document.querySelector('.glitched-mini')?.remove();
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
            <div class="status" id="g-status">⏳ Заполняем...</div>
        `;
        document.body.appendChild(panel);
        statusEl = document.getElementById('g-status');
        document.getElementById('g-close').onclick = () => panel.remove();
    }

    async function init() {
        console.log('🎮 Glitched Store v4.1');
        offerData = getOfferDataFromURL();
        
        if (offerData) {
            // Очищаем URL
            const url = new URL(location.href);
            url.searchParams.delete('glitched_data');
            history.replaceState({}, '', url);
            
            await delay(1500);
            createPanel();
            await delay(500);
            await fillForm();
        }
    }

    document.readyState === 'loading' 
        ? document.addEventListener('DOMContentLoaded', init) 
        : setTimeout(init, 500);
})();
