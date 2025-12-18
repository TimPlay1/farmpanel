// ==UserScript==
// @name         Glitched Store - Eldorado Helper
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Auto-fill Eldorado.gg offer form + highlight your offers + price adjustment from Farmer Panel
// @author       Glitched Store
// @match        https://www.eldorado.gg/*
// @match        https://eldorado.gg/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      farmpanel.vercel.app
// @connect      api.supa.ru
// @connect      storage.supa.ru
// @connect      supa-temp.storage.yandexcloud.net
// @connect      raw.githubusercontent.com
// @connect      localhost
// @connect      *
// @updateURL    https://raw.githubusercontent.com/TimPlay1/farmpanel/main/scripts/eldorado-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/TimPlay1/farmpanel/main/scripts/eldorado-helper.user.js
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const VERSION = '8.0';
    const API_BASE = 'https://farmpanel.vercel.app/api';
    
    // ==================== КОНФИГУРАЦИЯ ====================
    let CONFIG = {
        farmKey: GM_getValue('farmKey', ''),
        highlightColor: GM_getValue('highlightColor', '#a78bfa'), // Фиолетовый по умолчанию
        highlightEnabled: GM_getValue('highlightEnabled', true),
        autoFillEnabled: GM_getValue('autoFillEnabled', true),
        showPanel: GM_getValue('showPanel', true)
    };
    
    // Кэш офферов пользователя
    let userOffers = [];
    let userOfferCodes = new Set();
    
    // ==================== СТИЛИ ====================
    GM_addStyle(`
        /* Подсветка офферов пользователя */
        .glitched-my-offer {
            position: relative;
            box-shadow: 0 0 0 3px ${CONFIG.highlightColor}, 0 0 20px ${CONFIG.highlightColor}66 !important;
            border-radius: 8px;
        }
        .glitched-my-offer::before {
            content: '✓ MY OFFER';
            position: absolute;
            top: -8px;
            right: 10px;
            background: ${CONFIG.highlightColor};
            color: white;
            font-size: 10px;
            font-weight: bold;
            padding: 2px 8px;
            border-radius: 4px;
            z-index: 100;
            box-shadow: 0 2px 8px ${CONFIG.highlightColor}88;
        }
        
        /* Панель авторизации */
        .glitched-auth-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 12px;
            padding: 16px;
            z-index: 999999;
            box-shadow: 0 15px 40px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', sans-serif;
            color: white;
            min-width: 280px;
            border: 1px solid #333;
        }
        .glitched-auth-panel .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #333;
        }
        .glitched-auth-panel .title {
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .glitched-auth-panel .title img {
            width: 24px;
            height: 24px;
        }
        .glitched-auth-panel .close-btn {
            cursor: pointer;
            opacity: 0.6;
            font-size: 18px;
            transition: opacity 0.2s;
        }
        .glitched-auth-panel .close-btn:hover { opacity: 1; }
        
        .glitched-auth-panel input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #333;
            border-radius: 8px;
            background: #0d1117;
            color: white;
            font-size: 13px;
            margin-bottom: 10px;
            box-sizing: border-box;
        }
        .glitched-auth-panel input:focus {
            outline: none;
            border-color: #a78bfa;
        }
        .glitched-auth-panel button {
            width: 100%;
            padding: 10px;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .glitched-auth-panel .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .glitched-auth-panel .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .glitched-auth-panel .btn-secondary {
            background: #333;
            color: #888;
            margin-top: 8px;
        }
        .glitched-auth-panel .btn-secondary:hover {
            background: #444;
            color: white;
        }
        .glitched-auth-panel .status {
            font-size: 12px;
            padding: 8px;
            border-radius: 6px;
            margin-bottom: 10px;
            text-align: center;
        }
        .glitched-auth-panel .status.connected {
            background: rgba(56, 239, 125, 0.1);
            color: #38ef7d;
        }
        .glitched-auth-panel .status.disconnected {
            background: rgba(244, 92, 67, 0.1);
            color: #f45c43;
        }
        .glitched-auth-panel .offers-count {
            font-size: 11px;
            color: #888;
            text-align: center;
            margin-top: 8px;
        }
        
        /* Мини-кнопка для открытия панели */
        .glitched-mini-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            cursor: pointer;
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: transform 0.2s;
        }
        .glitched-mini-btn:hover {
            transform: scale(1.1);
        }
        .glitched-mini-btn img {
            width: 24px;
            height: 24px;
        }
        
        /* Уведомления */
        .glitched-notification {
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 12px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 13px;
            z-index: 999999;
            box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4);
            animation: glitched-slide-in 0.3s ease;
            max-width: 300px;
        }
        .glitched-notification.success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
        .glitched-notification.error { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
        .glitched-notification.warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
        @keyframes glitched-slide-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `);
    
    // ==================== УТИЛИТЫ ====================
    function log(...args) {
        console.log('[Glitched]', ...args);
    }
    
    function showNotification(message, type = 'info') {
        const existing = document.querySelector('.glitched-notification');
        if (existing) existing.remove();
        
        const el = document.createElement('div');
        el.className = `glitched-notification ${type}`;
        el.textContent = message;
        document.body.appendChild(el);
        
        setTimeout(() => el.remove(), 4000);
    }
    
    // ==================== АВТОРИЗАЦИЯ ====================
    function showAuthPanel() {
        // Удаляем существующую панель
        const existing = document.querySelector('.glitched-auth-panel');
        if (existing) existing.remove();
        
        // Удаляем мини-кнопку
        const miniBtn = document.querySelector('.glitched-mini-btn');
        if (miniBtn) miniBtn.remove();
        
        const panel = document.createElement('div');
        panel.className = 'glitched-auth-panel';
        
        const isConnected = CONFIG.farmKey && userOffers.length > 0;
        
        panel.innerHTML = `
            <div class="header">
                <div class="title">
                    <span>🔮</span>
                    <span>Glitched Store v${VERSION}</span>
                </div>
                <span class="close-btn">×</span>
            </div>
            
            ${isConnected ? `
                <div class="status connected">
                    ✓ Connected to Farmer Panel
                </div>
                <div class="offers-count">
                    ${userOffers.length} offers tracked • Highlighting ${CONFIG.highlightEnabled ? 'ON' : 'OFF'}
                </div>
            ` : `
                <div class="status disconnected">
                    ✗ Not connected
                </div>
            `}
            
            <input type="text" id="glitched-farm-key" placeholder="Enter your Farm Key (FARM-XXXX-XXXX-XXXX-XXXX)" value="${CONFIG.farmKey}">
            
            <button class="btn-primary" id="glitched-connect">
                ${CONFIG.farmKey ? 'Reconnect' : 'Connect'}
            </button>
            
            ${CONFIG.farmKey ? `
                <button class="btn-secondary" id="glitched-toggle-highlight">
                    ${CONFIG.highlightEnabled ? '🔴 Disable' : '🟢 Enable'} Highlighting
                </button>
                <button class="btn-secondary" id="glitched-logout">
                    Logout
                </button>
            ` : ''}
        `;
        
        document.body.appendChild(panel);
        
        // Events
        panel.querySelector('.close-btn').onclick = () => {
            panel.remove();
            if (CONFIG.farmKey) showMiniButton();
        };
        
        panel.querySelector('#glitched-connect').onclick = async () => {
            const keyInput = panel.querySelector('#glitched-farm-key');
            const key = keyInput.value.trim();
            
            if (!key || !key.startsWith('FARM-')) {
                showNotification('Invalid Farm Key format', 'error');
                return;
            }
            
            CONFIG.farmKey = key;
            GM_setValue('farmKey', key);
            
            showNotification('Connecting...', 'info');
            await loadUserOffers();
            
            // Обновляем панель
            showAuthPanel();
        };
        
        const toggleBtn = panel.querySelector('#glitched-toggle-highlight');
        if (toggleBtn) {
            toggleBtn.onclick = () => {
                CONFIG.highlightEnabled = !CONFIG.highlightEnabled;
                GM_setValue('highlightEnabled', CONFIG.highlightEnabled);
                highlightUserOffers();
                showAuthPanel();
            };
        }
        
        const logoutBtn = panel.querySelector('#glitched-logout');
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                CONFIG.farmKey = '';
                GM_setValue('farmKey', '');
                userOffers = [];
                userOfferCodes.clear();
                highlightUserOffers();
                showAuthPanel();
                showNotification('Logged out', 'info');
            };
        }
    }
    
    function showMiniButton() {
        const existing = document.querySelector('.glitched-mini-btn');
        if (existing) return;
        
        const btn = document.createElement('div');
        btn.className = 'glitched-mini-btn';
        btn.innerHTML = '<span style="font-size: 20px;">🔮</span>';
        btn.onclick = showAuthPanel;
        document.body.appendChild(btn);
    }
    
    // ==================== ЗАГРУЗКА ОФФЕРОВ ====================
    async function loadUserOffers() {
        if (!CONFIG.farmKey) return;
        
        try {
            const response = await fetch(`${API_BASE}/offers?farmKey=${encodeURIComponent(CONFIG.farmKey)}`);
            if (!response.ok) throw new Error('Failed to fetch offers');
            
            const data = await response.json();
            userOffers = data.offers || [];
            
            // Собираем коды офферов
            userOfferCodes.clear();
            for (const offer of userOffers) {
                if (offer.offerId) {
                    userOfferCodes.add(offer.offerId.toUpperCase());
                }
            }
            
            log(`Loaded ${userOffers.length} offers, ${userOfferCodes.size} codes`);
            
            if (userOffers.length > 0) {
                showNotification(`✓ Connected! ${userOffers.length} offers loaded`, 'success');
            } else {
                showNotification('Connected but no offers found', 'warning');
            }
            
            // Подсвечиваем офферы
            highlightUserOffers();
            
        } catch (e) {
            log('Error loading offers:', e);
            showNotification('Failed to connect: ' + e.message, 'error');
        }
    }
    
    // ==================== ПОДСВЕТКА ОФФЕРОВ ====================
    function extractOfferCode(text) {
        if (!text) return null;
        
        // Ищем код в формате #XXXXXXXX
        const match = text.match(/#([A-Z0-9]{6,12})/i);
        return match ? match[1].toUpperCase() : null;
    }
    
    function highlightUserOffers() {
        // Убираем старую подсветку
        document.querySelectorAll('.glitched-my-offer').forEach(el => {
            el.classList.remove('glitched-my-offer');
        });
        
        if (!CONFIG.highlightEnabled || userOfferCodes.size === 0) return;
        
        // Ищем офферы на странице
        // Eldorado использует разные структуры на разных страницах
        const offerCards = document.querySelectorAll('[class*="offer"], [class*="Offer"], .item-card, .listing-card, [data-offer-id]');
        
        let highlighted = 0;
        
        offerCards.forEach(card => {
            const text = card.textContent || '';
            const title = card.querySelector('[class*="title"], h3, h4')?.textContent || '';
            
            // Проверяем есть ли наш код в карточке
            const codeFromText = extractOfferCode(text);
            const codeFromTitle = extractOfferCode(title);
            
            const code = codeFromText || codeFromTitle;
            
            if (code && userOfferCodes.has(code)) {
                card.classList.add('glitched-my-offer');
                highlighted++;
            }
        });
        
        // Также проверяем таблицы
        document.querySelectorAll('tr, .table-row').forEach(row => {
            const text = row.textContent || '';
            const code = extractOfferCode(text);
            
            if (code && userOfferCodes.has(code)) {
                row.classList.add('glitched-my-offer');
                highlighted++;
            }
        });
        
        if (highlighted > 0) {
            log(`Highlighted ${highlighted} offers`);
        }
    }
    
    // ==================== АВТОЗАПОЛНЕНИЕ (из старого скрипта) ====================
    // ... (код автозаполнения остаётся как в eldoradobot.js)
    
    function getOfferDataFromURL() {
        const url = new URL(window.location.href);
        const data = url.searchParams.get('glitched_data');
        if (data) {
            try {
                return JSON.parse(decodeURIComponent(data));
            } catch (e) {
                return null;
            }
        }
        return null;
    }
    
    function getPriceAdjustmentData() {
        const data = localStorage.getItem('glitched_price_adjustment');
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                return null;
            }
        }
        return null;
    }
    
    // ==================== НАБЛЮДАТЕЛЬ ЗА ИЗМЕНЕНИЯМИ ====================
    function setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            // Перепроверяем подсветку при изменениях DOM
            let shouldCheck = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    shouldCheck = true;
                    break;
                }
            }
            
            if (shouldCheck) {
                // Debounce
                clearTimeout(window.glitchedHighlightTimeout);
                window.glitchedHighlightTimeout = setTimeout(() => {
                    highlightUserOffers();
                }, 500);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // ==================== МЕНЮ TAMPERMONKEY ====================
    GM_registerMenuCommand('🔮 Open Panel', showAuthPanel);
    GM_registerMenuCommand('🔄 Refresh Offers', loadUserOffers);
    GM_registerMenuCommand('📍 Toggle Highlighting', () => {
        CONFIG.highlightEnabled = !CONFIG.highlightEnabled;
        GM_setValue('highlightEnabled', CONFIG.highlightEnabled);
        highlightUserOffers();
        showNotification(`Highlighting ${CONFIG.highlightEnabled ? 'enabled' : 'disabled'}`, 'info');
    });
    
    // ==================== ИНИЦИАЛИЗАЦИЯ ====================
    async function init() {
        log(`Glitched Store v${VERSION} initialized`);
        
        // Загружаем офферы если есть ключ
        if (CONFIG.farmKey) {
            await loadUserOffers();
            showMiniButton();
        } else {
            // Показываем панель для первой настройки
            setTimeout(showAuthPanel, 2000);
        }
        
        // Наблюдаем за изменениями DOM
        setupMutationObserver();
        
        // Проверяем данные для автозаполнения
        const offerData = getOfferDataFromURL();
        const priceData = getPriceAdjustmentData();
        
        if (offerData || priceData) {
            log('Found form data, starting auto-fill...');
            // TODO: интегрировать полный код автозаполнения из eldoradobot.js
        }
    }
    
    // Запуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
    } else {
        setTimeout(init, 1000);
    }
})();
