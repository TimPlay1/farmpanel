// ==UserScript==
// @name         Glitched Store - Eldorado Helper
// @namespace    http://tampermonkey.net/
// @version      9.0
// @description  Auto-fill Eldorado.gg offer form + highlight YOUR offers by unique code + price adjustment from Farmer Panel + Queue support
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
// @updateURL    https://raw.githubusercontent.com/TimPlay1/farmpanel/main/scripts/eldorado-helper.user.js?v=9.0
// @downloadURL  https://raw.githubusercontent.com/TimPlay1/farmpanel/main/scripts/eldorado-helper.user.js?v=9.0
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const VERSION = '9.0';
    const API_BASE = 'https://farmpanel.vercel.app/api';
    
    // ==================== СОСТОЯНИЕ ====================
    let offerData = null;
    let adjustmentData = null;
    let statusEl = null;
    
    // Queue state
    let queueState = {
        queue: [],
        currentIndex: 0,
        completed: []
    };
    
    // ==================== КОНФИГУРАЦИЯ ====================
    let CONFIG = {
        farmKey: GM_getValue('farmKey', ''),
        highlightColor: GM_getValue('highlightColor', '#a78bfa'), // Фиолетовый по умолчанию
        highlightEnabled: GM_getValue('highlightEnabled', true),
        autoFillEnabled: GM_getValue('autoFillEnabled', true),
        showPanel: GM_getValue('showPanel', true),
        connectionError: false // Для отслеживания ошибок авторизации
    };
    
    // Кэш офферов пользователя
    let userOffers = [];
    let userOfferCodes = new Set(); // Уникальные коды офферов типа #GSXXXXXX
    let userBrainrotNames = new Set(); // Имена brainrots для справки
    
    // ==================== СТИЛИ ====================
    GM_addStyle(`
        /* Подсветка карточки оффера на dashboard и marketplace */
        eld-offer-item.glitched-my-offer {
            position: relative;
            display: block;
        }
        /* Обводка и фон для внутренней ссылки */
        eld-offer-item.glitched-my-offer > eld-card > a,
        .offer-info.glitched-my-offer {
            box-shadow: 0 0 0 3px ${CONFIG.highlightColor}, 0 0 20px ${CONFIG.highlightColor}66 !important;
            border-radius: 8px !important;
            background: linear-gradient(135deg, #1a1a3e 0%, #2d1b4e 100%) !important;
        }
        /* Бейдж MY OFFER */
        eld-offer-item.glitched-my-offer::before,
        .offer-info.glitched-my-offer::before {
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
        
        /* Подсветка строк в orders-container (страница заказов) */
        .orders-container .grid-row.glitched-my-offer {
            position: relative;
            box-shadow: 0 0 0 2px ${CONFIG.highlightColor}, 0 0 15px ${CONFIG.highlightColor}44 !important;
            border-radius: 8px !important;
            background: linear-gradient(135deg, #1a1a3e 0%, #2d1b4e 100%) !important;
        }
        .orders-container .grid-row.glitched-my-offer::before {
            content: '✓ MY';
            position: absolute;
            top: 50%;
            left: -35px;
            transform: translateY(-50%);
            background: ${CONFIG.highlightColor};
            color: white;
            font-size: 9px;
            font-weight: bold;
            padding: 2px 4px;
            border-radius: 3px;
            z-index: 100;
        }
        
        /* Анимация текста заголовка оффера */
        .offer-title.glitched-my-offer-text {
            background: linear-gradient(90deg, ${CONFIG.highlightColor}, #667eea, #a78bfa, ${CONFIG.highlightColor}) !important;
            background-size: 300% auto !important;
            -webkit-background-clip: text !important;
            background-clip: text !important;
            -webkit-text-fill-color: transparent !important;
            animation: glitched-text-shine 2s linear infinite !important;
            font-weight: bold !important;
        }
        @keyframes glitched-text-shine {
            0% { background-position: 200% center; }
            100% { background-position: -200% center; }
        }
        @keyframes glitched-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        /* Панель авторизации - позиция под navbar */
        .glitched-auth-panel {
            position: fixed;
            top: 100px; /* Под navbar (navbar ~88px + отступ) */
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
        
        /* Мини-кнопка для открытия панели - позиция под navbar */
        .glitched-mini-btn {
            position: fixed;
            top: 100px; /* Под navbar (navbar ~88px + отступ) */
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
        
        /* Под navbar для встраивания в страницу */
        .glitched-inline-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 8px;
            cursor: pointer;
            margin-left: 10px;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .glitched-inline-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
        }
        .glitched-mini-btn:hover {
            transform: scale(1.1);
        }
        .glitched-mini-btn img {
            width: 24px;
            height: 24px;
        }
        
        /* Уведомления - позиция под navbar */
        .glitched-notification {
            position: fixed;
            top: 100px; /* Под navbar */
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
        
        /* Мини-панель автозаполнения */
        .glitched-mini {
            position: fixed;
            top: 100px;
            right: 20px;
            width: 300px;
            background: #1a1a2e;
            border-radius: 12px;
            padding: 12px;
            z-index: 999998;
            box-shadow: 0 15px 40px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', sans-serif;
            color: white;
        }
        .glitched-mini .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .glitched-mini .title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .glitched-mini .close { cursor: pointer; opacity: 0.6; font-size: 16px; }
        .glitched-mini .close:hover { opacity: 1; }
        .glitched-mini .info { display: flex; gap: 10px; align-items: center; background: #2a2a4a; border-radius: 8px; padding: 8px; margin-bottom: 8px; }
        .glitched-mini .info img { width: 45px; height: 45px; border-radius: 6px; object-fit: cover; }
        .glitched-mini .info .name { font-weight: 600; font-size: 12px; }
        .glitched-mini .info .details { font-size: 11px; color: #888; }
        .glitched-mini .info .income { color: #1BFF00; background: #000; border: 1px solid #27C902; padding: 2px 6px; border-radius: 4px; }
        .glitched-mini .info .price { color: #ffc950; }
        .glitched-mini .status { font-size: 11px; padding: 6px 8px; background: rgba(255,255,255,0.05); border-radius: 6px; color: #888; text-align: center; }
        .glitched-mini .status.working { color: #ffc950; background: rgba(255, 201, 80, 0.1); }
        .glitched-mini .status.ready { color: #38ef7d; background: rgba(56, 239, 125, 0.1); }
        .glitched-mini .status.error { color: #f45c43; background: rgba(244, 92, 67, 0.1); }
        .glitched-mini .queue-info { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 8px; border-radius: 8px; margin-bottom: 8px; text-align: center; font-size: 12px; }
        .glitched-mini .queue-info .queue-progress { font-weight: 600; }
        .glitched-mini .queue-list { max-height: 150px; overflow-y: auto; margin-top: 8px; font-size: 11px; }
        .glitched-mini .queue-item { display: flex; align-items: center; gap: 6px; padding: 4px 6px; background: #2a2a4a; border-radius: 4px; margin-bottom: 3px; }
        .glitched-mini .queue-item.current { background: rgba(99, 102, 241, 0.3); border: 1px solid #6366f1; }
        .glitched-mini .queue-item.done { opacity: 0.5; text-decoration: line-through; }
        .glitched-mini .queue-item .q-icon { width: 16px; text-align: center; }
        .glitched-mini .queue-item .q-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    `);
    
    // ==================== УТИЛИТЫ ====================
    function log(...args) {
        console.log('[Glitched]', ...args);
    }
    
    function updateStatus(message, className = '') {
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `status ${className}`;
        }
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
        
        const isConnected = CONFIG.farmKey && userOffers.length >= 0 && !CONFIG.connectionError;
        
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
                    ${userOffers.length} brainrots tracked • Highlighting ${CONFIG.highlightEnabled ? 'ON' : 'OFF'}
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
        // Удаляем существующие кнопки
        document.querySelectorAll('.glitched-mini-btn, .glitched-inline-btn').forEach(el => el.remove());
        
        // Пытаемся встроить кнопку в navbar
        const navbar = document.querySelector('.navbar-grid-layout.responsive-layout');
        if (navbar) {
            // Ищем правую часть navbar для вставки кнопки
            const navbarRight = navbar.querySelector('.activities-area') || 
                               navbar.querySelector('.navbar-content') ||
                               navbar.querySelector('[class*="activities"]');
            
            if (navbarRight) {
                const inlineBtn = document.createElement('div');
                inlineBtn.className = 'glitched-inline-btn';
                inlineBtn.innerHTML = '<span style="font-size: 18px;">🔮</span>';
                inlineBtn.onclick = showAuthPanel;
                inlineBtn.title = 'Glitched Store Panel';
                
                // Вставляем в начало правой части navbar
                navbarRight.insertBefore(inlineBtn, navbarRight.firstChild);
                log('Panel button inserted into navbar');
                return;
            }
        }
        
        // Fallback - фиксированная кнопка под navbar
        const btn = document.createElement('div');
        btn.className = 'glitched-mini-btn';
        btn.innerHTML = '<span style="font-size: 20px;">🔮</span>';
        btn.onclick = showAuthPanel;
        btn.title = 'Glitched Store Panel';
        document.body.appendChild(btn);
        log('Panel button added as fixed position');
    }
    
    // ==================== ЗАГРУЗКА ДАННЫХ ФЕРМЕРА ====================
    async function loadUserOffers() {
        if (!CONFIG.farmKey) return;
        
        // Сначала загружаем из кэша для мгновенного отображения
        const cached = localStorage.getItem('glitched_offer_codes');
        if (cached) {
            try {
                const cachedCodes = JSON.parse(cached);
                cachedCodes.forEach(code => userOfferCodes.add(code));
                log(`Loaded ${cachedCodes.length} codes from cache`);
                // Сразу подсвечиваем из кэша
                highlightUserOffers();
            } catch (e) {}
        }
        
        try {
            // Загружаем данные фермера с аккаунтами и brainrots
            const response = await fetch(`${API_BASE}/sync?key=${encodeURIComponent(CONFIG.farmKey)}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Farm Key not found. Please check your key.');
                }
                throw new Error('Failed to fetch data');
            }
            
            const farmer = await response.json();
            const accounts = farmer.accounts || [];
            
            // Собираем все brainrots со всех аккаунтов
            userOffers = [];
            userOfferCodes.clear();
            userBrainrotNames.clear();
            
            for (const account of accounts) {
                const brainrots = account.brainrots || [];
                for (const br of brainrots) {
                    // Создаём объект оффера
                    const offer = {
                        name: br.name || br.Name,
                        income: br.income || br.Income,
                        imageId: br.imageId || br.ImageId,
                        offerId: br.offerId || br.OfferId, // Уникальный код оффера #GSXXXXXX
                        accountName: account.playerName || account.name,
                        accountId: account.userId
                    };
                    userOffers.push(offer);
                    
                    // Добавляем уникальный код оффера для подсветки
                    if (offer.offerId) {
                        // Код может быть с # или без
                        const code = offer.offerId.toUpperCase().replace(/^#/, '');
                        userOfferCodes.add(code);
                        userOfferCodes.add('#' + code); // Добавляем и с #
                    }
                    
                    // Сохраняем имя brainrot для справки
                    if (offer.name) {
                        userBrainrotNames.add(offer.name.toUpperCase());
                    }
                }
            }
            
            // Также загружаем офферы из /api/offers если есть
            try {
                const offersResponse = await fetch(`${API_BASE}/offers?farmKey=${encodeURIComponent(CONFIG.farmKey)}`);
                if (offersResponse.ok) {
                    const offersData = await offersResponse.json();
                    const apiOffers = offersData.offers || [];
                    
                    for (const offer of apiOffers) {
                        if (offer.offerId) {
                            const code = offer.offerId.toUpperCase().replace(/^#/, '');
                            userOfferCodes.add(code);
                            userOfferCodes.add('#' + code);
                        }
                    }
                    log(`Loaded ${apiOffers.length} offers from API`);
                }
            } catch (offersErr) {
                log('Could not load offers from API:', offersErr);
            }
            
            // Сохраняем в кэш для быстрой загрузки в следующий раз
            try {
                localStorage.setItem('glitched_offer_codes', JSON.stringify([...userOfferCodes]));
            } catch (e) {}
            
            log(`Loaded ${accounts.length} accounts, ${userOffers.length} brainrots, ${userOfferCodes.size} unique codes`);
            CONFIG.connectionError = false;
            
            if (userOffers.length > 0) {
                showNotification(`✓ Connected! ${accounts.length} accounts, ${userOffers.length} brainrots`, 'success');
            } else if (accounts.length > 0) {
                showNotification(`✓ Connected! ${accounts.length} accounts (no brainrots)`, 'success');
            } else {
                showNotification('Connected but no accounts found', 'warning');
            }
            
            // Подсвечиваем офферы
            highlightUserOffers();
            
        } catch (e) {
            CONFIG.connectionError = true;
            log('Error loading data:', e);
            showNotification('Failed to connect: ' + e.message, 'error');
        }
    }
    
    // ==================== ПОДСВЕТКА ОФФЕРОВ ====================
    function normalizeText(text) {
        if (!text) return '';
        // Убираем лишние пробелы и приводим к верхнему регистру
        return text.replace(/\s+/g, ' ').trim().toUpperCase();
    }
    
    // Проверяем наличие уникального кода оффера (#GSXXXXXX) в тексте
    function containsOfferCode(text) {
        if (!text) return false;
        const normalizedText = normalizeText(text);
        
        // Ищем паттерн #GS + 6-8 символов (буквы/цифры)
        const codeMatches = normalizedText.match(/#?GS[A-Z0-9]{5,8}/g);
        if (!codeMatches) return false;
        
        for (const match of codeMatches) {
            const code = match.replace(/^#/, '');
            if (userOfferCodes.has(code) || userOfferCodes.has('#' + code)) {
                return true;
            }
        }
        return false;
    }
    
    // Старая функция для совместимости - проверка по имени brainrot
    function containsBrainrotName(text) {
        const normalizedText = normalizeText(text);
        for (const name of userBrainrotNames) {
            if (normalizedText.includes(name)) {
                return true;
            }
        }
        return false;
    }

    function highlightUserOffers() {
        // Убираем старую подсветку
        document.querySelectorAll('.glitched-my-offer').forEach(el => {
            el.classList.remove('glitched-my-offer');
        });
        document.querySelectorAll('.glitched-my-offer-text').forEach(el => {
            el.classList.remove('glitched-my-offer-text');
        });
        
        if (!CONFIG.highlightEnabled || userOfferCodes.size === 0) return;
        
        let highlighted = 0;
        
        // === СПОСОБ 0: Orders страница (dashboard/orders) - строки .grid-row ===
        const ordersContainer = document.querySelector('.orders-container');
        if (ordersContainer) {
            const orderRows = ordersContainer.querySelectorAll('.grid-row');
            orderRows.forEach(row => {
                const text = row.textContent || '';
                // Ищем по коду оффера или по "Glitched Store" в названии
                if (containsOfferCode(text) || text.includes('Glitched Store')) {
                    row.classList.add('glitched-my-offer');
                    highlighted++;
                }
            });
            
            if (highlighted > 0) {
                log(`Orders: Highlighted ${highlighted} order rows`);
            }
            return;
        }
        
        // === СПОСОБ 1: Dashboard страница с карточками офферов (.offer-info) ===
        const offerInfoCards = document.querySelectorAll('.offer-info');
        
        if (offerInfoCards.length > 0) {
            // Мы на dashboard странице - подсвечиваем карточки
            offerInfoCards.forEach(card => {
                const text = card.textContent || '';
                
                if (containsOfferCode(text)) {
                    card.classList.add('glitched-my-offer');
                    highlighted++;
                }
            });
            
            if (highlighted > 0) {
                log(`Dashboard: Highlighted ${highlighted} offer cards`);
            }
            return; // На dashboard не нужно искать текст
        }
        
        // === СПОСОБ 2: Marketplace - ищем .offer-title и подсвечиваем карточку eld-offer-item ===
        const offerTitles = document.querySelectorAll('.offer-title');
        
        if (offerTitles.length > 0) {
            offerTitles.forEach(titleEl => {
                const text = titleEl.textContent || '';
                
                if (containsOfferCode(text)) {
                    // Анимируем текст заголовка
                    titleEl.classList.add('glitched-my-offer-text');
                    
                    // Находим родительскую карточку eld-offer-item или eld-card для фона
                    const card = titleEl.closest('eld-offer-item') || titleEl.closest('eld-card') || titleEl.closest('a[href*="/oi/"]');
                    if (card) {
                        card.classList.add('glitched-my-offer');
                        highlighted++;
                    }
                }
            });
            
            if (highlighted > 0) {
                log(`Marketplace: Highlighted ${highlighted} offer cards`);
            }
            return;
        }
        
        // === СПОСОБ 3: Fallback - ищем ссылки на офферы ===
        document.querySelectorAll('a[href*="/oi/"]').forEach(link => {
            const text = link.textContent || '';
            
            if (containsOfferCode(text)) {
                // Находим карточку
                const card = link.closest('eld-offer-item') || link.closest('eld-card') || link;
                card.classList.add('glitched-my-offer');
                highlighted++;
            }
        });
        
        if (highlighted > 0) {
            log(`Fallback: Highlighted ${highlighted} offer cards`);
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
    
    function getAdjustmentDataFromURL() {
        const url = new URL(window.location.href);
        const data = url.searchParams.get('glitched_adjust');
        if (data) {
            try {
                return JSON.parse(decodeURIComponent(data));
            } catch (e) {}
        }
        // Также проверяем localStorage
        const stored = localStorage.getItem('glitched_price_adjustment');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {}
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
    
    // ==================== УПРАВЛЕНИЕ ОЧЕРЕДЬЮ ====================
    function getQueueFromStorage() {
        try {
            const queueStr = localStorage.getItem('eldoradoQueue');
            const indexStr = localStorage.getItem('eldoradoQueueIndex');
            const completedStr = localStorage.getItem('eldoradoQueueCompleted');
            if (queueStr) {
                queueState.queue = JSON.parse(queueStr);
                queueState.currentIndex = indexStr ? parseInt(indexStr, 10) : 0;
                queueState.completed = completedStr ? JSON.parse(completedStr) : [];
                log(`Queue loaded: ${queueState.queue.length} items, index: ${queueState.currentIndex}`);
                return queueState.queue.length > 0;
            }
        } catch (e) { console.error('Failed to load queue:', e); }
        return false;
    }
    
    function saveQueueState() {
        localStorage.setItem('eldoradoQueueIndex', queueState.currentIndex.toString());
        localStorage.setItem('eldoradoQueueCompleted', JSON.stringify(queueState.completed));
    }
    
    function getCurrentQueueItem() {
        if (queueState.queue.length === 0 || queueState.currentIndex >= queueState.queue.length) return null;
        return queueState.queue[queueState.currentIndex];
    }
    
    function markCurrentAsDone() {
        const current = getCurrentQueueItem();
        if (current) {
            queueState.completed.push({ ...current, completedAt: Date.now() });
            queueState.currentIndex++;
            saveQueueState();
            log(`Marked item ${queueState.currentIndex - 1} as done`);
        }
    }
    
    function hasMoreInQueue() { return queueState.currentIndex < queueState.queue.length; }
    
    function clearQueue() {
        localStorage.removeItem('eldoradoQueue');
        localStorage.removeItem('eldoradoQueueIndex');
        localStorage.removeItem('eldoradoQueueCompleted');
        localStorage.removeItem('eldoradoQueueTimestamp');
        queueState = { queue: [], currentIndex: 0, completed: [] };
        log('Queue cleared');
    }
    
    function processNextQueueItem() {
        const item = getCurrentQueueItem();
        if (!item) {
            log('No more items in queue');
            showNotification('✅ Очередь завершена!', 'success');
            clearQueue();
            return false;
        }
        log(`Processing queue item: ${item.name}`);
        const offerDataForUrl = {
            name: item.name, income: item.income, generatedImageUrl: item.imageUrl,
            maxPrice: parseFloat(item.price) || 0, minPrice: parseFloat(item.price) || 0,
            accountName: item.accountName, fromQueue: true,
            queueIndex: queueState.currentIndex, queueTotal: queueState.queue.length
        };
        const encodedData = encodeURIComponent(JSON.stringify(offerDataForUrl));
        const url = `https://www.eldorado.gg/sell/offer/CustomItem/259?glitched_data=${encodedData}`;
        window.location.href = url;
        return true;
    }
    
    // ==================== ANGULAR HELPERS ====================
    function setInputValue(input, value) {
        if (!input) return false;
        input.focus();
        const setter = Object.getOwnPropertyDescriptor(
            input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
        )?.set;
        if (setter) setter.call(input, value);
        else input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
    }

    function closeAllDropdowns() {
        document.querySelectorAll('ng-dropdown-panel').forEach(p => p.remove());
        document.querySelectorAll('ng-select.ng-select-opened').forEach(s => s.classList.remove('ng-select-opened'));
    }

    function getNgSelectValue(ngSelect) {
        if (!ngSelect) return null;
        return ngSelect.querySelector('.ng-value-label')?.textContent?.trim() || null;
    }

    function isValueSelected(ngSelect, expectedText) {
        const currentValue = getNgSelectValue(ngSelect);
        if (!currentValue) return false;
        return currentValue.toLowerCase().includes(expectedText.toLowerCase()) ||
               expectedText.toLowerCase().includes(currentValue.toLowerCase());
    }

    async function trySelectNgOption(ngSelect, optionText) {
        if (!ngSelect) return false;
        
        try {
            closeAllDropdowns();
            await new Promise(r => setTimeout(r, 150));
            
            const input = ngSelect.querySelector('input[role="combobox"]');
            if (!input) {
                log('Input not found in ng-select', 'warn');
                return false;
            }
            
            input.focus();
            await new Promise(r => setTimeout(r, 50));
            
            input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            await new Promise(r => setTimeout(r, 50));
            input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await new Promise(r => setTimeout(r, 200));
            
            let isOpen = input.getAttribute('aria-expanded') === 'true';
            
            if (!isOpen) {
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
                await new Promise(r => setTimeout(r, 200));
            }
            
            let panel = null;
            for (let i = 0; i < 20; i++) {
                panel = document.querySelector('ng-dropdown-panel');
                if (panel) break;
                await new Promise(r => setTimeout(r, 80));
            }
            
            if (!panel) {
                log(`Dropdown panel not found for: ${optionText}`, 'warn');
                return false;
            }
            
            const options = panel.querySelectorAll('.ng-option');
            const searchText = optionText.toLowerCase();
            
            // Exact match first
            for (const opt of options) {
                const label = opt.querySelector('.ng-option-label')?.textContent?.trim() || opt.textContent.trim();
                if (label.toLowerCase() === searchText) {
                    opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 30));
                    opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 250));
                    return true;
                }
            }
            
            // Partial match
            for (const opt of options) {
                const label = opt.querySelector('.ng-option-label')?.textContent?.trim() || opt.textContent.trim();
                if (label.toLowerCase().includes(searchText) || searchText.includes(label.toLowerCase())) {
                    opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 30));
                    opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 250));
                    return true;
                }
            }
            
            closeAllDropdowns();
            return false;
            
        } catch (e) {
            log(`Error selecting: ${e.message}`, 'error');
            closeAllDropdowns();
            return false;
        }
    }

    async function selectNgOption(ngSelect, optionText, maxRetries = 3) {
        if (!ngSelect) return false;
        
        log(`Selecting "${optionText}"...`);
        
        // Сначала проверяем - может уже выбрано
        if (isValueSelected(ngSelect, optionText)) {
            log(`Already selected: ${optionText}`, 'success');
            return true;
        }
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            log(`Attempt ${attempt}/${maxRetries} for "${optionText}"`);
            
            const clicked = await trySelectNgOption(ngSelect, optionText);
            await new Promise(r => setTimeout(r, 300));
            
            // Проверяем результат
            if (isValueSelected(ngSelect, optionText)) {
                log(`Selected: ${optionText}`, 'success');
                return true;
            }
            
            if (!clicked) {
                log(`Option "${optionText}" not clicked`, 'warn');
            } else {
                log(`Clicked but not selected: ${optionText}`, 'warn');
            }
            
            await new Promise(r => setTimeout(r, 500));
        }
        
        log(`Failed to select "${optionText}" after ${maxRetries} attempts`, 'error');
        return false;
    }

    function findNgSelectByAriaLabel(label) {
        // Сначала ищем в desktop версии
        const inputs = document.querySelectorAll('.hidden.md\\:block input[aria-label]');
        for (const input of inputs) {
            if (input.getAttribute('aria-label')?.toLowerCase() === label.toLowerCase()) {
                return input.closest('ng-select');
            }
        }
        // Потом во всех ng-select
        const allInputs = document.querySelectorAll('ng-select input[aria-label]');
        for (const input of allInputs) {
            if (input.getAttribute('aria-label')?.toLowerCase() === label.toLowerCase()) {
                return input.closest('ng-select');
            }
        }
        return null;
    }

    function findNgSelectByPlaceholder(text) {
        const selects = document.querySelectorAll('ng-select');
        for (const s of selects) {
            const placeholder = s.querySelector('.ng-placeholder')?.textContent?.toLowerCase() || '';
            const value = s.querySelector('.ng-value-label')?.textContent?.toLowerCase() || '';
            if (placeholder.includes(text.toLowerCase()) || value.includes(text.toLowerCase())) return s;
        }
        return null;
    }

    // ==================== ГЕНЕРАТОРЫ ====================
    function generateOfferId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return `GS${code}`;
    }

    function generateOfferTitle(brainrotName, income, offerId) {
        const base = `🔥${brainrotName} l ${income || '0/s'}🔥 Fast Delivery🚚 👾Glitched Store👾`;
        return (base + ` #${offerId}`).substring(0, 160);
    }

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

    function getIncomeRange(income) {
        if (!income) return '0-24 M/s';
        const incomeStr = String(income).toUpperCase();
        
        // Если есть B (Billion) в строке - это 1+ B/s
        if (incomeStr.includes('B')) {
            return '1+ B/s';
        }
        
        const match = incomeStr.match(/[\d.]+/);
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

    async function waitForOfferPage(timeout = 30000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (document.querySelectorAll('ng-select').length >= 3) return true;
            await new Promise(r => setTimeout(r, 500));
        }
        return false;
    }

    async function uploadImage(imageUrl) {
        try {
            updateStatus('📥 Загрузка изображения...', 'working');
            const blob = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET', url: imageUrl, responseType: 'blob',
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

    async function setTotalQuantity(quantity) {
        if (!quantity || quantity < 1) quantity = 1;
        
        try {
            // Ищем поле Total Quantity по aria-label
            let qtyInput = document.querySelector('input[aria-label="Numeric input field"]');
            
            // Если не нашли, ищем по контексту "Total Quantity"
            if (!qtyInput) {
                const qtyLabel = [...document.querySelectorAll('span')].find(s => 
                    s.textContent?.toLowerCase().includes('total quantity')
                );
                if (qtyLabel) {
                    const container = qtyLabel.closest('.value-group') || qtyLabel.closest('div');
                    qtyInput = container?.querySelector('input');
                }
            }
            
            // Ещё один способ - ищем eld-numeric-input с aria-label="Total Quantity"
            if (!qtyInput) {
                const qtyGroup = document.querySelector('[aria-label="Total Quantity"]');
                if (qtyGroup) {
                    qtyInput = qtyGroup.querySelector('input');
                }
            }
            
            // Пробуем найти по классу value-group
            if (!qtyInput) {
                const valueGroups = document.querySelectorAll('.value-group');
                for (const group of valueGroups) {
                    if (group.textContent?.toLowerCase().includes('quantity')) {
                        qtyInput = group.querySelector('input');
                        break;
                    }
                }
            }
            
            if (!qtyInput) {
                log('Total Quantity input not found', 'warn');
                return false;
            }
            
            log(`Found Total Quantity input, setting to ${quantity}`);
            
            // Устанавливаем значение
            qtyInput.focus();
            await new Promise(r => setTimeout(r, 100));
            
            // Очищаем поле
            qtyInput.value = '';
            qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 50));
            
            // Вводим значение посимвольно для Angular
            const qtyStr = String(quantity);
            for (const char of qtyStr) {
                qtyInput.value += char;
                qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
                qtyInput.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
                qtyInput.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
                await new Promise(r => setTimeout(r, 30));
            }
            
            // Финальные события
            qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
            qtyInput.dispatchEvent(new Event('blur', { bubbles: true }));
            
            log(`Total Quantity set to ${quantity}`, 'success');
            return true;
            
        } catch (e) {
            log(`Error setting Total Quantity: ${e.message}`, 'error');
            return false;
        }
    }

    // ==================== ЗАПОЛНЕНИЕ ФОРМЫ ====================
    async function fillOfferForm() {
        if (!offerData) return;

        const { name, income, generatedImageUrl, minPrice, maxPrice, rarity, quantity } = offerData;
        const offerId = generateOfferId();
        const totalQuantity = quantity || 1;

        updateStatus('🔄 Заполняем форму...', 'working');
        log(`Starting auto-fill v5.3... (quantity: ${totalQuantity})`);

        try {
            await waitForOfferPage();
            await new Promise(r => setTimeout(r, 1000));

            const expectedIncomeRange = getIncomeRange(income);
            const expectedRarity = rarity || 'Secret';
            
            // Track what we need to verify at the end
            const verificationResults = {};

            // 1. Income range
            log('Step 1: Income range -> ' + expectedIncomeRange);
            let incomeSelect = findNgSelectByAriaLabel('M/s') || 
                               findNgSelectByAriaLabel('Income') || 
                               findNgSelectByPlaceholder('m/s') ||
                               findNgSelectByPlaceholder('income');
            
            if (!incomeSelect) {
                const firstDesktopSelect = document.querySelector('.hidden.md\\:block ng-select');
                if (firstDesktopSelect) incomeSelect = firstDesktopSelect;
            }
            
            if (incomeSelect) {
                const selected = await selectNgOption(incomeSelect, expectedIncomeRange);
                verificationResults.incomeRange = selected;
                if (!selected) log('⚠️ Income range may not be selected correctly', 'warn');
                await new Promise(r => setTimeout(r, 300));
            }
            
            // 2. Mutations - None
            log('Step 2: Mutations -> None');
            const mutationSelect = findNgSelectByAriaLabel('Mutations') || findNgSelectByPlaceholder('mutation');
            if (mutationSelect) {
                const selected = await selectNgOption(mutationSelect, 'None');
                verificationResults.mutations = selected;
                if (!selected) log('⚠️ Mutations may not be selected correctly', 'warn');
                await new Promise(r => setTimeout(r, 300));
            }
            
            // 3. Item type - Brainrot
            log('Step 3: Item type -> Brainrot');
            const itemTypeSelect = findNgSelectByAriaLabel('Item type');
            if (itemTypeSelect) {
                const selected = await selectNgOption(itemTypeSelect, 'Brainrot');
                verificationResults.itemType = selected;
                if (!selected) log('⚠️ Item type may not be selected correctly', 'warn');
                await new Promise(r => setTimeout(r, 500));
            }
            
            // 4. Rarity
            log('Step 4: Rarity -> ' + expectedRarity);
            let raritySelect = null;
            for (let i = 0; i < 10; i++) {
                raritySelect = findNgSelectByAriaLabel('Rarity');
                if (raritySelect) break;
                await new Promise(r => setTimeout(r, 150));
            }
            if (raritySelect) {
                const selected = await selectNgOption(raritySelect, expectedRarity);
                verificationResults.rarity = selected;
                if (!selected) log('⚠️ Rarity may not be selected correctly', 'warn');
                await new Promise(r => setTimeout(r, 500));
            }
            
            // 5. Brainrot name
            log('Step 5: Brainrot -> ' + name);
            let brainrotSelect = null;
            for (let i = 0; i < 10; i++) {
                brainrotSelect = findNgSelectByAriaLabel('Brainrot');
                if (brainrotSelect) break;
                await new Promise(r => setTimeout(r, 150));
            }
            if (brainrotSelect) {
                let selected = await selectNgOption(brainrotSelect, name);
                if (!selected) {
                    log('Brainrot not found, selecting Other', 'warn');
                    selected = await selectNgOption(brainrotSelect, 'Other');
                }
                verificationResults.brainrot = selected;
                await new Promise(r => setTimeout(r, 300));
            }

            // 6. Title (с кодом оффера для поиска)
            log('Step 6: Title');
            const titleInput = document.querySelector('textarea[maxlength="160"]');
            if (titleInput) {
                setInputValue(titleInput, generateOfferTitle(name, income, offerId));
            }
            await new Promise(r => setTimeout(r, 150));

            // 7. Image
            log('Step 7: Image');
            if (generatedImageUrl) {
                await uploadImage(generatedImageUrl);
            }
            await new Promise(r => setTimeout(r, 250));

            // 8. Description
            log('Step 8: Description');
            const descInput = document.querySelector('textarea[maxlength="2000"]');
            if (descInput) {
                setInputValue(descInput, generateOfferDescription(offerId));
            }
            await new Promise(r => setTimeout(r, 150));

            // 9. Delivery time
            log('Step 9: Delivery time');
            let deliverySelect = document.querySelector('.delivery-group ng-select');
            if (!deliverySelect) {
                const deliveryLabel = [...document.querySelectorAll('span')].find(s => 
                    s.textContent?.toLowerCase().includes('delivery time')
                );
                if (deliveryLabel) {
                    deliverySelect = deliveryLabel.closest('div')?.querySelector('ng-select');
                }
            }
            if (deliverySelect) {
                const selected = await selectNgOption(deliverySelect, '20 min');
                verificationResults.deliveryTime = selected;
                if (!selected) log('⚠️ Delivery time may not be selected correctly', 'warn');
            }
            await new Promise(r => setTimeout(r, 150));

            // 10. Price
            log('Step 10: Price');
            const price = maxPrice || minPrice || 10;
            const priceInput = document.querySelector('input[formcontrolname="price"]') ||
                              document.querySelector('input[placeholder*="rice"]');
            if (priceInput) {
                setInputValue(priceInput, String(price));
            }
            await new Promise(r => setTimeout(r, 150));

            // 11. Total Quantity (from grouped brainrots)
            log(`Step 11: Total Quantity -> ${totalQuantity}`);
            await setTotalQuantity(totalQuantity);
            await new Promise(r => setTimeout(r, 150));

            // 12. Checkboxes
            log('Step 12: Checkboxes');
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (!cb.checked) {
                    const label = cb.closest('label') || cb.parentElement?.querySelector('label');
                    (label || cb).click();
                }
            });

            // 13. Final verification - re-check all dropdowns
            log('Step 13: Final verification');
            await new Promise(r => setTimeout(r, 500));
            
            let needsRecheck = false;
            
            // Re-check Income range
            if (incomeSelect && !isValueSelected(incomeSelect, expectedIncomeRange)) {
                log('⚠️ Income range lost, re-selecting...', 'warn');
                await selectNgOption(incomeSelect, expectedIncomeRange);
                needsRecheck = true;
            }
            
            // Re-check Mutations
            if (mutationSelect && !isValueSelected(mutationSelect, 'None')) {
                log('⚠️ Mutations lost, re-selecting...', 'warn');
                await selectNgOption(mutationSelect, 'None');
                needsRecheck = true;
            }
            
            // Re-check Item type
            if (itemTypeSelect && !isValueSelected(itemTypeSelect, 'Brainrot')) {
                log('⚠️ Item type lost, re-selecting...', 'warn');
                await selectNgOption(itemTypeSelect, 'Brainrot');
                needsRecheck = true;
            }
            
            // Re-check Rarity
            if (raritySelect && !isValueSelected(raritySelect, expectedRarity)) {
                log('⚠️ Rarity lost, re-selecting...', 'warn');
                await selectNgOption(raritySelect, expectedRarity);
                needsRecheck = true;
            }
            
            // Re-check Delivery time
            if (deliverySelect && !isValueSelected(deliverySelect, '20 min')) {
                log('⚠️ Delivery time lost, re-selecting...', 'warn');
                await selectNgOption(deliverySelect, '20 min');
                needsRecheck = true;
            }
            
            if (needsRecheck) {
                log('Some fields were re-selected', 'warn');
            } else {
                log('All fields verified ✓', 'success');
            }

            // 14. Setup auto-close and save offer
            log('Step 14: Setting up auto-close');
            setupAutoCloseAndSave(offerId);

            const statusMessage = needsRecheck 
                ? '⚠️ Проверьте поля перед отправкой!'
                : '✅ Готово! Проверьте и нажмите Place offer';
            
            updateStatus(statusMessage, needsRecheck ? 'working' : 'ready');
            showNotification(needsRecheck ? '⚠️ Проверьте поля!' : '✅ Форма заполнена!', needsRecheck ? 'warning' : 'success');

        } catch (e) {
            log('Error: ' + e.message, 'error');
            updateStatus('❌ Ошибка: ' + e.message, 'error');
            showNotification('Ошибка заполнения', 'error');
        }
    }

    function setupAutoCloseAndSave(offerId) {
        const findPlaceOfferButton = () => {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                const text = btn.textContent?.toLowerCase() || '';
                if (text.includes('place offer') || text.includes('place')) return btn;
            }
            return document.querySelector('button[type="submit"]');
        };

        const placeOfferBtn = findPlaceOfferButton();
        if (placeOfferBtn) {
            log('Found Place offer button');
            placeOfferBtn.addEventListener('click', async () => {
                log('Place offer clicked');
                updateStatus('🚀 Создаём оффер...', 'working');
                
                // Save offer to panel
                try {
                    const farmKey = CONFIG.farmKey || localStorage.getItem('glitched_farm_key');
                    if (farmKey && offerData) {
                        await fetch(`${API_BASE}/offers`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                farmKey, offerId,
                                brainrotName: offerData.name,
                                income: offerData.income,
                                currentPrice: offerData.maxPrice || offerData.minPrice || 0,
                                imageUrl: offerData.generatedImageUrl,
                                status: 'pending'
                            })
                        });
                        log(`Offer ${offerId} saved to panel`);
                    }
                } catch (e) { log('Failed to save offer: ' + e.message); }

                const isFromQueue = offerData?.fromQueue;
                if (isFromQueue && getQueueFromStorage()) {
                    markCurrentAsDone();
                    updateStatus('✅ Оффер создан!', 'ready');
                    showNotification(`Оффер #${offerId} создан!`, 'success');
                    
                    setTimeout(() => {
                        if (hasMoreInQueue()) {
                            const nextItem = getCurrentQueueItem();
                            updateStatus(`📋 Следующий: ${nextItem?.name}...`, 'working');
                            showNotification(`⏭️ Следующий: ${nextItem?.name}`, 'info');
                            setTimeout(() => processNextQueueItem(), 1000);
                        } else {
                            updateStatus('✅ Очередь завершена!', 'ready');
                            showNotification('🎉 Все офферы созданы!', 'success');
                            clearQueue();
                        }
                    }, 2000);
                } else {
                    updateStatus('✅ Оффер создан!', 'ready');
                    showNotification(`Оффер #${offerId} создан!`, 'success');
                    setTimeout(() => window.close(), 3000);
                }
            });
        }
    }

    function createOfferPanel() {
        const existing = document.querySelector('.glitched-mini');
        if (existing) existing.remove();
        if (!offerData) return;

        const price = offerData.maxPrice || offerData.minPrice || 0;
        const qty = offerData.quantity || 1;
        const isFromQueue = offerData?.fromQueue;
        const queueIndex = offerData?.queueIndex || 0;
        const queueTotal = offerData?.queueTotal || 0;

        let queueHtml = '';
        if (isFromQueue && queueState.queue.length > 0) {
            const queueItems = queueState.queue.map((item, idx) => {
                let icon = '⏳', className = '';
                if (idx < queueState.currentIndex) { icon = '✅'; className = 'done'; }
                else if (idx === queueState.currentIndex) { icon = '▶️'; className = 'current'; }
                return `<div class="queue-item ${className}"><span class="q-icon">${icon}</span><span class="q-name">${item.name}</span></div>`;
            }).join('');
            queueHtml = `<div class="queue-info"><div class="queue-progress">📋 ${queueIndex + 1} / ${queueTotal}</div><div>Очередь Eldorado</div></div><div class="queue-list">${queueItems}</div>`;
        }

        const panel = document.createElement('div');
        panel.className = 'glitched-mini';
        panel.innerHTML = `
            <div class="header">
                <div class="title">👾 Glitched Store${isFromQueue ? ' - Queue' : ''}</div>
                <span class="close" id="g-close">✕</span>
            </div>
            ${queueHtml}
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
            <div class="status" id="g-status">⏳ Авто-заполнение через 2 сек...</div>
        `;
        document.body.appendChild(panel);
        statusEl = document.getElementById('g-status');
        document.getElementById('g-close').onclick = () => {
            panel.remove();
            if (isFromQueue && confirm('Остановить обработку очереди?')) clearQueue();
        };
    }

    // ==================== КОРРЕКТИРОВКА ЦЕН ====================
    function findOfferCardByOfferId(offerId) {
        const cards = document.querySelectorAll('eld-offer-item, .offer-card, [class*="offer-item"]');
        for (const card of cards) {
            const title = card.querySelector('.offer-title')?.textContent || '';
            if (title.includes(`#${offerId}`) || title.includes(offerId)) return card;
            const text = card.textContent || '';
            if (text.includes(`#${offerId}`)) return card;
        }
        return null;
    }

    function findMatchingOfferCards(brainrotName, currentPrice) {
        const cards = [];
        const allCards = document.querySelectorAll('.offer-card, [class*="offer-item"], .offers-list > div');
        for (const card of allCards) {
            const text = card.textContent || '';
            if (text.toLowerCase().includes(brainrotName.toLowerCase()) && 
                (text.includes(`$${currentPrice}`) || text.includes(currentPrice.toString()))) {
                cards.push(card);
            }
        }
        return cards;
    }

    async function changeOfferPrice(card, newPrice) {
        try {
            const priceForm = card.querySelector('.offer-price-input, form.offer-price-input');
            if (!priceForm) return false;
            const priceInput = priceForm.querySelector('eld-numeric-input input.input') ||
                              priceForm.querySelector('input[inputmode="decimal"]') ||
                              priceForm.querySelector('input.input');
            if (!priceInput) return false;
            
            priceInput.focus();
            await new Promise(r => setTimeout(r, 100));
            priceInput.value = '';
            priceInput.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 50));
            
            for (const char of String(newPrice)) {
                priceInput.value += char;
                priceInput.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(r => setTimeout(r, 30));
            }
            priceInput.dispatchEvent(new Event('change', { bubbles: true }));
            priceInput.dispatchEvent(new Event('blur', { bubbles: true }));
            await new Promise(r => setTimeout(r, 300));
            
            const checkButton = priceForm.querySelector('.check-button') ||
                               priceForm.querySelector('[aria-label="Confirm price"]') ||
                               priceForm.querySelector('[role="button"].control');
            if (!checkButton) return false;
            
            let attempts = 0;
            while (checkButton.classList.contains('disabled') && attempts < 20) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }
            checkButton.click();
            await new Promise(r => setTimeout(r, 500));
            log(`Price changed to ${newPrice}`, 'success');
            return true;
        } catch (e) {
            log(`Error changing price: ${e.message}`, 'error');
            return false;
        }
    }

    async function updatePriceInPanel(offerId, newPrice) {
        try {
            const farmKey = CONFIG.farmKey || localStorage.getItem('glitched_farm_key');
            if (!farmKey) return false;
            const response = await fetch(`${API_BASE}/offers`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ farmKey, offerId, currentPrice: newPrice, status: 'active' })
            });
            return response.ok;
        } catch (e) { return false; }
    }

    async function goToNextPage() {
        const pagination = document.querySelector('eld-pagination, .pagination');
        if (!pagination) return false;
        const nextBtn = pagination.querySelector('.pagination-arrow, [class*="sign-right"]');
        if (nextBtn) { nextBtn.click(); await new Promise(r => setTimeout(r, 1500)); return true; }
        const currentPage = pagination.querySelector('.active-page, .pagination-item.active');
        if (currentPage?.nextElementSibling?.classList.contains('pagination-item')) {
            currentPage.nextElementSibling.click();
            await new Promise(r => setTimeout(r, 1500));
            return true;
        }
        return false;
    }

    async function adjustPrices() {
        if (!adjustmentData?.offers?.length) return;
        updateStatus('🔄 Корректируем цены...', 'working');
        log(`Starting price adjustment for ${adjustmentData.offers.length} offers`);

        const results = [];
        let currentPage = 1;
        const maxPages = 10;

        for (const offer of adjustmentData.offers) {
            let found = false;
            for (let page = currentPage; page <= maxPages && !found; page++) {
                updateStatus(`🔍 Ищем оффер ${offer.offerId} (стр. ${page})...`, 'working');
                await new Promise(r => setTimeout(r, 500));
                
                let card = findOfferCardByOfferId(offer.offerId);
                if (!card) {
                    const matchingCards = findMatchingOfferCards(offer.brainrotName, offer.currentPrice);
                    if (matchingCards.length > 0) card = matchingCards[0];
                }
                
                if (card) {
                    const success = await changeOfferPrice(card, offer.newPrice);
                    if (success) await updatePriceInPanel(offer.offerId, offer.newPrice);
                    results.push({ offerId: offer.offerId, success, newPrice: offer.newPrice });
                    found = true;
                    currentPage = page;
                } else {
                    const hasNext = await goToNextPage();
                    if (!hasNext) {
                        results.push({ offerId: offer.offerId, success: false, error: 'Not found' });
                        break;
                    }
                    currentPage = page + 1;
                }
            }
            if (!found) results.push({ offerId: offer.offerId, success: false, error: 'Not found' });
        }

        localStorage.setItem('glitched_price_result', JSON.stringify({
            success: true, adjusted: results.filter(r => r.success),
            failed: results.filter(r => !r.success), timestamp: Date.now()
        }));
        localStorage.removeItem('glitched_price_adjustment');

        const successCount = results.filter(r => r.success).length;
        updateStatus(`✅ Готово! ${successCount}/${results.length} цен изменено`, 'ready');
        showNotification(`Изменено ${successCount} из ${results.length} цен`, successCount === results.length ? 'success' : 'warning');
        
        setTimeout(() => adjustmentData.returnUrl ? (window.location.href = adjustmentData.returnUrl) : window.close(), 2000);
    }

    function createAdjustmentPanel() {
        const existing = document.querySelector('.glitched-mini');
        if (existing) existing.remove();
        if (!adjustmentData?.offers) return;

        const panel = document.createElement('div');
        panel.className = 'glitched-mini';
        panel.innerHTML = `
            <div class="header">
                <div class="title">👾 Price Adjustment</div>
                <span class="close" id="g-close">✕</span>
            </div>
            <div class="status" id="g-status">⏳ Начинаем корректировку...</div>
            <div class="progress-list" id="g-progress">
                ${adjustmentData.offers.map(o => `
                    <div class="progress-item" data-offer-id="${o.offerId}">
                        <span class="icon">⏳</span>
                        <span class="name">${o.brainrotName || o.offerId}</span>
                        <span class="price">→ $${o.newPrice}</span>
                    </div>
                `).join('')}
            </div>
        `;
        document.body.appendChild(panel);
        statusEl = document.getElementById('g-status');
        document.getElementById('g-close').onclick = () => panel.remove();
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
        
        const isDashboard = window.location.pathname.includes('/dashboard/offers');
        const isCreatePage = window.location.pathname.includes('/sell/create') || window.location.pathname.includes('/sell/offer');
        
        // Загружаем состояние очереди
        getQueueFromStorage();
        
        // Сохраняем farm key для последующего использования
        if (CONFIG.farmKey) {
            localStorage.setItem('glitched_farm_key', CONFIG.farmKey);
        }
        
        // Режим корректировки цен на dashboard
        if (isDashboard) {
            adjustmentData = getAdjustmentDataFromURL();
            if (adjustmentData) {
                log(`Price adjustment mode: ${adjustmentData.offers?.length || 0} offers`);
                await new Promise(r => setTimeout(r, 2000));
                createAdjustmentPanel();
                await new Promise(r => setTimeout(r, 1000));
                await adjustPrices();
                return;
            }
        }
        
        if (isCreatePage) {
            // Режим создания оффера
            offerData = getOfferDataFromURL();
            
            // Если есть данные с fullQueue - синхронизируем localStorage (cross-domain)
            if (offerData?.fullQueue && Array.isArray(offerData.fullQueue)) {
                log(`Syncing queue from URL: ${offerData.fullQueue.length} items`);
                localStorage.setItem('eldoradoQueue', JSON.stringify(offerData.fullQueue));
                localStorage.setItem('eldoradoQueueIndex', '0');
                localStorage.setItem('eldoradoQueueCompleted', '[]');
                localStorage.setItem('eldoradoQueueTimestamp', Date.now().toString());
                // Reload queue state
                getQueueFromStorage();
            }
            
            // Если нет данных в URL, но есть очередь - продолжаем обработку
            if (!offerData && queueState.queue.length > 0 && hasMoreInQueue()) {
                const timestamp = localStorage.getItem('eldoradoQueueTimestamp');
                const age = timestamp ? Date.now() - parseInt(timestamp, 10) : Infinity;
                if (age < 3600000) { // 1 час
                    showNotification(`📋 Продолжаем очередь: ${queueState.currentIndex + 1}/${queueState.queue.length}`, 'info');
                    await new Promise(r => setTimeout(r, 1500));
                    processNextQueueItem();
                    return;
                } else {
                    clearQueue();
                }
            }
            
            if (offerData) {
                log('Offer creation mode' + (offerData.fromQueue ? ` (queue ${offerData.queueIndex + 1}/${offerData.queueTotal})` : ''));
                if (offerData.farmKey) localStorage.setItem('glitched_farm_key', offerData.farmKey);
                if (offerData.fromQueue) queueState.currentIndex = offerData.queueIndex || 0;
                
                // Очищаем URL
                const url = new URL(window.location.href);
                url.searchParams.delete('glitched_data');
                window.history.replaceState({}, '', url.toString());
                
                await new Promise(r => setTimeout(r, 1500));
                createOfferPanel();
                await new Promise(r => setTimeout(r, 1000));
                await fillOfferForm();
                return; // Не показываем обычную панель
            }
        }
        
        // Обычный режим - подсветка и панель
        if (CONFIG.farmKey) {
            showMiniButton();
            loadUserOffers();
        } else {
            setTimeout(showAuthPanel, 500);
        }
        
        setupMutationObserver();
    }
    
    // Запуск - быстрая инициализация
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
    } else {
        setTimeout(init, 100);
    }
})();
