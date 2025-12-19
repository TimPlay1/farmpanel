// ==UserScript==
// @name         Glitched Store - Eldorado Helper
// @namespace    http://tampermonkey.net/
// @version      9.8.20
// @description  Auto-fill Eldorado.gg offer form + highlight YOUR offers by unique code + price adjustment from Farmer Panel + Queue support + Sleep Mode + Auto-scroll
// @author       Glitched Store
// @match        https://www.eldorado.gg/*
// @match        https://eldorado.gg/*
// @match        https://*.talkjs.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        window.close
// @connect      farmpanel.vercel.app
// @connect      api.supa.ru
// @connect      storage.supa.ru
// @connect      supa-temp.storage.yandexcloud.net
// @connect      raw.githubusercontent.com
// @connect      localhost
// @connect      *
// @updateURL    https://raw.githubusercontent.com/TimPlay1/farmpanel/main/scripts/eldorado-helper.user.js?v=9.8.16
// @downloadURL  https://raw.githubusercontent.com/TimPlay1/farmpanel/main/scripts/eldorado-helper.user.js?v=9.8.16
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const VERSION = '9.8.16';
    const API_BASE = 'https://farmpanel.vercel.app/api';
    
    // ==================== TALKJS IFRAME HANDLER ====================
    // If running inside TalkJS iframe, handle messages from parent
    const isInsideTalkJSIframe = window.location.hostname.includes('talkjs.com');
    
    if (isInsideTalkJSIframe) {
        console.log('[Glitched] Running inside TalkJS iframe');
        
        // Listen for messages from parent window
        window.addEventListener('message', async (event) => {
            // Only accept messages from Eldorado
            if (!event.origin.includes('eldorado.gg')) return;
            
            const data = event.data;
            if (!data || data.source !== 'glitched-quick-chat') return;
            
            console.log('[Glitched TalkJS] Received message:', data.action);
            
            if (data.action === 'sendMessage') {
                const result = await sendMessageInIframe(data.message);
                event.source.postMessage({
                    source: 'glitched-talkjs',
                    action: 'messageSent',
                    success: result
                }, event.origin);
            } else if (data.action === 'attachImage') {
                const result = await attachImageInIframe(data.imageUrl);
                event.source.postMessage({
                    source: 'glitched-talkjs',
                    action: 'imageAttached',
                    success: result
                }, event.origin);
            }
        });
        
        /**
         * Send message inside TalkJS iframe
         */
        async function sendMessageInIframe(message) {
            const chatInput = document.querySelector('.ProseMirror[contenteditable="true"], .test__entry-field, div[contenteditable="true"][role="textbox"]');
            if (!chatInput) {
                console.error('[Glitched TalkJS] Chat input not found');
                return false;
            }
            
            chatInput.focus();
            chatInput.innerHTML = `<p>${message.replace(/\n/g, '</p><p>')}</p>`;
            chatInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: message }));
            
            await new Promise(r => setTimeout(r, 300));
            
            const sendBtn = document.querySelector('.test__send-button, .MessageField__send-button, button[aria-label="Send"]');
            if (sendBtn) {
                sendBtn.click();
                console.log('[Glitched TalkJS] Message sent');
                return true;
            }
            
            console.error('[Glitched TalkJS] Send button not found');
            return false;
        }
        
        /**
         * Attach image inside TalkJS iframe
         */
        async function attachImageInIframe(imageUrl) {
            const fileInput = document.querySelector('.test__fileupload-input, input[type="file"]');
            if (!fileInput) {
                console.error('[Glitched TalkJS] File input not found');
                return false;
            }
            
            try {
                const response = await fetch(imageUrl);
                if (!response.ok) {
                    console.error('[Glitched TalkJS] Failed to fetch image:', response.status, response.statusText);
                    return false;
                }
                
                const blob = await response.blob();
                if (blob.size < 100) {
                    console.error('[Glitched TalkJS] Image blob too small:', blob.size);
                    return false;
                }
                
                const file = new File([blob], 'enddelivery.jpg', { type: 'image/jpeg' });
                console.log('[Glitched TalkJS] Created file:', file.name, file.size, 'bytes');
                
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                
                console.log('[Glitched TalkJS] Image attached, waiting for confirm button...');
                
                // Wait for confirm button
                const confirmClicked = await waitForConfirmButton();
                return confirmClicked;
            } catch (e) {
                console.error('[Glitched TalkJS] Failed to attach image:', e);
                return false;
            }
        }
        
        /**
         * Wait for image upload to complete (loading indicator disappears or image preview is ready)
         */
        async function waitForImageUpload(timeout = 15000) {
            const startTime = Date.now();
            console.log('[Glitched TalkJS] Waiting for image to upload to server...');
            
            // First, wait a bit for the upload to start
            await new Promise(r => setTimeout(r, 500));
            
            while (Date.now() - startTime < timeout) {
                // Check for actual loading indicators (NOT buttons!)
                // Look for progress bars, spinners, etc.
                const loadingIndicators = document.querySelectorAll('.loading, .uploading, .spinner, .progress, [class*="loading"], [class*="progress"]');
                
                let isLoading = false;
                for (const loader of loadingIndicators) {
                    // Skip if it's a button - buttons are not loading indicators!
                    if (loader.tagName === 'BUTTON') continue;
                    
                    if (loader.offsetParent !== null) {
                        console.log('[Glitched TalkJS] Upload in progress...', loader.className);
                        isLoading = true;
                        break;
                    }
                }
                
                // Check if preview image is fully loaded (has src and naturalWidth > 0)
                const previewImg = document.querySelector('.preview img, .image-preview img, [class*="preview"] img');
                if (previewImg && previewImg.complete && previewImg.naturalWidth > 0) {
                    console.log('[Glitched TalkJS] Image preview loaded:', previewImg.naturalWidth, 'x', previewImg.naturalHeight);
                    if (!isLoading) {
                        // Image loaded and no loading indicator - ready!
                        return true;
                    }
                }
                
                // If no loading indicator and we've waited at least 1 second, assume ready
                if (!isLoading && (Date.now() - startTime) > 1000) {
                    console.log('[Glitched TalkJS] No loading indicator detected, upload complete');
                    return true;
                }
                
                await new Promise(r => setTimeout(r, 200));
            }
            
            console.log('[Glitched TalkJS] Upload wait timeout, proceeding anyway');
            return true; // Proceed anyway after timeout
        }
        
        /**
         * Wait for confirm button in image preview
         */
        async function waitForConfirmButton(timeout = 15000) {
            const startTime = Date.now();
            console.log('[Glitched TalkJS] Looking for Send button...');
            
            while (Date.now() - startTime < timeout) {
                // Find all buttons and look specifically for one with "Send" text
                const allButtons = document.querySelectorAll('button');
                
                for (const btn of allButtons) {
                    const btnText = btn.textContent.trim().toLowerCase();
                    const isVisible = btn.offsetParent !== null;
                    
                    // Must be visible and have "send" text (not cancel, not close)
                    if (isVisible && btnText === 'send' && !btn.classList.contains('cancel')) {
                        console.log('[Glitched TalkJS] Found Send button:', btn.className, 'text:', btn.textContent);
                        
                        // IMPORTANT: Wait for image to upload BEFORE clicking confirm
                        await waitForImageUpload();
                        
                        await new Promise(r => setTimeout(r, 500)); // Extra safety delay
                        btn.click();
                        console.log('[Glitched TalkJS] Send button clicked after upload complete');
                        return true;
                    }
                }
                
                // Also try specific selectors as fallback
                const confirmBtn = document.querySelector('button.confirm-send.test__confirm-upload-button');
                if (confirmBtn && confirmBtn.offsetParent !== null && confirmBtn.textContent.trim().toLowerCase() === 'send') {
                    console.log('[Glitched TalkJS] Found confirm-send button');
                    
                    await waitForImageUpload();
                    await new Promise(r => setTimeout(r, 500));
                    confirmBtn.click();
                    console.log('[Glitched TalkJS] Confirm-send button clicked');
                    return true;
                }
                
                await new Promise(r => setTimeout(r, 300));
            }
            
            console.error('[Glitched TalkJS] Timeout waiting for Send button');
            return false;
        }
        
        // Don't run the rest of the script in iframe
        return;
    }
    
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
        .glitched-notification.deleted { 
            background: linear-gradient(135deg, #374151 0%, #4b5563 100%);
            color: #e5e7eb;
        }
        @keyframes glitched-slide-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        /* Sleep Mode Button */
        .glitched-sleep-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s;
            margin-left: 8px;
            white-space: nowrap;
            flex-shrink: 0;
            min-width: 90px;
            justify-content: center;
        }
        .glitched-sleep-btn.active {
            background: rgba(251, 146, 60, 0.2);
            color: #fb923c;
            border: 1px solid #fb923c;
        }
        .glitched-sleep-btn.inactive {
            background: rgba(74, 222, 128, 0.2);
            color: #4ade80;
            border: 1px solid #4ade80;
        }
        .glitched-sleep-btn.unknown {
            background: rgba(156, 163, 175, 0.2);
            color: #9ca3af;
            border: 1px solid #9ca3af;
        }
        .glitched-sleep-btn:hover {
            transform: scale(1.05);
        }
        
        /* v9.8.20: Clean Closed Button */
        .glitched-clean-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s;
            margin-left: 8px;
            white-space: nowrap;
            flex-shrink: 0;
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
            border: 1px solid #ef4444;
        }
        .glitched-clean-btn:hover {
            transform: scale(1.05);
            background: rgba(239, 68, 68, 0.3);
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
        
        /* ============ QUICK CHAT PANEL FOR ORDER PAGE ============ */
        .glitched-quick-chat {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 16px;
            padding: 16px;
            z-index: 999999;
            box-shadow: 0 15px 40px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', sans-serif;
            color: white;
            min-width: 320px;
            border: 1px solid #333;
        }
        .glitched-quick-chat .qc-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #333;
        }
        .glitched-quick-chat .qc-title {
            font-size: 14px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .glitched-quick-chat .qc-close {
            cursor: pointer;
            opacity: 0.6;
            font-size: 18px;
            transition: opacity 0.2s;
        }
        .glitched-quick-chat .qc-close:hover { opacity: 1; }
        .glitched-quick-chat .qc-buttons {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .glitched-quick-chat .qc-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 14px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s;
            border: none;
            text-align: left;
        }
        .glitched-quick-chat .qc-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .glitched-quick-chat .qc-btn.welcome {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .glitched-quick-chat .qc-btn.sorry {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
        }
        .glitched-quick-chat .qc-btn.friend {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
        }
        .glitched-quick-chat .qc-btn.wait {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            color: #333;
        }
        .glitched-quick-chat .qc-btn.end-delivery {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            color: white;
            font-size: 14px;
            padding: 14px 16px;
        }
        .glitched-quick-chat .qc-btn .qc-icon {
            font-size: 18px;
            min-width: 24px;
            text-align: center;
        }
        .glitched-quick-chat .qc-btn .qc-label {
            flex: 1;
        }
        .glitched-quick-chat .qc-btn.sent {
            opacity: 0.5;
            pointer-events: none;
        }
        .glitched-quick-chat .qc-btn.sent::after {
            content: ' ✓';
            color: #38ef7d;
        }
        .glitched-quick-chat .qc-divider {
            height: 1px;
            background: #333;
            margin: 8px 0;
        }
        .glitched-quick-chat .qc-status {
            font-size: 11px;
            color: #888;
            text-align: center;
            margin-top: 8px;
        }
        .glitched-quick-chat .qc-status.delivered {
            color: #38ef7d;
            background: rgba(56, 239, 125, 0.1);
            padding: 8px;
            border-radius: 8px;
        }
    `);
    
    // ==================== QUICK CHAT MESSAGES ====================
    const QUICK_MESSAGES = {
        welcome: "Welcome to 👾Glitched Store👾!\nPlease give us a couple of minutes to get your brainrot from our stock!",
        sorry: "Our store sincerely apologizes for any inconvenience caused!",
        friend: "I sent you a friend request on Roblox. Please check your Connections and approve my request. It's the first one on the list.",
        wait: "We apologize! Please wait a few more minutes, we are rushing to get your order ready!",
        endDelivery: "Thank you❤️! Pls make review for fast deliver!) Have a good day and dont forget to mark order as \"Received\"!🔥   👾GLITCHED STORE👾",
        endDeliveryImage: "https://cdn.jsdelivr.net/gh/TimPlay1/farmpanel@main/public/enddelivery.jpg"
    };
    
    // ==================== УТИЛИТЫ ====================
    // v9.7.7: Minimal logging - only important events
    const DEBUG_MODE = false; // Set to true for verbose logging
    
    function log(...args) {
        if (DEBUG_MODE) {
            console.log('[Glitched]', ...args);
        }
    }
    
    // Important logs that always show
    function logInfo(...args) {
        console.log('[Glitched]', ...args);
    }
    
    function logError(...args) {
        console.error('[Glitched]', ...args);
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
    
    // ==================== SLEEP MODE ====================
    
    // v9.7: Extract offer code from element text (h5 title contains #GSXXXXXX)
    function extractOfferCodeFromElement(item) {
        // Look for h5 title which contains the code
        const h5 = item.querySelector('h5');
        if (h5) {
            const match = h5.textContent?.match(/#?GS[A-Z0-9]{5,8}/i);
            if (match) {
                return match[0].toUpperCase().replace(/^#/, '');
            }
        }
        // v9.8.2: Check tooltip (eld-tooltip) for sold orders page
        const tooltip = item.querySelector('eld-tooltip .tooltip-inner');
        if (tooltip) {
            const match = tooltip.textContent?.match(/#?GS[A-Z0-9]{5,8}/i);
            if (match) {
                return match[0].toUpperCase().replace(/^#/, '');
            }
        }
        // Fallback: search entire text
        const match = item.textContent?.match(/#?GS[A-Z0-9]{5,8}/i);
        if (match) {
            return match[0].toUpperCase().replace(/^#/, '');
        }
        return null;
    }
    
    // v9.7: Check if element contains OUR offer code (from userOfferCodes)
    function isOurOffer(item) {
        const code = extractOfferCodeFromElement(item);
        if (!code) return false;
        return userOfferCodes.has(code) || userOfferCodes.has('#' + code);
    }
    
    // v9.7.4: Find offer element by code - needed because Angular recreates DOM
    function findOfferElementByCode(offerCode) {
        const items = document.querySelectorAll('eld-dashboard-offers-list-item');
        for (const item of items) {
            const code = extractOfferCodeFromElement(item);
            if (code === offerCode) return item;
        }
        return null;
    }
    
    // v9.7.4: Reliable click for Angular - uses multiple methods
    function reliableClick(element) {
        if (!element) return false;
        
        // Method 1: Focus and click
        try {
            element.focus();
            element.click();
        } catch(e) {}
        
        // Method 2: Dispatch mouse events (without view property for Tampermonkey compatibility)
        try {
            const events = ['mousedown', 'mouseup', 'click'];
            events.forEach(eventType => {
                const event = new MouseEvent(eventType, {
                    bubbles: true,
                    cancelable: true,
                    button: 0
                });
                element.dispatchEvent(event);
            });
        } catch(e) {
            log('reliableClick fallback used');
        }
        
        return true;
    }
    
    // Detect current sleep state from offers - v9.7: ONLY checks OUR offers!
    function detectSleepState() {
        // v9.7: CRITICAL FIX - only count offers with codes in userOfferCodes
        // Even on My Offers page, user may have multiple farmKeys or non-tracked offers
        
        let offerItems = document.querySelectorAll('eld-dashboard-offers-list-item');
        if (offerItems.length === 0) {
            offerItems = document.querySelectorAll('.offer-list-item');
        }
        if (offerItems.length === 0) {
            offerItems = document.querySelectorAll('.grid-row');
        }
        
        let pausedCount = 0;
        let activeCount = 0;
        let totalOffersCount = 0;
        let ourOfferCodes = []; // Track which offers we found
        
        log(`detectSleepState: Found ${offerItems.length} items on page, userOfferCodes has ${userOfferCodes.size} codes`);
        
        for (const item of offerItems) {
            // v9.7: ALWAYS check if this is OUR offer by code - not just on non-dashboard pages
            const code = extractOfferCodeFromElement(item);
            
            if (!code) {
                continue; // No code found, skip
            }
            
            // Check if this code belongs to us
            if (!userOfferCodes.has(code) && !userOfferCodes.has('#' + code)) {
                continue; // Not our offer, skip
            }
            
            totalOffersCount++;
            ourOfferCodes.push(code);
            
            // v9.7: Check status via multiple methods:
            // 1. Icon: .icon-pause = active (can pause), .icon-chevron-right = paused (can resume)
            // 2. Chip: aria-label="Active" or aria-label="Paused"
            const pauseIcon = item.querySelector('.icon-pause');
            const resumeIcon = item.querySelector('.icon-chevron-right') || item.querySelector('.icon-play');
            const activeChip = item.querySelector('[aria-label="Active"]');
            const pausedChip = item.querySelector('[aria-label="Paused"]');
            
            if (pauseIcon || activeChip) {
                activeCount++;
            } else if (resumeIcon || pausedChip) {
                pausedCount++;
            }
        }
        
        log(`Sleep state: Found ${totalOffersCount} OUR offers (${activeCount} active, ${pausedCount} paused)`);
        log(`Our codes on page: [${ourOfferCodes.join(', ')}]`);
        
        if (totalOffersCount === 0) return 'unknown';
        if (pausedCount === totalOffersCount) return 'sleep';
        if (activeCount === totalOffersCount) return 'active';
        return 'mixed'; // Mixed state - some active, some paused
    }
    
    // v9.7: Auto-scroll down to load all offers (lazy loading)
    async function scrollToLoadAllOffers() {
        const container = document.querySelector('.offer-list-wrapper') || 
                          document.querySelector('eld-dashboard-offers-list') ||
                          document.querySelector('.dashboard-content') ||
                          document.documentElement;
        
        if (!container) return;
        
        let lastOfferCount = 0;
        let sameCountTimes = 0;
        const maxScrollAttempts = 20;
        
        for (let i = 0; i < maxScrollAttempts; i++) {
            // Scroll down
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            await new Promise(r => setTimeout(r, 500));
            
            // Check if more offers loaded
            const currentCount = document.querySelectorAll('eld-dashboard-offers-list-item').length;
            
            if (currentCount === lastOfferCount) {
                sameCountTimes++;
                if (sameCountTimes >= 3) {
                    log(`Scroll complete: ${currentCount} offers loaded after ${i + 1} scrolls`);
                    break;
                }
            } else {
                sameCountTimes = 0;
                lastOfferCount = currentCount;
            }
        }
        
        // Scroll back to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await new Promise(r => setTimeout(r, 300));
    }
    
    // v9.7: Navigate to next page of offers
    async function goToNextPage() {
        // Look for pagination next arrow
        const nextArrow = document.querySelector('.pagination-arrow:last-child div') ||
                          document.querySelector('.pagination-arrow:not(.disable) .icon-sign-right')?.closest('div') ||
                          document.querySelector('[aria-label="Next page"]');
        
        if (nextArrow && !nextArrow.closest('.disable')) {
            nextArrow.click();
            await new Promise(r => setTimeout(r, 1500)); // Wait for page load
            return true;
        }
        return false;
    }
    
    // v9.7: Get current page number
    function getCurrentPageNumber() {
        const activePage = document.querySelector('.pagination .active-page');
        if (activePage) {
            return parseInt(activePage.textContent?.trim(), 10) || 1;
        }
        return 1;
    }
    
    // v9.7: Get total pages
    function getTotalPages() {
        const pagination = document.querySelector('.pagination[actpage]');
        if (pagination) {
            const pages = pagination.querySelectorAll('.pagination-item:not(.pagination-arrow)');
            let maxPage = 1;
            pages.forEach(p => {
                const num = parseInt(p.textContent?.trim(), 10);
                if (!isNaN(num) && num > maxPage) maxPage = num;
            });
            return maxPage;
        }
        return 1;
    }
    
    // v9.7: Load all offers on current page (scroll) and across all pages
    async function loadAllOffersOnPage() {
        log('Loading all offers on page...');
        
        // First scroll to load lazy-loaded offers on current page
        await scrollToLoadAllOffers();
        
        // Check how many of our offers are on this page vs total in userOfferCodes
        const currentCount = countOurOffersOnPage();
        const expectedCount = userOfferCodes.size;
        
        log(`Found ${currentCount} of ${expectedCount} offers on current page`);
        
        // If we have pagination and haven't found all offers, navigate pages
        const totalPages = getTotalPages();
        if (totalPages > 1 && currentCount < expectedCount) {
            log(`Multiple pages detected (${totalPages}), checking for missing offers...`);
            
            // Track which offer codes we've processed
            const foundCodes = new Set();
            collectFoundCodesOnPage(foundCodes);
            
            // Find missing codes
            const missingCodes = [...userOfferCodes].filter(c => {
                const code = c.replace(/^#/, '');
                return !foundCodes.has(code) && !foundCodes.has('#' + code);
            });
            
            if (missingCodes.length > 0) {
                log(`Missing ${missingCodes.length} offers: [${missingCodes.slice(0, 5).join(', ')}...]`);
                // Note: For now we don't auto-navigate pages as it's complex
                // User should manually ensure all pages are checked if needed
                showNotification(`⚠️ ${missingCodes.length} offers may be on other pages`, 'warning');
            }
        }
    }
    
    // v9.8.20: Check if offer has Closed status (can't be paused/resumed)
    function isOfferClosed(item) {
        // Look for chip with "Closed" aria-label or text
        const closedChip = item.querySelector('.chip-status-red[aria-label="Closed"], [data-testid*="Closed"]');
        if (closedChip) return true;
        
        // Fallback: check for chip with "Closed" text
        const chips = item.querySelectorAll('.chip-status-red span');
        for (const chip of chips) {
            if (chip.textContent?.trim().toLowerCase() === 'closed') return true;
        }
        
        return false;
    }
    
    // v9.7: Count our offers currently visible on page
    function countOurOffersOnPage() {
        let count = 0;
        const items = document.querySelectorAll('eld-dashboard-offers-list-item');
        items.forEach(item => {
            if (isOurOffer(item)) count++;
        });
        return count;
    }
    
    // v9.7: Collect found offer codes from current page
    function collectFoundCodesOnPage(foundSet) {
        const items = document.querySelectorAll('eld-dashboard-offers-list-item');
        items.forEach(item => {
            const code = extractOfferCodeFromElement(item);
            if (code) {
                foundSet.add(code);
                foundSet.add('#' + code);
            }
        });
    }
    
    // Update sleep button based on actual state
    function updateSleepButton() {
        const sleepBtn = document.querySelector('.glitched-sleep-btn');
        if (!sleepBtn) return;
        
        const state = detectSleepState();
        
        sleepBtn.className = 'glitched-sleep-btn';
        
        if (state === 'sleep') {
            sleepBtn.classList.add('active');
            sleepBtn.innerHTML = '💤 Sleep';
            sleepBtn.title = 'All offers paused. Click to resume.';
        } else if (state === 'active') {
            sleepBtn.classList.add('inactive');
            sleepBtn.innerHTML = '⚡ Active';
            sleepBtn.title = 'All offers active. Click to pause.';
        } else if (state === 'mixed') {
            sleepBtn.classList.add('unknown');
            sleepBtn.innerHTML = '⚡/💤 Mixed';
            sleepBtn.title = 'Some offers active, some paused. Click to sync all.';
        } else {
            sleepBtn.classList.add('unknown');
            sleepBtn.innerHTML = '❓ Unknown';
            sleepBtn.title = 'Could not detect offer status. Make sure your offers are visible.';
        }
    }
    
    // v9.7.2: Flag to prevent concurrent toggle operations
    let isTogglingOffers = false;
    
    async function toggleSleepMode() {
        // Prevent concurrent toggles
        if (isTogglingOffers) {
            log('Toggle already in progress, ignoring');
            showNotification('⏳ Please wait, operation in progress...', 'warning');
            return;
        }
        
        const currentState = detectSleepState();
        const willPause = currentState !== 'sleep'; // If not sleeping, we'll pause
        
        // Show confirmation dialog
        const confirmMessage = willPause 
            ? '💤 Activate Sleep Mode?\n\nThis will PAUSE all your offers on Eldorado.\nBuyers won\'t see your offers until you resume.'
            : '⚡ Resume all offers?\n\nThis will ACTIVATE all your paused offers.\nBuyers will see your offers again.';
        
        if (!confirm(confirmMessage)) {
            log('Sleep mode toggle cancelled by user');
            return;
        }
        
        isTogglingOffers = true;
        
        // v9.7.2: Save a COPY of userOfferCodes to prevent race conditions
        const ourCodes = new Set([...userOfferCodes]);
        log(`Saved ${ourCodes.size} offer codes for toggle operation`);
        
        // Helper to check if item is ours using saved codes
        const isOurOfferSaved = (item) => {
            const code = extractOfferCodeFromElement(item);
            if (!code) return false;
            return ourCodes.has(code) || ourCodes.has('#' + code);
        };
        
        try {
            showNotification(willPause ? '💤 Pausing all offers...' : '⚡ Resuming all offers...', 'info');
            logInfo(`Sleep mode: ${willPause ? 'PAUSING' : 'RESUMING'} offers`);
            
            let totalProcessed = 0;
            let totalSkipped = 0;
            let totalFailed = 0;
            
            // v9.7.2: Process all pages
            const totalPages = getTotalPages();
            log(`Total pages to process: ${totalPages}`);
            
            for (let page = 1; page <= totalPages; page++) {
                // Navigate to page if not first
                if (page > 1) {
                    log(`Navigating to page ${page}...`);
                    const navigated = await goToPage(page);
                    if (!navigated) {
                        log(`Failed to navigate to page ${page}, stopping`);
                        break;
                    }
                    // Wait for page to load
                    await new Promise(r => setTimeout(r, 1500));
                }
                
                // Scroll to load all offers on this page
                await scrollToLoadAllOffers();
                
                // Get offers on this page
                let offerItems = document.querySelectorAll('eld-dashboard-offers-list-item');
                if (offerItems.length === 0) {
                    offerItems = document.querySelectorAll('.offer-list-item');
                }
                
                log(`Page ${page}: Found ${offerItems.length} offer items`);
                
                // v9.7.4: Collect offer codes to process on this page
                const codesToProcess = [];
                for (const item of offerItems) {
                    if (!isOurOfferSaved(item)) continue;
                    const code = extractOfferCodeFromElement(item);
                    if (code) codesToProcess.push(code);
                }
                
                log(`Page ${page}: ${codesToProcess.length} our offers to process: [${codesToProcess.join(', ')}]`);
                
                // v9.7.4: Process each offer by CODE (not by element reference!)
                for (const offerCode of codesToProcess) {
                    try {
                        if (willPause) {
                            // v9.8.20: Check if offer is Closed first
                            const checkItem = findOfferElementByCode(offerCode);
                            if (checkItem && isOfferClosed(checkItem)) {
                                log(`⚠ ${offerCode}: Closed offer, skipping (can't pause)`); 
                                totalSkipped++;
                                continue;
                            }
                            
                            // v9.7.4: Retry logic for pausing - refind element each attempt
                            let success = false;
                            for (let attempt = 1; attempt <= 3 && !success; attempt++) {
                                // IMPORTANT: Find element FRESH each attempt (Angular recreates DOM)
                                const item = findOfferElementByCode(offerCode);
                                if (!item) {
                                    log(`⚠ ${offerCode}: Element not found, may have been removed`);
                                    totalSkipped++;
                                    break;
                                }
                                
                                const pauseIcon = item.querySelector('.icon-pause');
                                if (!pauseIcon) {
                                    // No pause icon = already paused or different state
                                    const resumeIcon = item.querySelector('.icon-chevron-right');
                                    if (resumeIcon) {
                                        log(`✓ ${offerCode}: Already paused`);
                                    }
                                    success = true;
                                    totalSkipped++;
                                    break;
                                }
                                
                                const pauseBtn = pauseIcon.closest('button');
                                if (!pauseBtn || pauseBtn.disabled) {
                                    log(`⚠ ${offerCode}: Button disabled or not found`);
                                    success = true;
                                    totalSkipped++;
                                    break;
                                }
                                
                                // Scroll element into view
                                item.scrollIntoView({ behavior: 'instant', block: 'center' });
                                await new Promise(r => setTimeout(r, 400));
                                
                                // v9.7.4: Use reliable click method
                                log(`Pausing ${offerCode} (attempt ${attempt})...`);
                                reliableClick(pauseBtn);
                                
                                // Wait longer for Angular to process
                                await new Promise(r => setTimeout(r, 1200));
                                
                                // v9.7.4: Verify by finding element again (DOM may have changed)
                                const freshItem = findOfferElementByCode(offerCode);
                                if (!freshItem) {
                                    // Element gone = probably success (removed from list after pause)
                                    success = true;
                                    totalProcessed++;
                                    log(`✓ Paused ${offerCode} (element removed)`);
                                    break;
                                }
                                
                                const stillHasPauseIcon = freshItem.querySelector('.icon-pause');
                                const hasResumeIcon = freshItem.querySelector('.icon-chevron-right');
                                
                                if (!stillHasPauseIcon || hasResumeIcon) {
                                    success = true;
                                    totalProcessed++;
                                    log(`✓ Paused ${offerCode}`);
                                } else if (attempt < 3) {
                                    log(`⚠ Retry ${offerCode}: icon unchanged`);
                                    await new Promise(r => setTimeout(r, 800));
                                }
                            }
                            if (!success) {
                                logInfo(`✗ Failed to pause ${offerCode}`);
                                totalFailed++;
                            }
                        } else {
                            // v9.8.20: Check if offer is Closed first
                            const checkItem = findOfferElementByCode(offerCode);
                            if (checkItem && isOfferClosed(checkItem)) {
                                log(`⚠ ${offerCode}: Closed offer, skipping (can't resume)`);
                                totalSkipped++;
                                continue;
                            }
                            
                            // v9.7.4: Retry logic for resuming
                            let success = false;
                            for (let attempt = 1; attempt <= 3 && !success; attempt++) {
                                const item = findOfferElementByCode(offerCode);
                                if (!item) {
                                    log(`⚠ ${offerCode}: Element not found`);
                                    totalSkipped++;
                                    break;
                                }
                                
                                const resumeIcon = item.querySelector('.icon-chevron-right') || item.querySelector('.icon-play');
                                if (!resumeIcon) {
                                    const pauseIcon = item.querySelector('.icon-pause');
                                    if (pauseIcon) {
                                        log(`✓ ${offerCode}: Already active`);
                                    }
                                    success = true;
                                    totalSkipped++;
                                    break;
                                }
                                
                                const resumeBtn = resumeIcon.closest('button');
                                if (!resumeBtn || resumeBtn.disabled) {
                                    success = true;
                                    totalSkipped++;
                                    break;
                                }
                                
                                item.scrollIntoView({ behavior: 'instant', block: 'center' });
                                await new Promise(r => setTimeout(r, 400));
                                
                                log(`Resuming ${offerCode} (attempt ${attempt})...`);
                                reliableClick(resumeBtn);
                                
                                await new Promise(r => setTimeout(r, 1200));
                                
                                const freshItem = findOfferElementByCode(offerCode);
                                if (!freshItem) {
                                    success = true;
                                    totalProcessed++;
                                    log(`✓ Resumed ${offerCode}`);
                                    break;
                                }
                                
                                const stillHasResumeIcon = freshItem.querySelector('.icon-chevron-right') || freshItem.querySelector('.icon-play');
                                const hasPauseIcon = freshItem.querySelector('.icon-pause');
                                
                                if (!stillHasResumeIcon || hasPauseIcon) {
                                    success = true;
                                    totalProcessed++;
                                    log(`✓ Resumed ${offerCode}`);
                                } else if (attempt < 3) {
                                    log(`⚠ Retry ${offerCode}: icon unchanged`);
                                    await new Promise(r => setTimeout(r, 800));
                                }
                            }
                            if (!success) {
                                logInfo(`✗ Failed to resume ${offerCode}`);
                                totalFailed++;
                            }
                        }
                    } catch (e) {
                        totalFailed++;
                        logError(`Error toggling ${offerCode}:`, e);
                    }
                    
                    // v9.7.6: Re-apply highlighting after each offer (Angular may have removed it)
                    highlightUserOffers();
                }
            }
            
            // Return to first page if we navigated
            if (totalPages > 1) {
                await goToPage(1);
            }
            
            // Wait for UI to update
            await new Promise(r => setTimeout(r, 1000));
            
            // Update button state
            updateSleepButton();
            
            // v9.7.4: Re-apply highlighting after toggle (Angular may have removed it)
            setTimeout(() => {
                highlightUserOffers();
            }, 500);
            
            const statusMsg = willPause 
                ? `💤 Sleep Mode - ${totalProcessed} offers paused${totalSkipped > 0 ? ` (${totalSkipped} skipped)` : ''}${totalFailed > 0 ? ` (${totalFailed} failed)` : ''}`
                : `⚡ Active - ${totalProcessed} offers resumed${totalSkipped > 0 ? ` (${totalSkipped} skipped)` : ''}${totalFailed > 0 ? ` (${totalFailed} failed)` : ''}`;
            showNotification(statusMsg, totalFailed > 0 ? 'warning' : (totalProcessed > 0 ? 'success' : 'info'));
            logInfo(`Sleep mode: ${totalProcessed} paused/resumed, ${totalSkipped} skipped, ${totalFailed} failed`);
            
            // v9.7: Trigger scan to update status in farmpanel DB
            if (totalProcessed > 0) {
                log('Triggering farmpanel scan to sync status...');
                localStorage.setItem('glitched_refresh_offers', Date.now().toString());
                syncOfferStatusToFarmpanel(willPause, ourCodes);
            }
        } finally {
            isTogglingOffers = false;
        }
    }
    
    // v9.8.20: Clean all Closed offers - удаляет офферы со статусом Closed
    let isCleaningOffers = false;
    
    async function cleanClosedOffers() {
        if (isCleaningOffers || isTogglingOffers) {
            showNotification('⏳ Please wait, operation in progress...', 'warning');
            return;
        }
        
        // First, count how many Closed offers we have
        const ourCodes = new Set([...userOfferCodes]);
        let closedCount = 0;
        
        const items = document.querySelectorAll('eld-dashboard-offers-list-item');
        for (const item of items) {
            const code = extractOfferCodeFromElement(item);
            if (!code) continue;
            if (!ourCodes.has(code) && !ourCodes.has('#' + code)) continue;
            if (isOfferClosed(item)) closedCount++;
        }
        
        if (closedCount === 0) {
            showNotification('✓ No Closed offers to clean', 'success');
            return;
        }
        
        // Show confirmation dialog
        const confirmMessage = `🗑️ Delete ${closedCount} Closed offer(s)?\n\nThis will permanently delete offers with "Closed" status.\nThis cannot be undone!`;
        
        if (!confirm(confirmMessage)) {
            log('Clean Closed cancelled by user');
            return;
        }
        
        isCleaningOffers = true;
        
        try {
            showNotification(`🗑️ Deleting ${closedCount} Closed offers...`, 'info');
            logInfo(`Clean Closed: Starting deletion of ${closedCount} offers`);
            
            let totalDeleted = 0;
            let totalFailed = 0;
            
            // Process all pages
            const totalPages = getTotalPages();
            
            for (let page = 1; page <= totalPages; page++) {
                if (page > 1) {
                    const navigated = await goToPage(page);
                    if (!navigated) break;
                    await new Promise(r => setTimeout(r, 1500));
                }
                
                await scrollToLoadAllOffers();
                
                // Find Closed offers on this page
                const pageItems = document.querySelectorAll('eld-dashboard-offers-list-item');
                const closedCodes = [];
                
                for (const item of pageItems) {
                    const code = extractOfferCodeFromElement(item);
                    if (!code) continue;
                    if (!ourCodes.has(code) && !ourCodes.has('#' + code)) continue;
                    if (isOfferClosed(item)) {
                        closedCodes.push(code);
                    }
                }
                
                log(`Page ${page}: Found ${closedCodes.length} Closed offers to delete`);
                
                // Delete each Closed offer
                for (const offerCode of closedCodes) {
                    try {
                        // Find element fresh
                        const item = findOfferElementByCode(offerCode);
                        if (!item) {
                            log(`⚠ ${offerCode}: Element not found`);
                            continue;
                        }
                        
                        // Double check it's still Closed
                        if (!isOfferClosed(item)) {
                            log(`⚠ ${offerCode}: No longer Closed, skipping`);
                            continue;
                        }
                        
                        // Find Delete button (trash icon)
                        const deleteIcon = item.querySelector('.icon-delete');
                        if (!deleteIcon) {
                            log(`⚠ ${offerCode}: Delete button not found`);
                            totalFailed++;
                            continue;
                        }
                        
                        const deleteBtn = deleteIcon.closest('button');
                        if (!deleteBtn) {
                            log(`⚠ ${offerCode}: Delete button wrapper not found`);
                            totalFailed++;
                            continue;
                        }
                        
                        // Scroll into view and click
                        item.scrollIntoView({ behavior: 'instant', block: 'center' });
                        await new Promise(r => setTimeout(r, 400));
                        
                        log(`Clicking delete for ${offerCode}...`);
                        reliableClick(deleteBtn);
                        
                        // Wait for confirmation modal
                        await new Promise(r => setTimeout(r, 800));
                        
                        // Find and click confirm Delete button in modal
                        const confirmDeleted = await clickDeleteConfirmButton();
                        
                        if (confirmDeleted) {
                            totalDeleted++;
                            log(`✓ Deleted ${offerCode}`);
                            // Wait for UI to update after deletion
                            await new Promise(r => setTimeout(r, 1000));
                        } else {
                            totalFailed++;
                            log(`✗ Failed to confirm delete for ${offerCode}`);
                        }
                        
                    } catch (e) {
                        totalFailed++;
                        logError(`Error deleting ${offerCode}:`, e);
                    }
                    
                    highlightUserOffers();
                }
            }
            
            // Return to first page
            if (totalPages > 1) {
                await goToPage(1);
            }
            
            await new Promise(r => setTimeout(r, 1000));
            highlightUserOffers();
            
            const statusMsg = `🗑️ Cleaned ${totalDeleted} Closed offers${totalFailed > 0 ? ` (${totalFailed} failed)` : ''}`;
            showNotification(statusMsg, totalFailed > 0 ? 'warning' : 'success');
            logInfo(`Clean Closed: ${totalDeleted} deleted, ${totalFailed} failed`);
            
        } finally {
            isCleaningOffers = false;
        }
    }
    
    // v9.8.20: Click the Delete confirm button in modal
    async function clickDeleteConfirmButton(timeout = 5000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            // Look for modal with "Delete offer" title
            const modalTitles = document.querySelectorAll('.nsm-content span, .nsm-dialog span');
            let isDeleteModal = false;
            
            for (const title of modalTitles) {
                if (title.textContent?.includes('Delete offer')) {
                    isDeleteModal = true;
                    break;
                }
            }
            
            if (!isDeleteModal) {
                await new Promise(r => setTimeout(r, 200));
                continue;
            }
            
            // Find the Delete button (primary button with "Delete" text, NOT Close)
            const buttons = document.querySelectorAll('.nsm-content button, .nsm-dialog button');
            
            for (const btn of buttons) {
                const btnText = btn.textContent?.trim().toLowerCase();
                const isPrimary = btn.classList.contains('button__primary');
                
                // Must be primary button with "delete" text
                if (isPrimary && btnText === 'delete') {
                    log('Found Delete confirm button in modal');
                    reliableClick(btn);
                    await new Promise(r => setTimeout(r, 500));
                    return true;
                }
            }
            
            await new Promise(r => setTimeout(r, 200));
        }
        
        log('Timeout waiting for Delete confirm button');
        return false;
    }
    
    // v9.7.2: Navigate to specific page
    async function goToPage(pageNum) {
        const currentPage = getCurrentPageNumber();
        if (currentPage === pageNum) return true;
        
        // Find page button
        const pageButtons = document.querySelectorAll('.pagination .pagination-item:not(.pagination-arrow)');
        for (const btn of pageButtons) {
            const btnPage = parseInt(btn.textContent?.trim(), 10);
            if (btnPage === pageNum) {
                btn.click();
                await new Promise(r => setTimeout(r, 1500));
                return true;
            }
        }
        
        // Try next/prev arrows
        if (pageNum > currentPage) {
            const nextArrow = document.querySelector('.pagination-arrow:last-child div');
            if (nextArrow) {
                nextArrow.click();
                await new Promise(r => setTimeout(r, 1500));
                return getCurrentPageNumber() === pageNum || getCurrentPageNumber() > currentPage;
            }
        }
        
        return false;
    }
    
    // v9.7.2: Sync offer status to farmpanel after sleep mode toggle
    async function syncOfferStatusToFarmpanel(isPaused, savedCodes) {
        try {
            const farmKey = CONFIG.farmKey || localStorage.getItem('glitched_farm_key');
            if (!farmKey) return;
            
            // Use saved codes if provided, otherwise use current userOfferCodes
            const codesToCheck = savedCodes || userOfferCodes;
            
            // Collect current status of our offers on page
            const statusUpdates = [];
            const items = document.querySelectorAll('eld-dashboard-offers-list-item');
            
            for (const item of items) {
                const code = extractOfferCodeFromElement(item);
                if (!code) continue;
                if (!codesToCheck.has(code) && !codesToCheck.has('#' + code)) continue;
                
                // Check actual status after toggle
                const pausedChip = item.querySelector('[aria-label="Paused"]');
                const resumeIcon = item.querySelector('.icon-chevron-right');
                
                const status = (pausedChip || resumeIcon) ? 'paused' : 'active';
                statusUpdates.push({ offerId: '#' + code, status });
            }
            
            log(`Syncing ${statusUpdates.length} offer statuses to farmpanel`);
            
            // Update each offer status via API
            for (const update of statusUpdates) {
                try {
                    await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'PUT',
                            url: `${API_BASE}/offers`,
                            headers: { 'Content-Type': 'application/json' },
                            data: JSON.stringify({ 
                                farmKey, 
                                offerId: update.offerId, 
                                status: update.status 
                            }),
                            onload: (response) => {
                                if (response.status >= 200 && response.status < 300) {
                                    resolve();
                                } else {
                                    reject(new Error(`HTTP ${response.status}`));
                                }
                            },
                            onerror: reject
                        });
                    });
                } catch (e) {
                    log(`Failed to sync status for ${update.offerId}:`, e);
                }
            }
            
            log('Status sync complete');
            // v9.7.8: Trigger panel refresh after status sync
            triggerPanelRefresh();
        } catch (e) {
            logError('Error syncing status to farmpanel:', e);
        }
    }
    
    // ==================== REFRESH OFFERS ====================
    async function triggerOffersRefresh() {
        log('Triggering offers refresh...');
        
        // 1. Refresh in farmpanel (if we can communicate)
        try {
            const farmKey = CONFIG.farmKey || localStorage.getItem('glitched_farm_key');
            if (farmKey) {
                // Send message to refresh offers
                localStorage.setItem('glitched_refresh_offers', Date.now().toString());
            }
        } catch (e) {}
        
        // 2. Reload user offers from API
        await loadUserOffers();
        
        // 3. If on dashboard, trigger Eldorado page refresh
        if (window.location.pathname.includes('/dashboard/offers')) {
            // Try to find and click refresh button or just reload
            const refreshBtn = document.querySelector('[aria-label="Refresh"], .refresh-btn, button[title*="refresh"]');
            if (refreshBtn) {
                refreshBtn.click();
            } else {
                // Soft refresh - reload offers section
                log('No refresh button found, page will show updated offers on next navigation');
            }
        }
        
        log('Offers refresh triggered');
    }
    
    // Watch for offer deletions (only real deletions, not pauses)
    function watchForOfferDeletions() {
        // Track known offer elements to detect real deletions vs UI changes
        let knownOfferCount = 0;
        
        const checkForDeletions = () => {
            const offerItems = document.querySelectorAll('.offer-list-item, eld-dashboard-offers-list-item');
            const currentCount = offerItems.length;
            
            // Only notify if count decreased significantly (real deletion, not UI update)
            if (knownOfferCount > 0 && currentCount < knownOfferCount) {
                // Check if any of our offers are gone
                let ourOffersNow = 0;
                offerItems.forEach(item => {
                    const text = item.textContent || '';
                    if (item.classList?.contains('glitched-my-offer') || 
                        item.querySelector?.('.glitched-my-offer') ||
                        containsOfferCode(text)) {
                        ourOffersNow++;
                    }
                });
                
                // Don't show notification for every DOM change - let API refresh handle it
                log(`Offer count changed: ${knownOfferCount} -> ${currentCount}`);
            }
            
            knownOfferCount = currentCount;
        };
        
        const observer = new MutationObserver((mutations) => {
            // Debounce - wait for DOM to settle
            clearTimeout(observer._timeout);
            observer._timeout = setTimeout(checkForDeletions, 500);
        });
        
        // Find the offers container - try multiple selectors
        const offersContainer = document.querySelector('.offers-list, .orders-container, .offers-container, [class*="offers-list"]');
        if (offersContainer) {
            observer.observe(offersContainer, { childList: true, subtree: true });
            log('Watching for offer deletions');
            checkForDeletions(); // Initial count
        }
    }
    
    // ==================== АВТОРИЗАЦИЯ ====================
    function showAuthPanel() {
        // v9.7.8: Toggle - если панель уже открыта, закрываем её
        const existing = document.querySelector('.glitched-auth-panel');
        if (existing) {
            existing.remove();
            return; // Просто закрываем, не открываем заново
        }
        
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
        document.querySelectorAll('.glitched-mini-btn, .glitched-navbar-container').forEach(el => el.remove());
        
        // Всегда ищем activities-area для встраивания
        const activitiesArea = document.querySelector('.activities-area.navbar-content');
        
        if (activitiesArea) {
            // Создаём контейнер для кнопок
            const container = document.createElement('div');
            container.className = 'glitched-navbar-container';
            container.style.cssText = 'display: flex; align-items: center; margin-right: 8px; flex-shrink: 0;';
            
            // Кнопка панели
            const inlineBtn = document.createElement('div');
            inlineBtn.className = 'glitched-inline-btn';
            inlineBtn.innerHTML = '<span style="font-size: 18px;">🔮</span>';
            inlineBtn.onclick = showAuthPanel;
            inlineBtn.title = 'Glitched Store Panel';
            container.appendChild(inlineBtn);
            
            // Sleep Mode кнопка (только на dashboard/offers)
            if (window.location.pathname.includes('/dashboard/offers')) {
                const state = detectSleepState();
                const sleepBtn = document.createElement('div');
                
                if (state === 'sleep') {
                    sleepBtn.className = 'glitched-sleep-btn active';
                    sleepBtn.innerHTML = '💤 Sleep';
                    sleepBtn.title = 'All offers paused. Click to resume.';
                } else if (state === 'active') {
                    sleepBtn.className = 'glitched-sleep-btn inactive';
                    sleepBtn.innerHTML = '⚡ Active';
                    sleepBtn.title = 'All offers active. Click to pause.';
                } else {
                    sleepBtn.className = 'glitched-sleep-btn unknown';
                    sleepBtn.innerHTML = '❓ Mixed';
                    sleepBtn.title = 'Some offers paused, some active. Click to sync.';
                }
                
                sleepBtn.onclick = toggleSleepMode;
                container.appendChild(sleepBtn);
                
                // v9.8.20: Clean Closed button - удаляет все Closed офферы
                const cleanBtn = document.createElement('div');
                cleanBtn.className = 'glitched-clean-btn';
                cleanBtn.innerHTML = '🗑️ Clean';
                cleanBtn.title = 'Delete all Closed offers';
                cleanBtn.onclick = cleanClosedOffers;
                container.appendChild(cleanBtn);
            }
            
            // Вставляем в начало activities-area
            activitiesArea.insertBefore(container, activitiesArea.firstChild);
            log('Panel buttons inserted into navbar activities-area');
            return;
        }
        
        // Fallback - фиксированная кнопка под navbar
        const btn = document.createElement('div');
        btn.className = 'glitched-mini-btn';
        btn.innerHTML = '<span style="font-size: 20px;">🔮</span>';
        btn.onclick = showAuthPanel;
        btn.title = 'Glitched Store Panel';
        document.body.appendChild(btn);
        log('Panel button added as fixed position (fallback)');
    }
    
    // ==================== ЗАГРУЗКА ДАННЫХ ФЕРМЕРА ====================
    async function loadUserOffers() {
        if (!CONFIG.farmKey) return;
        
        // v9.8.5: Load from cache immediately for instant display
        const cached = localStorage.getItem('glitched_offer_codes');
        const cachedTimestamp = localStorage.getItem('glitched_offer_codes_timestamp');
        const cacheAge = cachedTimestamp ? Date.now() - parseInt(cachedTimestamp, 10) : Infinity;
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
        
        if (cached) {
            try {
                const cachedCodes = JSON.parse(cached);
                cachedCodes.forEach(code => userOfferCodes.add(code));
                log(`Loaded ${cachedCodes.length} codes from cache (age: ${Math.round(cacheAge/1000)}s)`);
                // Сразу подсвечиваем из кэша
                highlightUserOffers();
                updateSleepButton();
                
                // If cache is fresh enough, just use it and fetch in background
                if (cacheAge < CACHE_TTL) {
                    showNotification(`✓ Quick connect! Using cached data`, 'success');
                    // Fetch fresh data in background (non-blocking)
                    fetchFreshDataInBackground();
                    return;
                }
            } catch (e) {}
        }
        
        await fetchAndCacheOfferData();
    }
    
    // v9.8.5: Background data refresh (non-blocking)
    async function fetchFreshDataInBackground() {
        try {
            await fetchAndCacheOfferData(true); // silent mode
            log('Background data refresh completed');
        } catch (e) {
            logError('Background refresh failed:', e);
        }
    }
    
    // v9.8.5: Fetch data with parallel requests
    async function fetchAndCacheOfferData(silent = false) {
        try {
            // Parallel fetch both endpoints for faster loading
            const [syncResponse, offersResponse] = await Promise.all([
                fetch(`${API_BASE}/sync?key=${encodeURIComponent(CONFIG.farmKey)}`),
                fetch(`${API_BASE}/offers?farmKey=${encodeURIComponent(CONFIG.farmKey)}`).catch(() => null)
            ]);
            
            if (!syncResponse.ok) {
                if (syncResponse.status === 404) {
                    throw new Error('Farm Key not found. Please check your key.');
                }
                throw new Error('Failed to fetch data');
            }
            
            const farmer = await syncResponse.json();
            const accounts = farmer.accounts || [];
            
            // Собираем все brainrots со всех аккаунтов
            userOffers = [];
            userOfferCodes.clear();
            userBrainrotNames.clear();
            
            for (const account of accounts) {
                const brainrots = account.brainrots || [];
                for (const br of brainrots) {
                    const offer = {
                        name: br.name || br.Name,
                        income: br.income || br.Income,
                        imageId: br.imageId || br.ImageId,
                        offerId: br.offerId || br.OfferId,
                        accountName: account.playerName || account.name,
                        accountId: account.userId
                    };
                    userOffers.push(offer);
                    
                    if (offer.offerId) {
                        const code = offer.offerId.toUpperCase().replace(/^#/, '');
                        userOfferCodes.add(code);
                        userOfferCodes.add('#' + code);
                    }
                    
                    if (offer.name) {
                        userBrainrotNames.add(offer.name.toUpperCase());
                    }
                }
            }
            
            // Process offers response (already fetched in parallel)
            if (offersResponse && offersResponse.ok) {
                try {
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
                } catch (offersErr) {
                    logError('Could not parse offers:', offersErr);
                }
            }
            
            // Save to cache
            try {
                localStorage.setItem('glitched_offer_codes', JSON.stringify([...userOfferCodes]));
                localStorage.setItem('glitched_offer_codes_timestamp', Date.now().toString());
            } catch (e) {}
            
            logInfo(`Loaded ${accounts.length} accounts, ${userOffers.length} brainrots, ${userOfferCodes.size} unique codes`);
            CONFIG.connectionError = false;
            
            if (!silent) {
                if (userOffers.length > 0) {
                    showNotification(`✓ Connected! ${accounts.length} accounts, ${userOffers.length} brainrots`, 'success');
                } else if (accounts.length > 0) {
                    showNotification(`✓ Connected! ${accounts.length} accounts (no brainrots)`, 'success');
                } else {
                    showNotification('Connected but no accounts found', 'warning');
                }
            }
            
            highlightUserOffers();
            updateSleepButton();
            
        } catch (e) {
            CONFIG.connectionError = true;
            logError('Error loading data:', e);
            if (!silent) {
                showNotification('Failed to connect: ' + e.message, 'error');
            }
        }
    }
    
    // v9.8.6: Real-time sync with panel - polling for changes
    let syncIntervalId = null;
    let lastOfferCodesHash = '';
    const SYNC_INTERVAL = 15000; // Check every 15 seconds
    
    function getOfferCodesHash() {
        return [...userOfferCodes].sort().join(',');
    }
    
    async function checkForOfferChanges() {
        if (!CONFIG.farmKey || CONFIG.connectionError) return;
        
        try {
            // Quick check - only fetch offers endpoint (faster than full sync)
            const response = await fetch(`${API_BASE}/offers?farmKey=${encodeURIComponent(CONFIG.farmKey)}`);
            if (!response.ok) return;
            
            const data = await response.json();
            const apiOffers = data.offers || [];
            
            // Build new codes set from API
            const newCodes = new Set();
            for (const offer of apiOffers) {
                if (offer.offerId) {
                    const code = offer.offerId.toUpperCase().replace(/^#/, '');
                    newCodes.add(code);
                    newCodes.add('#' + code);
                }
            }
            
            // Compare with current codes
            const newHash = [...newCodes].sort().join(',');
            
            if (lastOfferCodesHash && newHash !== lastOfferCodesHash) {
                // Codes changed! Find what was deleted
                const deletedCodes = [...userOfferCodes].filter(code => !newCodes.has(code) && !code.startsWith('#'));
                const addedCodes = [...newCodes].filter(code => !userOfferCodes.has(code) && !code.startsWith('#'));
                
                if (deletedCodes.length > 0) {
                    log(`Detected ${deletedCodes.length} deleted offer(s): ${deletedCodes.join(', ')}`);
                    showNotification(`🗑️ ${deletedCodes.length} offer(s) deleted from panel`, 'deleted');
                }
                
                if (addedCodes.length > 0) {
                    log(`Detected ${addedCodes.length} new offer(s): ${addedCodes.join(', ')}`);
                    showNotification(`➕ ${addedCodes.length} new offer(s) added`, 'success');
                }
                
                // Update local state
                userOfferCodes.clear();
                newCodes.forEach(code => userOfferCodes.add(code));
                
                // Update cache
                try {
                    localStorage.setItem('glitched_offer_codes', JSON.stringify([...userOfferCodes]));
                    localStorage.setItem('glitched_offer_codes_timestamp', Date.now().toString());
                } catch (e) {}
                
                // Re-highlight offers
                highlightUserOffers();
                updateSleepButton();
            }
            
            lastOfferCodesHash = newHash;
            
        } catch (e) {
            // Silent fail - don't spam errors for sync checks
            log('Sync check failed: ' + e.message, 'warn');
        }
    }
    
    function startRealTimeSync() {
        if (syncIntervalId) return; // Already running
        
        lastOfferCodesHash = getOfferCodesHash();
        log('Starting real-time sync (every ' + (SYNC_INTERVAL/1000) + 's)');
        
        syncIntervalId = setInterval(checkForOfferChanges, SYNC_INTERVAL);
    }
    
    function stopRealTimeSync() {
        if (syncIntervalId) {
            clearInterval(syncIntervalId);
            syncIntervalId = null;
            log('Stopped real-time sync');
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
                // Ищем tooltip-inner внутри row - там полное название оффера с кодом
                const tooltipInner = row.querySelector('.tooltip-inner');
                const tooltipText = tooltipInner ? tooltipInner.textContent : '';
                
                // v9.8.2: Проверяем ТОЛЬКО по коду оффера, не по названию "Glitched Store"
                if (containsOfferCode(tooltipText)) {
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
    
    // v9.8.1: Try to load queue from farmpanel API (cross-domain support)
    async function tryLoadQueueFromAPI(farmKey) {
        try {
            const key = farmKey || CONFIG.farmKey || localStorage.getItem('glitched_farm_key');
            if (!key) {
                log('No farm key for queue fetch');
                return false;
            }
            
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${API_BASE}/queue?farmKey=${encodeURIComponent(key)}`,
                    onload: (response) => {
                        if (response.status === 200) {
                            try {
                                const data = JSON.parse(response.responseText);
                                if (data.success && data.queue && data.queue.length > 0) {
                                    log(`Loaded queue from API: ${data.queue.length} items`);
                                    localStorage.setItem('eldoradoQueue', JSON.stringify(data.queue));
                                    localStorage.setItem('eldoradoQueueIndex', '0');
                                    localStorage.setItem('eldoradoQueueCompleted', '[]');
                                    localStorage.setItem('eldoradoQueueTimestamp', Date.now().toString());
                                    resolve(true);
                                    return;
                                }
                            } catch (e) {
                                log('Failed to parse queue response:', e);
                            }
                        }
                        resolve(false);
                    },
                    onerror: () => resolve(false)
                });
            });
        } catch (e) {
            log('Error loading queue from API:', e);
            return false;
        }
    }
    
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
                // Log quantities for debugging
                queueState.queue.forEach((item, i) => {
                    log(`Queue item ${i}: ${item.name}, qty: ${item.quantity || 1}`);
                });
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
    
    // Try to close window, fallback to redirect if not allowed
    function closeWindowOrRedirect() {
        // Try to close
        try {
            window.close();
        } catch (e) {
            log('window.close() failed: ' + e.message);
        }
        
        // If still open after 500ms, redirect to panel
        setTimeout(() => {
            if (!window.closed) {
                log('Window still open, redirecting to panel...');
                window.location.href = 'https://farmpanel.vercel.app';
            }
        }, 500);
    }
    
    function processNextQueueItem() {
        const item = getCurrentQueueItem();
        if (!item) {
            log('No more items in queue');
            showNotification('✅ Очередь завершена! Закрытие через 3 сек...', 'success');
            clearQueue();
            setTimeout(() => closeWindowOrRedirect(), 3000);
            return false;
        }
        log(`Processing queue item: ${item.name} (qty: ${item.quantity || 1})`);
        const offerDataForUrl = {
            name: item.name, income: item.income, generatedImageUrl: item.imageUrl,
            maxPrice: parseFloat(item.price) || 0, minPrice: parseFloat(item.price) || 0,
            quantity: item.quantity || 1,
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

    // v9.8.4: Special function for brainrot selection with "Other" fallback
    // This keeps the dropdown OPEN if brainrot not found, so we can select "Other" immediately
    async function selectBrainrotWithOtherFallback(ngSelect, searchName, originalName) {
        if (!ngSelect) return false;
        
        log(`Selecting brainrot: "${searchName}" (original: "${originalName}")`);
        
        // First check if already selected
        if (isValueSelected(ngSelect, searchName) || isValueSelected(ngSelect, originalName)) {
            log(`Brainrot already selected`, 'success');
            return true;
        }
        
        try {
            closeAllDropdowns();
            await new Promise(r => setTimeout(r, 200));
            
            const input = ngSelect.querySelector('input[role="combobox"]');
            if (!input) {
                log('Input not found in ng-select for brainrot', 'warn');
                return false;
            }
            
            // Open dropdown
            input.focus();
            await new Promise(r => setTimeout(r, 100));
            
            input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            await new Promise(r => setTimeout(r, 80));
            input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await new Promise(r => setTimeout(r, 300));
            
            let isOpen = input.getAttribute('aria-expanded') === 'true';
            
            if (!isOpen) {
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
                await new Promise(r => setTimeout(r, 200));
                isOpen = input.getAttribute('aria-expanded') === 'true';
            }
            
            if (!isOpen) {
                log('Dropdown not opening for brainrot, trying container click', 'warn');
                const container = ngSelect.querySelector('.ng-select-container');
                if (container) {
                    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 400));
                }
            }
            
            // Wait for panel
            let panel = null;
            for (let i = 0; i < 30; i++) {
                panel = document.querySelector('ng-dropdown-panel');
                if (panel) break;
                await new Promise(r => setTimeout(r, 100));
            }
            
            if (!panel) {
                log('Dropdown panel not found for brainrot', 'warn');
                return false;
            }
            
            log('Dropdown opened, searching for brainrot...');
            
            const options = panel.querySelectorAll('.ng-option');
            const namesToTry = [searchName, originalName].filter((v, i, a) => a.indexOf(v) === i); // unique names
            
            // Try to find exact match for brainrot name
            for (const nameToFind of namesToTry) {
                const searchText = nameToFind.toLowerCase();
                
                // Exact match
                for (const opt of options) {
                    const label = opt.querySelector('.ng-option-label')?.textContent?.trim() || opt.textContent.trim();
                    if (label.toLowerCase() === searchText) {
                        log(`Found exact match: "${label}"`);
                        opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        await new Promise(r => setTimeout(r, 50));
                        opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        await new Promise(r => setTimeout(r, 300));
                        return true;
                    }
                }
                
                // Partial match
                for (const opt of options) {
                    const label = opt.querySelector('.ng-option-label')?.textContent?.trim() || opt.textContent.trim();
                    if (label.toLowerCase().includes(searchText) || searchText.includes(label.toLowerCase())) {
                        log(`Found partial match: "${label}"`);
                        opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        await new Promise(r => setTimeout(r, 50));
                        opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        await new Promise(r => setTimeout(r, 300));
                        return true;
                    }
                }
            }
            
            // Brainrot not found - select "Other" from the STILL OPEN dropdown!
            log('Brainrot not found in dropdown, selecting "Other"...', 'warn');
            
            // The dropdown should still be open, look for "Other"
            for (const opt of options) {
                const label = opt.querySelector('.ng-option-label')?.textContent?.trim() || opt.textContent.trim();
                if (label.toLowerCase() === 'other') {
                    log('Found "Other" option, clicking...');
                    opt.scrollIntoView({ block: 'center' });
                    await new Promise(r => setTimeout(r, 100));
                    opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 50));
                    opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 300));
                    
                    // Verify selection
                    if (isValueSelected(ngSelect, 'Other')) {
                        log('Successfully selected "Other"', 'success');
                        return true;
                    }
                }
            }
            
            // If still not selected, try reopening and selecting Other
            log('Could not find Other in current dropdown, retrying...', 'warn');
            closeAllDropdowns();
            await new Promise(r => setTimeout(r, 500));
            
            // Retry selecting Other with fresh dropdown
            for (let attempt = 1; attempt <= 3; attempt++) {
                log(`Retry attempt ${attempt}/3 for Other`);
                
                const freshSelect = findNgSelectByAriaLabel('Brainrot');
                if (!freshSelect) {
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                
                const selected = await selectNgOption(freshSelect, 'Other');
                if (selected) {
                    log('Successfully selected Other on retry', 'success');
                    return true;
                }
                
                await new Promise(r => setTimeout(r, 500));
            }
            
            log('Failed to select brainrot or Other', 'error');
            return false;
            
        } catch (e) {
            log(`Error in selectBrainrotWithOtherFallback: ${e.message}`, 'error');
            closeAllDropdowns();
            return false;
        }
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
            
            // v9.8.3: More robust dropdown opening sequence
            input.focus();
            await new Promise(r => setTimeout(r, 100));
            
            // Try multiple methods to open the dropdown
            input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            await new Promise(r => setTimeout(r, 80));
            input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await new Promise(r => setTimeout(r, 200));
            
            let isOpen = input.getAttribute('aria-expanded') === 'true';
            
            // If not open yet, try ArrowDown key
            if (!isOpen) {
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
                await new Promise(r => setTimeout(r, 200));
                isOpen = input.getAttribute('aria-expanded') === 'true';
            }
            
            // v9.8.3: If still not open, try clicking the ng-select container itself
            if (!isOpen) {
                log('Dropdown not opening, trying container click', 'warn');
                const container = ngSelect.querySelector('.ng-select-container');
                if (container) {
                    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 300));
                }
            }
            
            let panel = null;
            for (let i = 0; i < 25; i++) {
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
            
            // Маппинг исправлений опечаток на Eldorado
            const brainrotNameFixes = {
                'chimnino': 'chimino',  // Опечатка на Eldorado
                'Chimnino': 'Chimino'
            };
            let searchName = brainrotNameFixes[name] || name;
            log('Searching for brainrot: ' + searchName);
            
            let brainrotSelect = null;
            for (let i = 0; i < 10; i++) {
                brainrotSelect = findNgSelectByAriaLabel('Brainrot');
                if (brainrotSelect) break;
                await new Promise(r => setTimeout(r, 150));
            }
            if (brainrotSelect) {
                // v9.8.4: Improved brainrot selection with fallback to Other
                let selected = await selectBrainrotWithOtherFallback(brainrotSelect, searchName, name);
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
                        
                        // Trigger offers refresh in panel
                        localStorage.setItem('glitched_refresh_offers', Date.now().toString());
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
                            setTimeout(() => window.close(), 3000);
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
                const qtyBadge = item.quantity > 1 ? `<span style="color:#f59e0b;font-weight:bold;">x${item.quantity}</span>` : '';
                return `<div class="queue-item ${className}"><span class="q-icon">${icon}</span><span class="q-name">${item.name} ${qtyBadge}</span></div>`;
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
            if (response.ok) {
                // Trigger refresh in panel (cross-tab communication via localStorage)
                triggerPanelRefresh();
            }
            return response.ok;
        } catch (e) { return false; }
    }
    
    // Trigger panel to refresh offers list
    function triggerPanelRefresh() {
        const timestamp = Date.now().toString();
        localStorage.setItem('glitched_refresh_offers', timestamp);
        // Force storage event by removing and re-adding (works better cross-tab)
        localStorage.removeItem('glitched_refresh_offers');
        localStorage.setItem('glitched_refresh_offers', timestamp);
        log('Triggered panel refresh');
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
    let lastPathname = window.location.pathname; // Track URL changes for SPA navigation
    
    function setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            // v9.7.6: DON'T skip highlighting during toggle - only skip sleep button update
            
            // Check for URL change (SPA navigation)
            const currentPathname = window.location.pathname;
            const urlChanged = currentPathname !== lastPathname;
            if (urlChanged) {
                lastPathname = currentPathname;
                // Re-show button with/without sleep mode depending on new URL
                setTimeout(() => {
                    showMiniButton();
                    if (currentPathname.includes('/dashboard/offers')) {
                        highlightUserOffers();
                    }
                }, 500);
            }
            
            // Перепроверяем подсветку при изменениях DOM
            let shouldCheck = false;
            let navbarChanged = false;
            
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    shouldCheck = true;
                    // Check if navbar changed
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1 && (
                            node.classList?.contains('activities-area') ||
                            node.closest?.('.navbar-grid-layout')
                        )) {
                            navbarChanged = true;
                        }
                    }
                }
            }
            
            if (shouldCheck) {
                // v9.7.6: Shorter debounce for highlighting (500ms), always apply it
                clearTimeout(window.glitchedHighlightTimeout);
                window.glitchedHighlightTimeout = setTimeout(() => {
                    // Always highlight - even during toggle
                    highlightUserOffers();
                    // v9.7.6: Only update sleep button if NOT toggling
                    if (!isTogglingOffers && window.location.pathname.includes('/dashboard/offers')) {
                        updateSleepButton();
                    }
                }, 500);
            }
            
            // Re-insert button if navbar changed
            if (navbarChanged) {
                clearTimeout(window.glitchedButtonTimeout);
                window.glitchedButtonTimeout = setTimeout(() => {
                    if (!document.querySelector('.glitched-inline-btn, .glitched-navbar-container')) {
                        showMiniButton();
                    }
                }, 300);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // ==================== QUICK CHAT FOR ORDER PAGE ====================
    let quickChatPanel = null;
    let deliveredWatcher = null;
    let orderDelivered = false;
    
    /**
     * Check if current page is an order delivery page
     */
    function isOrderPage() {
        return window.location.pathname.includes('/order/');
    }
    
    /**
     * Get TalkJS iframe window for postMessage
     */
    function getTalkJSIframe() {
        const iframe = document.querySelector('iframe[name="____talkjs__chat__ui_internal"]') ||
                       document.querySelector('#talkjs-container iframe') ||
                       document.querySelector('iframe[src*="talkjs"]');
        return iframe;
    }
    
    /**
     * Send a message to the chat via postMessage to TalkJS iframe
     */
    async function sendChatMessage(message, buttonEl = null) {
        const iframe = getTalkJSIframe();
        if (!iframe || !iframe.contentWindow) {
            showNotification('❌ TalkJS chat not found', 'error');
            return false;
        }
        
        return new Promise((resolve) => {
            // Listen for response from iframe
            const handler = (event) => {
                if (event.data?.source === 'glitched-talkjs' && event.data?.action === 'messageSent') {
                    window.removeEventListener('message', handler);
                    if (event.data.success) {
                        if (buttonEl) buttonEl.classList.add('sent');
                        showNotification('✅ Message sent!', 'success');
                    } else {
                        showNotification('❌ Failed to send message', 'error');
                    }
                    resolve(event.data.success);
                }
            };
            window.addEventListener('message', handler);
            
            // Send message to iframe
            iframe.contentWindow.postMessage({
                source: 'glitched-quick-chat',
                action: 'sendMessage',
                message: message
            }, '*');
            
            // Timeout after 5 seconds
            setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve(false);
            }, 5000);
        });
    }
    
    /**
     * Upload and send image to chat via postMessage to TalkJS iframe
     */
    async function sendChatImage(imageUrl, buttonEl = null) {
        const iframe = getTalkJSIframe();
        if (!iframe || !iframe.contentWindow) {
            showNotification('📷 TalkJS chat not found, sending as link', 'warning');
            return await sendChatMessage(imageUrl, buttonEl);
        }
        
        return new Promise((resolve) => {
            // Listen for response from iframe
            const handler = (event) => {
                if (event.data?.source === 'glitched-talkjs' && event.data?.action === 'imageAttached') {
                    window.removeEventListener('message', handler);
                    if (event.data.success) {
                        if (buttonEl) buttonEl.classList.add('sent');
                        showNotification('📷 Image sent!', 'success');
                    } else {
                        showNotification('❌ Failed to send image', 'error');
                    }
                    resolve(event.data.success);
                }
            };
            window.addEventListener('message', handler);
            
            // Send message to iframe
            iframe.contentWindow.postMessage({
                source: 'glitched-quick-chat',
                action: 'attachImage',
                imageUrl: imageUrl
            }, '*');
            
            // Timeout after 10 seconds (image upload takes longer)
            setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve(false);
            }, 10000);
        });
    }
    
    /**
     * Check if "Mark as received" button exists (order not delivered yet)
     */
    function checkDeliveryStatus() {
        // Look for "Mark as received" button or "Delivered" status
        const buttons = document.querySelectorAll('button, eld-button');
        for (const btn of buttons) {
            const text = btn.textContent?.toLowerCase() || '';
            if (text.includes('mark as received')) {
                return 'pending'; // Still waiting for buyer to confirm
            }
            if (text.includes('delivered')) {
                return 'delivered';
            }
        }
        
        // Check for "Order completed" or similar text
        const pageText = document.body.innerText.toLowerCase();
        if (pageText.includes('order completed') || pageText.includes('order finished')) {
            return 'completed';
        }
        
        return 'unknown';
    }
    
    /**
     * Create Quick Chat panel for order page
     */
    function createQuickChatPanel() {
        if (quickChatPanel) {
            quickChatPanel.remove();
        }
        
        const status = checkDeliveryStatus();
        const showEndDelivery = orderDelivered || status === 'delivered' || status === 'completed';
        
        quickChatPanel = document.createElement('div');
        quickChatPanel.className = 'glitched-quick-chat';
        quickChatPanel.innerHTML = `
            <div class="qc-header">
                <div class="qc-title">
                    <span>👾</span>
                    <span>Glitched Quick Chat</span>
                </div>
                <span class="qc-close" id="qc-close">✕</span>
            </div>
            <div class="qc-buttons">
                <button class="qc-btn welcome" data-msg="welcome">
                    <span class="qc-icon">👋</span>
                    <span class="qc-label">Greet Customer</span>
                </button>
                <button class="qc-btn friend" data-msg="friend">
                    <span class="qc-icon">🤝</span>
                    <span class="qc-label">Friend Request</span>
                </button>
                <button class="qc-btn wait" data-msg="wait">
                    <span class="qc-icon">⏳</span>
                    <span class="qc-label">Please Wait</span>
                </button>
                <button class="qc-btn sorry" data-msg="sorry">
                    <span class="qc-icon">🙏</span>
                    <span class="qc-label">Apologize</span>
                </button>
                ${showEndDelivery ? `
                <div class="qc-divider"></div>
                <div class="qc-status delivered">✅ Order Delivered!</div>
                <button class="qc-btn end-delivery" data-msg="endDelivery">
                    <span class="qc-icon">🎉</span>
                    <span class="qc-label">End Delivery (Thank + Screenshot)</span>
                </button>
                ` : ''}
            </div>
            <div class="qc-status">Click a button to send message</div>
        `;
        
        document.body.appendChild(quickChatPanel);
        
        // Close button
        document.getElementById('qc-close').onclick = () => {
            quickChatPanel.remove();
            quickChatPanel = null;
        };
        
        // Message buttons
        quickChatPanel.querySelectorAll('.qc-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const msgKey = this.dataset.msg;
                if (msgKey === 'endDelivery') {
                    // Send thank you message first
                    await sendChatMessage(QUICK_MESSAGES.endDelivery, this);
                    // Wait a bit then try to send/attach image
                    await new Promise(r => setTimeout(r, 1000));
                    // Upload and send image (with confirmation button handling)
                    await sendChatImage(QUICK_MESSAGES.endDeliveryImage, this);
                } else {
                    const message = QUICK_MESSAGES[msgKey];
                    if (message) {
                        await sendChatMessage(message, this);
                    }
                }
            });
        });
    }
    
    /**
     * Watch for delivery button to appear/disappear
     */
    function watchDeliveryStatus() {
        if (deliveredWatcher) {
            deliveredWatcher.disconnect();
        }
        
        let lastStatus = checkDeliveryStatus();
        
        deliveredWatcher = new MutationObserver(() => {
            const newStatus = checkDeliveryStatus();
            if (newStatus !== lastStatus) {
                lastStatus = newStatus;
                if (newStatus === 'delivered' || newStatus === 'completed') {
                    orderDelivered = true;
                    showNotification('✅ Order delivered! End Delivery button available', 'success');
                    // Recreate panel to show End Delivery button
                    if (quickChatPanel) {
                        createQuickChatPanel();
                    }
                }
            }
        });
        
        deliveredWatcher.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }
    
    /**
     * Initialize Quick Chat on order page
     */
    function initQuickChat() {
        if (!isOrderPage()) return;
        
        logInfo('Order page detected, initializing Quick Chat...');
        
        // Wait for page to load
        setTimeout(() => {
            createQuickChatPanel();
            watchDeliveryStatus();
        }, 2000);
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
    GM_registerMenuCommand('💤 Toggle Sleep Mode', toggleSleepMode);
    
    // ==================== ИНИЦИАЛИЗАЦИЯ ====================
    async function init() {
        logInfo(`Glitched Store v${VERSION} initialized`);
        
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
            
            // Если есть данные с fullQueue - синхронизируем localStorage (cross-domain) - legacy support
            if (offerData?.fullQueue && Array.isArray(offerData.fullQueue)) {
                log(`Syncing queue from URL: ${offerData.fullQueue.length} items`);
                localStorage.setItem('eldoradoQueue', JSON.stringify(offerData.fullQueue));
                localStorage.setItem('eldoradoQueueIndex', '0');
                localStorage.setItem('eldoradoQueueCompleted', '[]');
                localStorage.setItem('eldoradoQueueTimestamp', Date.now().toString());
                // Reload queue state
                getQueueFromStorage();
            }
            
            // v9.8.1: If fromQueue but no fullQueue and no local queue, try to fetch from API
            if (offerData?.fromQueue && offerData?.queueTotal > 0 && queueState.queue.length === 0) {
                log('Queue mode detected but no local queue, trying to fetch from API...');
                const queueLoaded = await tryLoadQueueFromAPI(offerData.farmKey);
                if (queueLoaded) {
                    getQueueFromStorage();
                }
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
            // v9.8.6: Start real-time sync with panel
            setTimeout(startRealTimeSync, 3000); // Start after initial load
        } else {
            setTimeout(showAuthPanel, 500);
        }
        
        setupMutationObserver();
        
        // Watch for offer deletions on dashboard
        if (isDashboard) {
            setTimeout(watchForOfferDeletions, 2000);
        }
        
        // Initialize Quick Chat on order pages
        initQuickChat();
    }
    
    // Запуск - быстрая инициализация
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
    } else {
        setTimeout(init, 100);
    }
})();
