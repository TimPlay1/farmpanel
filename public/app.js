// API Base URL - auto-detect for local dev or production
const API_BASE = window.location.hostname === 'localhost' 
    ? '/api' 
    : '/api';

// Brainrot images base URL
const BRAINROT_IMAGES_BASE = window.location.origin + '/brainrots';

// State
let state = {
    currentKey: null,
    savedKeys: [],
    farmersData: {},
    brainrotImages: {},
    eldoradoPrices: {}, // Кэш цен Eldorado по ключу (name_income)
    brainrotPrices: {}, // Кэш цен по имени брейнрота для отображения
    previousPrices: {}, // Предыдущие цены для расчёта % изменения
    previousTotalValue: null, // Предыдущее общее значение
    avatarCache: {} // Кэш аватаров по userId
};

// Кэш цен Eldorado (время жизни 5 минут)
const PRICE_CACHE_TTL = 5 * 60 * 1000;
const PRICE_STORAGE_KEY = 'eldoradoPriceCache';
const PREVIOUS_PRICES_KEY = 'previousPricesCache';
const AVATAR_STORAGE_KEY = 'avatarCache';

/**
 * Загрузить кэш аватаров из localStorage
 */
function loadAvatarCache() {
    try {
        const stored = localStorage.getItem(AVATAR_STORAGE_KEY);
        if (stored) {
            state.avatarCache = JSON.parse(stored);
            console.log(`Loaded ${Object.keys(state.avatarCache).length} avatars from cache`);
        }
    } catch (e) {
        console.warn('Failed to load avatar cache:', e);
    }
}

/**
 * Сохранить аватар в кэш
 */
function saveAvatarToCache(userId, avatarUrl) {
    state.avatarCache[userId] = {
        url: avatarUrl,
        timestamp: Date.now()
    };
    try {
        localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(state.avatarCache));
    } catch (e) {
        console.warn('Failed to save avatar cache:', e);
    }
}

/**
 * Получить аватар из кэша (действителен 24 часа)
 */
function getCachedAvatar(userId) {
    const cached = state.avatarCache[userId];
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
        return cached.url;
    }
    return null;
}

/**
 * Загрузить кэш цен из MongoDB
 */
async function loadPricesFromServer() {
    // Глобальный кэш - не привязан к farmKey
    try {
        const response = await fetch(`${API_BASE}/prices`);
        if (response.ok) {
            const data = await response.json();
            if (data.prices && Object.keys(data.prices).length > 0) {
                // Сохраняем текущие цены как предыдущие перед загрузкой новых
                savePreviousPrices();
                
                // Загружаем цены в state
                for (const [key, priceData] of Object.entries(data.prices)) {
                    state.brainrotPrices[key] = priceData;
                }
                console.log(`Loaded ${Object.keys(data.prices).length} prices from global server cache`);
                return true;
            }
        }
    } catch (e) {
        console.warn('Failed to load prices from server:', e);
    }
    return false;
}

/**
 * Сохранить кэш цен в MongoDB
 */
async function savePricesToServer() {
    if (!state.currentKey) return;
    
    try {
        const pricesToSave = {};
        for (const [key, data] of Object.entries(state.brainrotPrices)) {
            if (data && data.suggestedPrice && !data.error) {
                pricesToSave[key] = {
                    suggestedPrice: data.suggestedPrice,
                    competitorPrice: data.competitorPrice,
                    competitorIncome: data.competitorIncome,
                    priceSource: data.priceSource,
                    _timestamp: data._timestamp || Date.now()
                };
            }
        }
        
        // Рассчитываем общую стоимость для синхронизации
        const data = state.farmersData[state.currentKey];
        let totalValue = 0;
        if (data && data.accounts) {
            data.accounts.forEach(account => {
                if (account.brainrots) {
                    totalValue += calculateAccountValue(account);
                }
            });
        }
        
        if (Object.keys(pricesToSave).length > 0) {
            await fetch(`${API_BASE}/prices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    farmKey: state.currentKey,
                    prices: pricesToSave,
                    totalValue: totalValue
                })
            });
            console.log(`Saved ${Object.keys(pricesToSave).length} prices and totalValue $${totalValue.toFixed(2)} to server`);
        }
    } catch (e) {
        console.warn('Failed to save prices to server:', e);
    }
}

/**
 * Загрузить кэш цен из localStorage
 */
function loadPriceCacheFromStorage() {
    try {
        const stored = localStorage.getItem(PRICE_STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            const now = Date.now();
            
            // Загружаем только не истёкшие записи
            for (const [name, entry] of Object.entries(data.brainrotPrices || {})) {
                if (entry.timestamp && now - entry.timestamp < PRICE_CACHE_TTL) {
                    state.brainrotPrices[name] = entry.data;
                    // Также сохраняем timestamp для проверки обновления
                    state.brainrotPrices[name]._timestamp = entry.timestamp;
                }
            }
            
            console.log(`Loaded ${Object.keys(state.brainrotPrices).length} prices from localStorage`);
        }
        
        // Загружаем предыдущие цены для отображения % изменения
        const prevStored = localStorage.getItem(PREVIOUS_PRICES_KEY);
        if (prevStored) {
            state.previousPrices = JSON.parse(prevStored);
            console.log(`Loaded ${Object.keys(state.previousPrices).length} previous prices`);
        }
    } catch (e) {
        console.warn('Failed to load price cache from storage:', e);
    }
}

/**
 * Сохранить кэш цен в localStorage
 */
function savePriceCacheToStorage() {
    try {
        const toStore = {
            brainrotPrices: {}
        };
        
        const now = Date.now();
        for (const [name, data] of Object.entries(state.brainrotPrices)) {
            if (data && !data.error) {
                toStore.brainrotPrices[name] = {
                    data: data,
                    timestamp: data._timestamp || now
                };
            }
        }
        
        localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(toStore));
    } catch (e) {
        console.warn('Failed to save price cache to storage:', e);
    }
}

/**
 * Проверить нужно ли обновить цену (старше 5 минут)
 */
function isPriceStale(priceData) {
    if (!priceData || !priceData._timestamp) return true;
    return Date.now() - priceData._timestamp > PRICE_CACHE_TTL;
}

/**
 * Рассчитать общую стоимость всех брейнротов
 */
function calculateTotalValue(brainrots) {
    let total = 0;
    for (const b of brainrots) {
        const income = normalizeIncomeForApi(b.income, b.incomeText);
        const cacheKey = getPriceCacheKey(b.name, income);
        const priceData = state.brainrotPrices[cacheKey];
        if (priceData && priceData.suggestedPrice) {
            total += priceData.suggestedPrice;
        }
    }
    return total;
}

/**
 * Рассчитать стоимость брейнротов для аккаунта
 */
function calculateAccountValue(account) {
    if (!account.brainrots) return 0;
    return calculateTotalValue(account.brainrots.map(b => ({
        ...b,
        income: b.income,
        incomeText: b.incomeText
    })));
}

/**
 * Сохранить предыдущие цены перед обновлением
 */
function savePreviousPrices() {
    for (const [key, data] of Object.entries(state.brainrotPrices)) {
        if (data && data.suggestedPrice) {
            state.previousPrices[key] = data.suggestedPrice;
        }
    }
    // Сохраняем в localStorage
    try {
        localStorage.setItem(PREVIOUS_PRICES_KEY, JSON.stringify(state.previousPrices));
    } catch (e) {
        console.warn('Failed to save previous prices:', e);
    }
}

/**
 * Получить % изменения цены
 */
function getPriceChangePercent(cacheKey, newPrice) {
    const oldPrice = state.previousPrices[cacheKey];
    if (!oldPrice || oldPrice === newPrice) return null;
    const change = ((newPrice - oldPrice) / oldPrice) * 100;
    return change;
}

/**
 * Форматировать % изменения
 */
function formatPriceChange(percent) {
    if (percent === null || percent === undefined || isNaN(percent)) return '';
    const sign = percent >= 0 ? '+' : '';
    const colorClass = percent >= 0 ? 'price-change-up' : 'price-change-down';
    return `<span class="${colorClass}">${sign}${percent.toFixed(1)}%</span>`;
}

// Load brainrot images mapping
async function loadBrainrotMapping() {
    try {
        const response = await fetch('/brainrots-mapping.json');
        if (response.ok) {
            state.brainrotImages = await response.json();
            console.log(`Loaded ${Object.keys(state.brainrotImages).length} brainrot images`);
        }
    } catch (e) {
        console.warn('Could not load brainrot mapping:', e);
    }
}

// Get brainrot image URL
function getBrainrotImageUrl(name) {
    if (!name) return null;
    const normalized = name.toLowerCase().trim();
    const image = state.brainrotImages[normalized] || 
                  state.brainrotImages[normalized.replace(/\s+/g, '_')] ||
                  state.brainrotImages[normalized.replace(/\s+/g, '')];
    return image ? `${BRAINROT_IMAGES_BASE}/${image}` : null;
}

// ===============================================
// ELDORADO PRICE SERVICE
// ===============================================

/**
 * Извлекает название пита из имени брейнрота
 * @param {string} name - полное имя брейнрота
 * @returns {string} - название пита
 */
function extractPitName(name) {
    if (!name) return 'other';
    
    // Известные питы (можно расширять)
    const knownPits = [
        'pot hotspot', 'lucky fountain', 'mythic aurora', 'atlantean',
        'crystal cavern', 'tech terrace', 'cosmic corner', 'nature nook',
        'fire pit', 'ice pit', 'void pit', 'rainbow pit'
    ];
    
    const lowerName = name.toLowerCase();
    
    for (const pit of knownPits) {
        if (lowerName.includes(pit)) {
            return pit;
        }
    }
    
    return 'other';
}

/**
 * Парсит доходность из incomeText
 * @param {string} incomeText - например "$112.5M/s"
 * @returns {number} - доходность в M/s
 */
function parseIncomeValue(incomeText) {
    if (!incomeText) return 0;
    
    // Убираем пробелы и приводим к нижнему регистру
    const clean = incomeText.replace(/\s+/g, '').toLowerCase();
    
    // Паттерны: $112.5m/s, 112.5m/s, $112.5 m/s
    const match = clean.match(/\$?([\d.]+)m/);
    if (match) {
        return parseFloat(match[1]);
    }
    
    return 0;
}

/**
 * Конвертирует raw income в M/s для API
 * income может быть большим числом (645000000) или уже в M/s (645)
 */
function normalizeIncomeForApi(income, incomeText) {
    // Если есть incomeText - парсим оттуда (самый надёжный способ)
    if (incomeText) {
        const parsed = parseIncomeValue(incomeText);
        if (parsed > 0) return parsed;
    }
    
    // Если income очень большой (>10000) - это сырое значение, делим на 1M
    if (income > 10000) {
        return Math.round(income / 1000000 * 10) / 10; // округляем до 0.1
    }
    
    // Иначе income уже в M/s
    return income;
}

/**
 * Получить ключ кэша для цены (имя + income)
 */
function getPriceCacheKey(name, income) {
    // Округляем income до 10 для группировки близких значений
    const roundedIncome = Math.floor(income / 10) * 10;
    return `${name.toLowerCase()}_${roundedIncome}`;
}

/**
 * Получить цену с Eldorado для брейнрота
 * @param {string} brainrotName - имя брейнрота
 * @param {number} income - доходность M/s
 * @returns {Promise<object>} - данные о цене
 */
async function fetchEldoradoPrice(brainrotName, income) {
    const cacheKey = getPriceCacheKey(brainrotName, income);
    
    // Проверяем кэш
    const cached = state.eldoradoPrices[cacheKey];
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
        return cached.data;
    }
    
    try {
        const params = new URLSearchParams({
            name: brainrotName,
            income: income.toString()
        });
        
        const response = await fetch(`${API_BASE}/eldorado-price?${params}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch price');
        }
        
        const data = await response.json();
        
        // Сохраняем в кэш
        state.eldoradoPrices[cacheKey] = {
            data: data,
            timestamp: Date.now()
        };
        
        return data;
    } catch (error) {
        console.warn('Error fetching Eldorado price:', error);
        return null;
    }
}

/**
 * Получить цены для списка брейнротов
 * @param {Array} brainrots - [{name, income}]
 * @returns {Promise<Map>} - Map с ценами по ключу name
 */
async function fetchBulkEldoradoPrices(brainrots) {
    const pricesMap = new Map();
    
    // Группируем по уникальным названиям брейнротов
    const uniqueRequests = new Map();
    
    for (const b of brainrots) {
        // Используем полное имя брейнрота для поиска на Eldorado
        const brainrotName = b.name;
        // Нормализуем income к M/s
        const income = normalizeIncomeForApi(b.income, b.incomeText);
        const cacheKey = getPriceCacheKey(brainrotName, income);
        
        if (!uniqueRequests.has(cacheKey)) {
            uniqueRequests.set(cacheKey, { brainrotName, income, brainrots: [] });
        }
        uniqueRequests.get(cacheKey).brainrots.push(b.name);
    }
    
    // Получаем цены для уникальных запросов
    const requests = Array.from(uniqueRequests.values());
    
    // Ограничиваем параллельные запросы
    const batchSize = 5;
    for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        
        const results = await Promise.all(
            batch.map(req => fetchEldoradoPrice(req.brainrotName, req.income))
        );
        
        // Связываем результаты с брейнротами
        results.forEach((result, idx) => {
            const req = batch[idx];
            if (result) {
                for (const brainrotFullName of req.brainrots) {
                    pricesMap.set(brainrotFullName, result);
                }
            }
        });
        
        // Небольшая задержка между батчами
        if (i + batchSize < requests.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    return pricesMap;
}

/**
 * Форматировать цену для отображения
 */
function formatPrice(price) {
    if (!price || price <= 0) return '—';
    return '$' + price.toFixed(2);
}

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const farmKeyInput = document.getElementById('farmKeyInput');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const currentFarmerEl = document.getElementById('currentFarmer');

const navTabs = document.querySelectorAll('.nav-tab');
const views = document.querySelectorAll('.view');

const statsEls = {
    totalAccounts: document.getElementById('totalAccounts'),
    onlineAccounts: document.getElementById('onlineAccounts'),
    totalIncome: document.getElementById('totalIncome'),
    totalValue: document.getElementById('totalValue'),
    totalValueChange: document.getElementById('totalValueChange'),
    totalBrainrots: document.getElementById('totalBrainrots')
};
const accountsGridEl = document.getElementById('accountsGrid');
const accountsListEl = document.getElementById('accountsList');
const farmKeysListEl = document.getElementById('farmKeysList');

const addKeyBtn = document.getElementById('addKeyBtn');
const addKeyModal = document.getElementById('addKeyModal');
const newKeyInput = document.getElementById('newKeyInput');
const modalError = document.getElementById('modalError');
const closeModal = document.getElementById('closeModal');
const cancelAddKey = document.getElementById('cancelAddKey');
const confirmAddKey = document.getElementById('confirmAddKey');

const editUsernameModal = document.getElementById('editUsernameModal');
const usernameInput = document.getElementById('usernameInput');
const usernameError = document.getElementById('usernameError');
const closeUsernameModal = document.getElementById('closeUsernameModal');
const cancelEditUsername = document.getElementById('cancelEditUsername');
const confirmEditUsername = document.getElementById('confirmEditUsername');

let editingKeyForUsername = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadBrainrotMapping();
    loadState();
    loadPriceCacheFromStorage(); // Загружаем кэш цен из localStorage
    loadAvatarCache(); // Загружаем кэш аватаров
    setupEventListeners();
    
    if (state.currentKey && state.savedKeys.length > 0) {
        showMainApp();
        // Пробуем загрузить цены с сервера для быстрого отображения
        loadPricesFromServer().then(loaded => {
            if (loaded) {
                console.log('Loaded prices from server cache');
                // Обновляем UI с загруженными ценами
                updateUI();
                renderFarmKeys();
            }
        });
        // Загружаем данные всех фермеров для отображения в Farm Keys
        fetchAllFarmersData();
        startPolling();
    } else {
        showLoginScreen();
    }
});

// State Management
function loadState() {
    try {
        const saved = localStorage.getItem('farmerPanelState');
        if (saved) {
            const parsed = JSON.parse(saved);
            state.currentKey = parsed.currentKey || null;
            state.savedKeys = parsed.savedKeys || [];
        }
    } catch (e) {
        console.error('Failed to load state:', e);
    }
}

function saveState() {
    try {
        localStorage.setItem('farmerPanelState', JSON.stringify({
            currentKey: state.currentKey,
            savedKeys: state.savedKeys
        }));
    } catch (e) {
        console.error('Failed to save state:', e);
    }
}

// Event Listeners
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', handleLogin);
    
    // Logout
    logoutBtn.addEventListener('click', handleLogout);
    
    // Navigation
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });
    
    // Add key modal
    addKeyBtn.addEventListener('click', () => openModal(addKeyModal));
    closeModal.addEventListener('click', () => closeModalFn(addKeyModal));
    cancelAddKey.addEventListener('click', () => closeModalFn(addKeyModal));
    confirmAddKey.addEventListener('click', handleAddKey);
    addKeyModal.querySelector('.modal-overlay').addEventListener('click', () => closeModalFn(addKeyModal));
    
    // Edit username modal
    closeUsernameModal.addEventListener('click', () => closeModalFn(editUsernameModal));
    cancelEditUsername.addEventListener('click', () => closeModalFn(editUsernameModal));
    confirmEditUsername.addEventListener('click', handleEditUsername);
    editUsernameModal.querySelector('.modal-overlay').addEventListener('click', () => closeModalFn(editUsernameModal));
    
    // Format key input
    farmKeyInput.addEventListener('input', formatKeyInput);
    newKeyInput.addEventListener('input', formatKeyInput);
    
    // Horizontal scroll with mouse wheel for brainrots-scroll elements
    document.addEventListener('wheel', (e) => {
        const scrollContainer = e.target.closest('.brainrots-scroll');
        if (scrollContainer) {
            e.preventDefault();
            scrollContainer.scrollLeft += e.deltaY;
        }
    }, { passive: false });
}

function formatKeyInput(e) {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let formatted = 'FARM-';
    
    if (value.startsWith('FARM')) {
        value = value.slice(4);
    }
    
    for (let i = 0; i < value.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) {
            formatted += '-';
        }
        formatted += value[i];
    }
    
    e.target.value = formatted;
}

// Auth
async function handleLogin(e) {
    e.preventDefault();
    const key = farmKeyInput.value.trim();
    
    if (!key) {
        loginError.textContent = 'Please enter a farm key';
        return;
    }
    
    loginError.textContent = 'Validating...';
    
    try {
        const response = await fetch(`${API_BASE}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ farmKey: key })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            loginError.textContent = data.error || 'Invalid farm key';
            return;
        }
        
        // Add key to saved keys if not exists
        if (!state.savedKeys.find(k => k.farmKey === key)) {
            state.savedKeys.push({
                farmKey: key,
                username: data.username,
                avatar: data.avatar,
                addedAt: new Date().toISOString()
            });
        }
        
        state.currentKey = key;
        saveState();
        
        showMainApp();
        startPolling();
        
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'Connection error. Please try again.';
    }
}

function handleLogout() {
    state.currentKey = null;
    state.farmersData = {};
    saveState();
    showLoginScreen();
    stopPolling();
}

// Views
function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    mainApp.classList.add('hidden');
    farmKeyInput.value = '';
    loginError.textContent = '';
}

function showMainApp() {
    loginScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    updateCurrentFarmer();
    renderFarmKeys();
}

function switchView(viewName) {
    navTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === viewName);
    });
    
    views.forEach(view => {
        view.classList.toggle('active', view.id === `${viewName}View`);
    });
    
    // При переключении на Farm Keys - обновляем данные всех фермеров
    if (viewName === 'farmKeys') {
        fetchAllFarmersData();
    }
}

// Polling
let pollingInterval = null;

function startPolling() {
    fetchFarmerData();
    pollingInterval = setInterval(fetchFarmerData, 5000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

async function fetchFarmerData() {
    if (!state.currentKey) return;
    
    try {
        const response = await fetch(`${API_BASE}/sync?key=${encodeURIComponent(state.currentKey)}`);
        
        if (!response.ok) {
            console.error('Failed to fetch farmer data');
            return;
        }
        
        const data = await response.json();
        state.farmersData[state.currentKey] = data;
        
        // Update saved key info
        const savedKey = state.savedKeys.find(k => k.farmKey === state.currentKey);
        if (savedKey) {
            savedKey.username = data.username;
            savedKey.avatar = data.avatar;
            saveState();
        }
        
        updateUI();
        
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

/**
 * Загрузить данные всех сохранённых фермеров для отображения в Farm Keys
 */
async function fetchAllFarmersData() {
    const promises = state.savedKeys.map(async (key) => {
        // Пропускаем текущий ключ - он уже загружен
        if (key.farmKey === state.currentKey && state.farmersData[key.farmKey]) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/sync?key=${encodeURIComponent(key.farmKey)}`);
            if (response.ok) {
                const data = await response.json();
                state.farmersData[key.farmKey] = data;
                
                // Обновляем savedKey
                key.username = data.username;
                key.avatar = data.avatar;
            }
        } catch (e) {
            console.warn(`Failed to fetch data for ${key.farmKey}:`, e);
        }
    });
    
    await Promise.all(promises);
    saveState();
    renderFarmKeys();
}

// Check if account is online based on lastUpdate timestamp
function isAccountOnline(account) {
    if (!account) return false;
    if (!account.lastUpdate) return account.isOnline || false;
    
    try {
        const isoString = account.lastUpdate.replace(' ', 'T');
        const lastUpdateTime = new Date(isoString).getTime();
        const now = Date.now();
        const diffSeconds = (now - lastUpdateTime) / 1000;
        
        // If updated within last 60 seconds, consider online
        return diffSeconds < 60;
    } catch (e) {
        return account.isOnline || false;
    }
}

// Format time ago for display
function formatTimeAgo(lastUpdate) {
    if (!lastUpdate) return 'Never';
    
    try {
        const isoString = lastUpdate.replace(' ', 'T');
        const lastUpdateTime = new Date(isoString).getTime();
        const now = Date.now();
        const diffSeconds = Math.floor((now - lastUpdateTime) / 1000);
        
        if (diffSeconds < 60) return 'Just now';
        if (diffSeconds < 3600) return Math.floor(diffSeconds / 60) + 'm ago';
        if (diffSeconds < 86400) return Math.floor(diffSeconds / 3600) + 'h ago';
        return Math.floor(diffSeconds / 86400) + 'd ago';
    } catch (e) {
        return lastUpdate;
    }
}

// Cache for avatar URLs to avoid refetching
const avatarCache = {};

// Generate unique key for account card
function getAccountCardId(account) {
    return 'account-' + (account.playerName || '').replace(/[^a-zA-Z0-9]/g, '_');
}

// Smart update - only update changed elements in existing card
function updateAccountCard(cardEl, account) {
    if (!cardEl) return false;
    
    const isOnline = account._isOnline;
    const statusClass = isOnline ? 'online' : 'offline';
    const statusText = isOnline ? 'Online' : 'Offline';
    const actionText = isOnline ? (account.action || account.status || '') : '';
    
    // Update status badge
    const statusBadge = cardEl.querySelector('.status-badge');
    if (statusBadge) {
        statusBadge.className = 'status-badge ' + statusClass;
        const icon = statusBadge.querySelector('i');
        if (icon && icon.nextSibling) {
            icon.nextSibling.textContent = ' ' + statusText;
        }
    }
    
    // Update action
    const statusContainer = cardEl.querySelector('.account-status');
    if (statusContainer) {
        let actionEl = statusContainer.querySelector('.account-action');
        if (isOnline && actionText) {
            if (actionEl) {
                actionEl.textContent = actionText;
            } else {
                actionEl = document.createElement('span');
                actionEl.className = 'account-action';
                actionEl.textContent = actionText;
                statusContainer.appendChild(actionEl);
            }
        } else if (actionEl) {
            actionEl.remove();
        }
    }
    
    // Update stats
    const statValues = cardEl.querySelectorAll('.account-stat-value');
    if (statValues[0]) {
        const newIncome = account.totalIncomeFormatted || formatIncome(account.totalIncome || 0);
        if (statValues[0].textContent !== newIncome) {
            statValues[0].textContent = newIncome;
        }
    }
    if (statValues[1]) {
        const newCount = String(account.totalBrainrots || 0);
        if (statValues[1].textContent !== newCount) {
            statValues[1].textContent = newCount;
        }
    }
    
    // Update footer time
    const footer = cardEl.querySelector('.account-footer');
    if (footer) {
        const timeText = formatTimeAgo(account.lastUpdate);
        const currentTime = footer.textContent.trim();
        if (!currentTime.includes(timeText)) {
            footer.innerHTML = `<i class="fas fa-clock"></i> ${timeText}`;
        }
    }
    
    return true;
}

// UI Updates
function updateUI() {
    const data = state.farmersData[state.currentKey];
    if (!data) return;
    
    const accounts = data.accounts || [];
    
    // Calculate _isOnline for each account based on lastUpdate
    accounts.forEach(account => {
        account._isOnline = isAccountOnline(account);
    });
    
    // Update stats (use calculated online status)
    const online = accounts.filter(a => a._isOnline).length;
    const totalIncome = accounts.reduce((sum, a) => sum + (a.totalIncome || 0), 0);
    const totalBrainrots = accounts.reduce((sum, a) => sum + (a.totalBrainrots || 0), 0);
    
    // Собираем все брейнроты для расчета общей стоимости
    const allBrainrots = [];
    accounts.forEach(account => {
        if (account.brainrots) {
            account.brainrots.forEach(b => allBrainrots.push(b));
        }
    });
    const totalValue = calculateTotalValue(allBrainrots);
    
    statsEls.totalAccounts.textContent = accounts.length;
    statsEls.onlineAccounts.textContent = online;
    statsEls.totalIncome.textContent = formatIncome(totalIncome);
    statsEls.totalBrainrots.textContent = totalBrainrots;
    
    // Update total value with change indicator
    if (statsEls.totalValue) {
        statsEls.totalValue.textContent = totalValue > 0 ? `$${totalValue.toFixed(2)}` : '$0.00';
        
        // Show % change
        if (statsEls.totalValueChange && state.previousTotalValue !== null && state.previousTotalValue > 0 && totalValue > 0) {
            const changePercent = ((totalValue - state.previousTotalValue) / state.previousTotalValue) * 100;
            if (Math.abs(changePercent) > 0.1) {
                statsEls.totalValueChange.innerHTML = formatPriceChange(changePercent);
            } else {
                statsEls.totalValueChange.innerHTML = '';
            }
        }
    }
    
    // Render accounts
    renderAccountsGrid(accounts);
    renderAccountsList(accounts);
    updateCurrentFarmer();
    
    // Update collection view
    updateCollection();
}

function updateCurrentFarmer() {
    const savedKey = state.savedKeys.find(k => k.farmKey === state.currentKey);
    if (!savedKey) return;
    
    const avatar = savedKey.avatar || { icon: 'fa-user', color: '#6366f1' };
    const shortKey = state.currentKey.split('-').slice(-1)[0];
    
    currentFarmerEl.innerHTML = `
        <div class="farmer-avatar" style="background: ${avatar.color}20; color: ${avatar.color}">
            <i class="fas ${avatar.icon}"></i>
        </div>
        <div class="farmer-info">
            <div class="farmer-name">${savedKey.username || 'Unknown'}</div>
            <div class="farmer-key">...${shortKey}</div>
        </div>
    `;
}

// Render Functions
async function renderAccountsGrid(accounts) {
    if (!accounts || accounts.length === 0) {
        accountsGridEl.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1">
                <i class="fas fa-users-slash"></i>
                <h3>No accounts found</h3>
                <p>Start the farm script to see your accounts here.</p>
            </div>
        `;
        return;
    }
    
    // Получаем аватары из данных сервера
    const data = state.farmersData[state.currentKey];
    const serverAvatars = data?.accountAvatars || {};
    
    // Применяем серверные аватары к аккаунтам
    accounts.forEach(account => {
        if (account.userId) {
            const avatarData = serverAvatars[String(account.userId)];
            if (avatarData && avatarData.url) {
                account.avatarUrl = avatarData.url;
                // Также сохраняем в локальный кэш для быстрого доступа
                saveAvatarToCache(account.userId, avatarData.url);
            } else {
                // Fallback на локальный кэш
                const cachedAvatar = getCachedAvatar(account.userId);
                if (cachedAvatar) {
                    account.avatarUrl = cachedAvatar;
                }
            }
        }
    });
    
    // Check if we can do smart update (same accounts exist)
    const existingCards = accountsGridEl.querySelectorAll('.account-card');
    const existingPlayerNames = new Set();
    existingCards.forEach(card => {
        const name = card.dataset.player;
        if (name) existingPlayerNames.add(name);
    });
    
    const newPlayerNames = new Set(accounts.map(a => a.playerName));
    const sameAccounts = existingPlayerNames.size === newPlayerNames.size && 
        existingPlayerNames.size > 0 &&
        [...existingPlayerNames].every(name => newPlayerNames.has(name));
    
    if (sameAccounts) {
        // Smart update - just update values in existing cards
        accounts.forEach(account => {
            const cardId = getAccountCardId(account);
            const cardEl = document.getElementById(cardId);
            updateAccountCard(cardEl, account);
        });
        return;
    }
    
    // Full render (first time or accounts changed)
    accountsGridEl.innerHTML = accounts.map(account => {
        const brainrotsHtml = (account.brainrots || []).slice(0, 10).map(b => {
            const imageUrl = b.imageUrl || getBrainrotImageUrl(b.name);
            return `
                <div class="brainrot-mini" title="${b.name}\n${b.incomeText || ''}">
                    <div class="brainrot-mini-img">
                        ${imageUrl 
                            ? `<img src="${imageUrl}" alt="${b.name}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-brain\\'></i>'">`
                            : '<i class="fas fa-brain" style="color: var(--text-muted); font-size: 1.5rem;"></i>'
                        }
                    </div>
                    <div class="brainrot-mini-name">${truncate(b.name, 8)}</div>
                    <div class="brainrot-mini-income">${b.incomeText || ''}</div>
                </div>
            `;
        }).join('');
        
        const isOnline = account._isOnline;
        const statusClass = isOnline ? 'online' : 'offline';
        const statusText = isOnline ? 'Online' : 'Offline';
        const actionText = isOnline ? (account.action || account.status || '') : '';
        
        const avatarSrc = account.avatarUrl || getDefaultAvatar(account.playerName);
        const accountValue = calculateAccountValue(account);
        
        return `
            <div class="account-card" id="${getAccountCardId(account)}" data-player="${account.playerName}">
                <div class="account-header">
                    <div class="account-avatar">
                        <img src="${avatarSrc}" alt="${account.playerName}" onerror="this.src='${getDefaultAvatar(account.playerName)}'">
                    </div>
                    <div class="account-info">
                        <div class="account-name">${account.playerName || 'Unknown'}</div>
                        <div class="account-status">
                            <span class="status-badge ${statusClass}">
                                <i class="fas fa-circle"></i>
                                ${statusText}
                            </span>
                            ${isOnline && actionText ? `<span class="account-action">${actionText}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="account-stats">
                    <div class="account-stat">
                        <div class="account-stat-value">${account.totalIncomeFormatted || formatIncome(account.totalIncome || 0)}</div>
                        <div class="account-stat-label">Income</div>
                    </div>
                    <div class="account-stat">
                        <div class="account-stat-value">${account.totalBrainrots || 0}</div>
                        <div class="account-stat-label">Brainrots</div>
                    </div>
                    ${accountValue > 0 ? `
                    <div class="account-stat account-value">
                        <div class="account-stat-value">$${accountValue.toFixed(2)}</div>
                        <div class="account-stat-label">Value</div>
                    </div>
                    ` : ''}
                </div>
                ${account.brainrots && account.brainrots.length > 0 ? `
                    <div class="account-brainrots">
                        <div class="brainrots-title">
                            <i class="fas fa-brain"></i>
                            Top Brainrots
                        </div>
                        <div class="brainrots-scroll">
                            ${brainrotsHtml}
                        </div>
                    </div>
                ` : ''}
                <div class="account-footer">
                    <i class="fas fa-clock"></i>
                    ${formatTimeAgo(account.lastUpdate)}
                </div>
            </div>
        `;
    }).join('');
}

function renderAccountsList(accounts) {
    if (!accounts || accounts.length === 0) {
        accountsListEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-list"></i>
                <h3>No accounts</h3>
                <p>Accounts will appear here when the farm script is running.</p>
            </div>
        `;
        return;
    }
    
    // Получаем аватары из данных сервера
    const data = state.farmersData[state.currentKey];
    const serverAvatars = data?.accountAvatars || {};
    
    accountsListEl.innerHTML = accounts.map(account => {
        // Получаем аватар из серверных данных
        let avatarSrc = getDefaultAvatar(account.playerName);
        if (account.userId) {
            const avatarData = serverAvatars[String(account.userId)];
            if (avatarData && avatarData.url) {
                avatarSrc = avatarData.url;
            } else if (account.avatarUrl) {
                avatarSrc = account.avatarUrl;
            } else {
                const cached = getCachedAvatar(account.userId);
                if (cached) avatarSrc = cached;
            }
        }
        
        const isOnline = account._isOnline;
        const statusClass = isOnline ? 'online' : 'offline';
        const actionText = isOnline ? (account.action || account.status || 'Idle') : 'Offline';
        const accountValue = calculateAccountValue(account);
        
        return `
            <div class="account-list-item">
                <div class="account-list-avatar">
                    <img src="${avatarSrc}" alt="${account.playerName}" onerror="this.src='${getDefaultAvatar(account.playerName)}'">
                </div>
                <div class="account-list-info">
                    <h4>${account.playerName || 'Unknown'}</h4>
                    <p>${actionText}</p>
                </div>
                <span class="status-badge ${statusClass}">
                    <i class="fas fa-circle"></i>
                    ${isOnline ? 'Online' : 'Offline'}
                </span>
                <div class="account-list-income">
                    <div class="value">${account.totalIncomeFormatted || formatIncome(account.totalIncome || 0)}</div>
                    <div class="label">INCOME</div>
                </div>
                <div class="account-list-brainrots">
                    <div class="value">${account.totalBrainrots || 0}</div>
                    <div class="label">BRAINROTS</div>
                </div>
                ${accountValue > 0 ? `
                <div class="account-list-value">
                    <div class="value">$${accountValue.toFixed(2)}</div>
                    <div class="label">VALUE</div>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function renderFarmKeys() {
    if (state.savedKeys.length === 0) {
        farmKeysListEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-key"></i>
                <h3>No saved farm keys</h3>
                <p>Add farm keys to monitor multiple farmers.</p>
            </div>
        `;
        return;
    }
    
    farmKeysListEl.innerHTML = state.savedKeys.map(key => {
        const isActive = key.farmKey === state.currentKey;
        const avatar = key.avatar || { icon: 'fa-user', color: '#6366f1' };
        const data = state.farmersData[key.farmKey];
        const accounts = data?.accounts || [];
        const accountCount = accounts.length;
        
        // Используем totalValue из данных сервера, или рассчитываем локально
        let farmerValue = data?.totalValue || 0;
        
        // Если нет серверного значения и есть локальные цены, рассчитываем
        if (farmerValue === 0 && accounts.length > 0) {
            accounts.forEach(account => {
                if (account.brainrots) {
                    farmerValue += calculateAccountValue(account);
                }
            });
        }
        
        return `
            <div class="farm-key-card ${isActive ? 'active' : ''}" data-key="${key.farmKey}">
                <div class="farm-key-left">
                    <div class="farm-key-avatar" style="background: ${avatar.color}20; color: ${avatar.color}">
                        <i class="fas ${avatar.icon}"></i>
                    </div>
                    <div class="farm-key-info">
                        <div class="farm-key-username">
                            ${key.username || 'Unknown'}
                            <button class="edit-btn" onclick="openEditUsername('${key.farmKey}')" title="Edit username">
                                <i class="fas fa-pen"></i>
                            </button>
                        </div>
                        <div class="farm-key-code">${key.farmKey}</div>
                    </div>
                </div>
                <div class="farm-key-right">
                    <div class="farm-key-stats">
                        <div class="farm-key-accounts">${accountCount}</div>
                        <div class="farm-key-label">accounts</div>
                    </div>
                    ${farmerValue > 0 ? `
                    <div class="farm-key-stats farm-key-value">
                        <div class="farm-key-accounts">$${farmerValue.toFixed(2)}</div>
                        <div class="farm-key-label">value</div>
                    </div>
                    ` : ''}
                    <button class="select-key-btn" onclick="selectFarmKey('${key.farmKey}')">
                        ${isActive ? 'Active' : 'Select'}
                    </button>
                    <button class="delete-key-btn" onclick="deleteFarmKey('${key.farmKey}')" title="Remove key">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Modal Functions
function openModal(modal) {
    modal.classList.remove('hidden');
}

function closeModalFn(modal) {
    modal.classList.add('hidden');
    modalError.textContent = '';
    usernameError.textContent = '';
    newKeyInput.value = '';
    usernameInput.value = '';
}

async function handleAddKey() {
    const key = newKeyInput.value.trim();
    
    if (!key) {
        modalError.textContent = 'Please enter a farm key';
        return;
    }
    
    if (state.savedKeys.find(k => k.farmKey === key)) {
        modalError.textContent = 'This key is already added';
        return;
    }
    
    modalError.textContent = 'Validating...';
    
    try {
        const response = await fetch(`${API_BASE}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ farmKey: key })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            modalError.textContent = data.error || 'Invalid farm key';
            return;
        }
        
        state.savedKeys.push({
            farmKey: key,
            username: data.username,
            avatar: data.avatar,
            addedAt: new Date().toISOString()
        });
        
        saveState();
        renderFarmKeys();
        closeModalFn(addKeyModal);
        
    } catch (error) {
        console.error('Add key error:', error);
        modalError.textContent = 'Connection error. Please try again.';
    }
}

// Global functions for onclick handlers
window.openEditUsername = function(farmKey) {
    editingKeyForUsername = farmKey;
    const key = state.savedKeys.find(k => k.farmKey === farmKey);
    if (key) {
        usernameInput.value = key.username || '';
    }
    openModal(editUsernameModal);
};

async function handleEditUsername() {
    const newUsername = usernameInput.value.trim();
    
    if (!newUsername) {
        usernameError.textContent = 'Please enter a username';
        return;
    }
    
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) {
        usernameError.textContent = '3-20 characters, letters, numbers and underscore only';
        return;
    }
    
    usernameError.textContent = 'Saving...';
    
    try {
        const response = await fetch(`${API_BASE}/username`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                farmKey: editingKeyForUsername,
                username: newUsername 
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            usernameError.textContent = data.error || 'Failed to update username';
            return;
        }
        
        // Update local state
        const key = state.savedKeys.find(k => k.farmKey === editingKeyForUsername);
        if (key) {
            key.username = newUsername;
        }
        
        if (state.farmersData[editingKeyForUsername]) {
            state.farmersData[editingKeyForUsername].username = newUsername;
        }
        
        saveState();
        renderFarmKeys();
        updateCurrentFarmer();
        closeModalFn(editUsernameModal);
        
    } catch (error) {
        console.error('Update username error:', error);
        usernameError.textContent = 'Connection error. Please try again.';
    }
}

window.selectFarmKey = function(farmKey) {
    state.currentKey = farmKey;
    saveState();
    fetchFarmerData();
    renderFarmKeys();
};

window.deleteFarmKey = function(farmKey) {
    if (state.savedKeys.length === 1) {
        alert('You cannot delete the last key. Add another key first or logout.');
        return;
    }
    
    if (!confirm('Are you sure you want to remove this farm key?')) {
        return;
    }
    
    state.savedKeys = state.savedKeys.filter(k => k.farmKey !== farmKey);
    
    if (state.currentKey === farmKey) {
        state.currentKey = state.savedKeys[0]?.farmKey || null;
    }
    
    delete state.farmersData[farmKey];
    
    saveState();
    renderFarmKeys();
    
    if (state.currentKey) {
        fetchFarmerData();
    } else {
        showLoginScreen();
    }
};

// Utility Functions
function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
}

function formatIncome(value) {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T/s`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B/s`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M/s`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K/s`;
    return `$${value}/s`;
}

function getDefaultAvatar(name) {
    const letter = name ? name[0].toUpperCase() : '?';
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a24" width="100" height="100"/><text x="50" y="50" font-size="40" text-anchor="middle" dy=".3em" fill="%236b6b7d">${letter}</text></svg>`;
}

// ==========================================
// ELDORADO PRICE API INTEGRATION
// ==========================================

// орматирование цены
// ==========================================
// COLLECTION VIEW - All Brainrots from all accounts
// ==========================================

// Additional DOM Elements for Collection
const brainrotSearchEl = document.getElementById('brainrotSearch');
const sortDropdown = document.getElementById('sortDropdown');
const accountDropdown = document.getElementById('accountDropdown');
const accountDropdownMenu = document.getElementById('accountDropdownMenu');
const priceFilterDropdown = document.getElementById('priceFilterDropdown');
const brainrotsGridEl = document.getElementById('brainrotsGrid');
const collectionStatsEl = document.getElementById('collectionStats');

// Collection state
let collectionState = {
    allBrainrots: [],
    filteredBrainrots: [],
    searchQuery: '',
    sortBy: 'income-desc',
    accountFilter: 'all',
    priceFilter: 'all',
    pricesLoading: false,
    pricesLoaded: new Set(), // Кэш загруженных цен по имени
    generations: {},  // Stores which brainrots have been generated
    panelColor: null  // Unique color for this panel (based on farmKey)
};

// Custom Dropdown functionality
function initDropdown(dropdown, onChange) {
    if (!dropdown) return;
    
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu');
    
    if (!toggle || !menu) return;
    
    toggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Close other dropdowns
        document.querySelectorAll('.custom-dropdown').forEach(function(d) {
            if (d !== dropdown) {
                const t = d.querySelector('.dropdown-toggle');
                const m = d.querySelector('.dropdown-menu');
                if (t) t.classList.remove('open');
                if (m) m.classList.remove('show');
            }
        });
        
        toggle.classList.toggle('open');
        menu.classList.toggle('show');
    });
    
    menu.addEventListener('click', function(e) {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        
        const value = item.dataset.value;
        const text = item.textContent;
        
        // Update active state
        menu.querySelectorAll('.dropdown-item').forEach(function(i) {
            i.classList.remove('active');
        });
        item.classList.add('active');
        
        // Update toggle text
        toggle.querySelector('span').textContent = text;
        
        // Close dropdown
        toggle.classList.remove('open');
        menu.classList.remove('show');
        
        // Callback
        if (onChange) onChange(value);
    });
}

// Close dropdowns on outside click
document.addEventListener('click', function(e) {
    if (!e.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.custom-dropdown').forEach(function(d) {
            const t = d.querySelector('.dropdown-toggle');
            const m = d.querySelector('.dropdown-menu');
            if (t) t.classList.remove('open');
            if (m) m.classList.remove('show');
        });
    }
});

// ==========================================
// GENERATIONS TRACKING
// ==========================================

// Load generations data for current user
async function loadGenerationsData() {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return;
        
        const response = await fetch(`/api/generations?farmKey=${encodeURIComponent(farmKey)}`);
        const data = await response.json();
        collectionState.generations = data.generations || {};
        console.log('Loaded generations:', Object.keys(collectionState.generations).length);
    } catch (err) {
        console.error('Error loading generations:', err);
        collectionState.generations = {};
    }
}

// Load panel color (single color for entire panel based on farmKey)
async function loadPanelColor() {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) {
            collectionState.panelColor = '#4ade80';
            return;
        }
        
        const response = await fetch(`/api/account-colors?accountIds=${encodeURIComponent(farmKey)}`);
        const result = await response.json();
        // Use the color generated for farmKey
        collectionState.panelColor = result.colors?.[farmKey] || '#4ade80';
        console.log('Panel color:', collectionState.panelColor);
    } catch (err) {
        console.error('Error loading panel color:', err);
        collectionState.panelColor = '#4ade80';
    }
}

// Save generation record
async function saveGeneration(brainrotName, accountId, resultUrl) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return;
        
        const response = await fetch('/api/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                farmKey,
                brainrotName,
                accountId,
                resultUrl,
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        if (data.success) {
            const brainrotKey = brainrotName.toLowerCase().trim();
            collectionState.generations[brainrotKey] = data.generation;
            renderCollection();
        }
    } catch (err) {
        console.error('Error saving generation:', err);
    }
}

// Check if brainrot was generated
function isGenerated(brainrotName) {
    const key = brainrotName.toLowerCase().trim();
    return !!collectionState.generations[key];
}

// Get generation info
function getGenerationInfo(brainrotName) {
    const key = brainrotName.toLowerCase().trim();
    return collectionState.generations[key] || null;
}

// Current brainrot data for generation
let currentSupaBrainrot = null;

// Setup Collection event listeners
function setupCollectionListeners() {
    if (brainrotSearchEl) {
        brainrotSearchEl.addEventListener('input', function(e) {
            collectionState.searchQuery = e.target.value.trim();
            filterAndRenderCollection();
        });
    }

    initDropdown(sortDropdown, function(value) {
        collectionState.sortBy = value;
        filterAndRenderCollection();
    });

    initDropdown(accountDropdown, function(value) {
        collectionState.accountFilter = value;
        filterAndRenderCollection();
    });

    initDropdown(priceFilterDropdown, function(value) {
        collectionState.priceFilter = value;
        filterAndRenderCollection();
    });
}

// Collect all brainrots from all accounts
function collectAllBrainrots() {
    const data = state.farmersData[state.currentKey];
    if (!data || !data.accounts) {
        collectionState.allBrainrots = [];
        return;
    }

    const brainrots = [];
    const accounts = data.accounts;

    for (const account of accounts) {
        if (!account.brainrots) continue;
        
        for (const b of account.brainrots) {
            brainrots.push({
                name: b.name,
                income: b.income || 0,
                incomeText: b.incomeText || '',
                imageUrl: b.imageUrl || getBrainrotImageUrl(b.name),
                accountName: account.playerName || 'Unknown',
                accountId: account.userId
            });
        }
    }

    collectionState.allBrainrots = brainrots;
    updateAccountDropdown(accounts);
}

// Update account filter dropdown
function updateAccountDropdown(accounts) {
    if (!accountDropdownMenu) return;

    const currentValue = collectionState.accountFilter;
    const uniqueAccounts = [...new Set(accounts.map(a => a.playerName))].sort();
    
    let html = '<div class="dropdown-item' + (currentValue === 'all' ? ' active' : '') + '" data-value="all">All Accounts</div>';
    
    for (const name of uniqueAccounts) {
        html += '<div class="dropdown-item' + (currentValue === name ? ' active' : '') + '" data-value="' + name + '">' + name + '</div>';
    }
    
    accountDropdownMenu.innerHTML = html;
}

// Filter and sort brainrots
/**
 * Получить цену брейнрота из кэша
 */
function getBrainrotPrice(brainrot) {
    const income = normalizeIncomeForApi(brainrot.income, brainrot.incomeText);
    const cacheKey = getPriceCacheKey(brainrot.name, income);
    const priceData = state.brainrotPrices[cacheKey];
    return priceData && priceData.suggestedPrice ? priceData.suggestedPrice : null;
}

/**
 * Парсинг поискового запроса для поддержки income фильтров
 */
function parseSearchQuery(query) {
    // Поддержка форматов: >100, <50, 100-200, =150, просто число или текст
    const result = { text: '', incomeFilter: null };
    
    if (!query) return result;
    
    // Проверяем на диапазон (100-200)
    const rangeMatch = query.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
        result.incomeFilter = { type: 'range', min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
        return result;
    }
    
    // Проверяем на сравнение (>100, <50, >=100, <=50, =100)
    const compareMatch = query.match(/^([<>=]+)\s*(\d+\.?\d*)$/);
    if (compareMatch) {
        const op = compareMatch[1];
        const val = parseFloat(compareMatch[2]);
        if (op === '>') result.incomeFilter = { type: 'gt', value: val };
        else if (op === '>=') result.incomeFilter = { type: 'gte', value: val };
        else if (op === '<') result.incomeFilter = { type: 'lt', value: val };
        else if (op === '<=') result.incomeFilter = { type: 'lte', value: val };
        else if (op === '=') result.incomeFilter = { type: 'eq', value: val };
        return result;
    }
    
    // Проверяем на просто число
    const numMatch = query.match(/^(\d+\.?\d*)$/);
    if (numMatch) {
        // Если просто число - ищем точное совпадение или близкое
        result.incomeFilter = { type: 'approx', value: parseFloat(numMatch[1]) };
        return result;
    }
    
    // Иначе это текстовый поиск
    result.text = query.toLowerCase();
    return result;
}

/**
 * Проверка income по фильтру
 */
function matchesIncomeFilter(income, filter) {
    if (!filter) return true;
    
    switch (filter.type) {
        case 'gt': return income > filter.value;
        case 'gte': return income >= filter.value;
        case 'lt': return income < filter.value;
        case 'lte': return income <= filter.value;
        case 'eq': return Math.abs(income - filter.value) < 0.1;
        case 'approx': return Math.abs(income - filter.value) < Math.max(filter.value * 0.1, 5);
        case 'range': return income >= filter.min && income <= filter.max;
        default: return true;
    }
}

function filterAndRenderCollection() {
    let filtered = [...collectionState.allBrainrots];

    // Parse search query
    const searchParsed = parseSearchQuery(collectionState.searchQuery);

    // Filter by search (text or income)
    if (searchParsed.text) {
        filtered = filtered.filter(b => 
            b.name.toLowerCase().includes(searchParsed.text) ||
            b.accountName.toLowerCase().includes(searchParsed.text)
        );
    }
    
    if (searchParsed.incomeFilter) {
        filtered = filtered.filter(b => matchesIncomeFilter(b.income, searchParsed.incomeFilter));
    }

    // Filter by account
    if (collectionState.accountFilter !== 'all') {
        filtered = filtered.filter(b => 
            b.accountName === collectionState.accountFilter
        );
    }

    // Filter by price
    if (collectionState.priceFilter !== 'all') {
        filtered = filtered.filter(b => {
            const price = getBrainrotPrice(b);
            
            switch (collectionState.priceFilter) {
                case 'has-price': return price !== null;
                case 'no-price': return price === null;
                case 'under-1': return price !== null && price < 1;
                case '1-5': return price !== null && price >= 1 && price < 5;
                case '5-10': return price !== null && price >= 5 && price < 10;
                case '10-25': return price !== null && price >= 10 && price < 25;
                case 'over-25': return price !== null && price >= 25;
                default: return true;
            }
        });
    }

    // Sort
    switch (collectionState.sortBy) {
        case 'income-desc':
            filtered.sort((a, b) => b.income - a.income);
            break;
        case 'income-asc':
            filtered.sort((a, b) => a.income - b.income);
            break;
        case 'price-desc':
            filtered.sort((a, b) => {
                const priceA = getBrainrotPrice(a) || 0;
                const priceB = getBrainrotPrice(b) || 0;
                return priceB - priceA;
            });
            break;
        case 'price-asc':
            filtered.sort((a, b) => {
                const priceA = getBrainrotPrice(a) || 0;
                const priceB = getBrainrotPrice(b) || 0;
                return priceA - priceB;
            });
            break;
        case 'name-asc':
            filtered.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            filtered.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'account':
            filtered.sort((a, b) => a.accountName.localeCompare(b.accountName) || b.income - a.income);
            break;
    }

    collectionState.filteredBrainrots = filtered;
    renderCollection();
}

// Render collection
async function renderCollection() {
    if (!brainrotsGridEl) return;

    const brainrots = collectionState.filteredBrainrots;
    
    // Update stats
    if (collectionStatsEl) {
        const uniqueNames = new Set(collectionState.allBrainrots.map(b => b.name.toLowerCase()));
        const totalValue = calculateTotalValue(collectionState.allBrainrots);
        
        let statsHtml = '<span><i class="fas fa-layer-group"></i> ' + collectionState.allBrainrots.length + ' total</span>';
        statsHtml += '<span><i class="fas fa-fingerprint"></i> ' + uniqueNames.size + ' unique</span>';
        if (totalValue > 0) {
            statsHtml += '<span class="total-value"><i class="fas fa-dollar-sign"></i> ' + totalValue.toFixed(2) + '</span>';
        }
        if (collectionState.searchQuery || collectionState.accountFilter !== 'all' || collectionState.priceFilter !== 'all') {
            statsHtml += '<span><i class="fas fa-filter"></i> ' + brainrots.length + ' shown</span>';
        }
        collectionStatsEl.innerHTML = statsHtml;
    }

    if (brainrots.length === 0) {
        brainrotsGridEl.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1">
                <i class="fas fa-search"></i>
                <h3>${collectionState.allBrainrots.length === 0 ? 'No brainrots found' : 'No matches'}</h3>
                <p>${collectionState.allBrainrots.length === 0 
                    ? 'Brainrots will appear here when accounts have them.' 
                    : 'Try adjusting your search or filters.'}</p>
            </div>
        `;
        return;
    }

    // Рендер карточек - используем кэшированные цены если есть
    brainrotsGridEl.innerHTML = brainrots.map((b, index) => {
        const income = normalizeIncomeForApi(b.income, b.incomeText);
        const cacheKey = getPriceCacheKey(b.name, income);
        const cachedPrice = state.brainrotPrices[cacheKey];
        const generated = isGenerated(b.name);
        const genInfo = getGenerationInfo(b.name);
        let priceHtml;
        
        if (cachedPrice && cachedPrice.suggestedPrice) {
            // competitorPrice это цена upper оффера (ближайший конкурент с income >= наш)
            const competitorInfo = cachedPrice.competitorPrice 
                ? `~$${cachedPrice.competitorPrice.toFixed(2)}` 
                : '';
            const priceChange = getPriceChangePercent(cacheKey, cachedPrice.suggestedPrice);
            const changeHtml = formatPriceChange(priceChange);
            priceHtml = `
                <div class="brainrot-price" title="${cachedPrice.priceSource || ''}">
                    <i class="fas fa-tag"></i>
                    <span class="price-text suggested">${formatPrice(cachedPrice.suggestedPrice)}</span>
                    ${changeHtml}
                    ${competitorInfo ? `<span class="price-market">${competitorInfo}</span>` : ''}
                </div>`;
        } else if (cachedPrice && cachedPrice.error) {
            priceHtml = `
                <div class="brainrot-price">
                    <i class="fas fa-tag" style="opacity: 0.5"></i>
                    <span class="price-text" style="opacity: 0.5">No data</span>
                </div>`;
        } else {
            priceHtml = `
                <div class="brainrot-price" data-price-loading="true">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span class="price-text">Loading...</span>
                </div>`;
        }
        
        return `
        <div class="brainrot-card ${generated ? 'brainrot-generated' : ''}" data-brainrot-name="${b.name}" data-brainrot-income="${income}" data-brainrot-index="${index}">
            <div class="brainrot-generate-btn" onclick="handleGenerateClick(${index})" title="Генерировать изображение">
                <i class="fas fa-${generated ? 'check' : 'plus'}"></i>
            </div>
            ${generated ? `
            <div class="brainrot-generated-badge" title="Сгенерировано${genInfo?.count > 1 ? ' (' + genInfo.count + 'x)' : ''}">
                <i class="fas fa-check-circle"></i>
            </div>
            ` : ''}
            <div class="brainrot-image">
                ${b.imageUrl 
                    ? `<img src="${b.imageUrl}" alt="${b.name}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-brain\\'></i>'">`
                    : '<i class="fas fa-brain"></i>'
                }
            </div>
            <div class="brainrot-details">
                <div class="brainrot-name" title="${b.name}">${b.name}</div>
                <div class="brainrot-income">${b.incomeText || formatIncome(b.income)}</div>
                ${priceHtml}
                <div class="brainrot-account">
                    <i class="fas fa-user"></i>
                    ${b.accountName}
                </div>
            </div>
        </div>`;
    }).join('');
    
    // Загружаем цены только для тех у кого ещё нет
    loadBrainrotPrices(brainrots);
}

/**
 * Загрузить и отобразить цены для брейнротов - ПОСЛЕДОВАТЕЛЬНО
 */
async function loadBrainrotPrices(brainrots) {
    // Защита от повторной загрузки
    if (collectionState.pricesLoading) {
        return;
    }
    
    // Сохраняем порядок брейнротов (сверху вниз, слева направо)
    // Фильтруем только те у которых цены ещё нет или они устарели
    const toLoad = [];
    for (const b of brainrots) {
        const income = normalizeIncomeForApi(b.income, b.incomeText);
        const cacheKey = getPriceCacheKey(b.name, income);
        const cached = state.brainrotPrices[cacheKey];
        // Загружаем если нет в кэше или устарело
        if (!cached || isPriceStale(cached)) {
            toLoad.push({ ...b, _income: income, _cacheKey: cacheKey });
        }
    }
    
    if (toLoad.length === 0) {
        return;
    }
    
    // Сохраняем текущие цены как предыдущие ПЕРЕД загрузкой новых
    savePreviousPrices();
    
    console.log('Loading prices for', toLoad.length, 'brainrots (stale or missing)');
    collectionState.pricesLoading = true;
    
    // Оптимизация: загружаем параллельно по 3 запроса с задержкой 150ms между batch'ами
    const BATCH_SIZE = 3;
    const BATCH_DELAY = 150; // ms между batch'ами
    const SAVE_INTERVAL = 5; // сохраняем в localStorage каждые N загрузок
    
    try {
        let loadedCount = 0;
        
        for (let i = 0; i < toLoad.length; i += BATCH_SIZE) {
            const batch = toLoad.slice(i, i + BATCH_SIZE);
            
            // Загружаем batch параллельно
            const promises = batch.map(async (b) => {
                const cacheKey = b._cacheKey;
                const income = b._income;
                
                // Пропускаем если уже загружено свежее
                const cached = state.brainrotPrices[cacheKey];
                if (cached && !isPriceStale(cached)) return;
                
                try {
                    const priceData = await fetchEldoradoPrice(b.name, income);
                    
                    // Сохраняем в глобальный кэш с timestamp
                    if (priceData) {
                        priceData._timestamp = Date.now();
                        state.brainrotPrices[cacheKey] = priceData;
                    } else {
                        state.brainrotPrices[cacheKey] = { error: true, _timestamp: Date.now() };
                    }
                    
                    // Обновляем DOM сразу
                    updatePriceInDOM(b.name, income, priceData);
                    loadedCount++;
                    
                } catch (err) {
                    console.warn('Error loading price for', b.name, income, err);
                    state.brainrotPrices[cacheKey] = { error: true, _timestamp: Date.now() };
                    updatePriceInDOM(b.name, income, null);
                }
            });
            
            await Promise.all(promises);
            
            // Сохраняем в localStorage периодически (не после каждого запроса)
            if (loadedCount > 0 && loadedCount % SAVE_INTERVAL === 0) {
                savePriceCacheToStorage();
            }
            
            // Задержка между batch'ами чтобы не упереться в rate limit
            if (i + BATCH_SIZE < toLoad.length) {
                await new Promise(r => setTimeout(r, BATCH_DELAY));
            }
        }
        
        // Финальное сохранение
        savePriceCacheToStorage();
        savePricesToServer(); // Также сохраняем на сервер
        
        // Обновляем UI для отображения обновленных значений
        updateUI();
        renderFarmKeys();
        
    } finally {
        collectionState.pricesLoading = false;
    }
}

/**
 * Обновить цену в DOM для конкретного брейнрота
 */
function updatePriceInDOM(brainrotName, income, priceData) {
    // Округляем income для поиска (так же как при рендере)
    const roundedIncome = Math.floor(income / 10) * 10;
    const cacheKey = getPriceCacheKey(brainrotName, income);
    
    // Ищем карточку по имени и income
    const cards = brainrotsGridEl?.querySelectorAll(`[data-brainrot-name="${CSS.escape(brainrotName)}"]`);
    if (!cards || cards.length === 0) return;
    
    // Находим карточку с нужным income
    let card = null;
    for (const c of cards) {
        const cardIncome = parseFloat(c.dataset.brainrotIncome) || 0;
        const cardRoundedIncome = Math.floor(cardIncome / 10) * 10;
        if (cardRoundedIncome === roundedIncome) {
            card = c;
            break;
        }
    }
    
    // Если не нашли по точному income, берём первую карточку с таким именем
    if (!card) card = cards[0];
    
    const priceEl = card.querySelector('.brainrot-price');
    if (!priceEl) return;
    
    priceEl.removeAttribute('data-price-loading');
    
    if (priceData && priceData.suggestedPrice) {
        // competitorPrice это цена upper оффера (ближайший конкурент с income >= наш)
        const competitorInfo = priceData.competitorPrice 
            ? `~$${priceData.competitorPrice.toFixed(2)}` 
            : '';
        const priceChange = getPriceChangePercent(cacheKey, priceData.suggestedPrice);
        const changeHtml = formatPriceChange(priceChange);
        priceEl.innerHTML = `
            <i class="fas fa-tag"></i>
            <span class="price-text suggested">${formatPrice(priceData.suggestedPrice)}</span>
            ${changeHtml}
            ${competitorInfo ? `<span class="price-market">${competitorInfo}</span>` : ''}
        `;
        priceEl.title = priceData.priceSource || `Suggested: ${formatPrice(priceData.suggestedPrice)}`;
    } else {
        priceEl.innerHTML = `
            <i class="fas fa-tag" style="opacity: 0.5"></i>
            <span class="price-text" style="opacity: 0.5">No data</span>
        `;
    }
}

/**
 * Очистить кэш цен и перезагрузить
 */
function clearPriceCache() {
    // Сохраняем текущие цены как предыдущие для отображения % изменения
    savePreviousPrices();
    
    // Сохраняем текущую общую стоимость
    const data = state.farmersData[state.currentKey];
    if (data && data.accounts) {
        const allBrainrots = [];
        data.accounts.forEach(account => {
            if (account.brainrots) {
                account.brainrots.forEach(b => allBrainrots.push(b));
            }
        });
        state.previousTotalValue = calculateTotalValue(allBrainrots);
    }
    
    state.brainrotPrices = {};
    state.eldoradoPrices = {};
    localStorage.removeItem(PRICE_STORAGE_KEY);
    console.log('Price cache cleared');
    // Перезагружаем цены
    filterAndRenderCollection();
}

// Update collection when data changes
async function updateCollection() {
    // Load generations and panel color
    await Promise.all([
        loadGenerationsData(),
        loadPanelColor()
    ]);
    
    // НЕ сбрасываем кэш цен - они загружаются отдельно
    collectAllBrainrots();
    filterAndRenderCollection();
}

// Handle generate button click
function handleGenerateClick(index) {
    const brainrot = collectionState.filteredBrainrots[index];
    if (brainrot) {
        openSupaGenerator(brainrot);
    }
}

// ==========================================
// SUPA GENERATOR MODAL
// ==========================================

// Open Supa Generator modal for a brainrot
function openSupaGenerator(brainrotData) {
    console.log('Opening Supa Generator for:', brainrotData);
    
    currentSupaBrainrot = brainrotData;
    
    let modal = document.getElementById('supaGeneratorModal');
    if (!modal) {
        modal = createSupaGeneratorModal();
        document.body.appendChild(modal);
    }
    
    document.getElementById('supaName').value = brainrotData.name || '';
    document.getElementById('supaIncome').value = brainrotData.incomeText || formatIncome(brainrotData.income);
    document.getElementById('supaImageUrl').value = brainrotData.imageUrl || '';
    
    // Используем единый цвет панели для границы
    const panelColor = collectionState.panelColor || '#4ade80';
    const accountInfoEl = document.getElementById('supaAccountInfo');
    if (accountInfoEl) {
        accountInfoEl.innerHTML = `
            <span style="display: inline-flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 12px; border-radius: 3px; background: ${panelColor};"></span>
                ${brainrotData.accountName}
            </span>
        `;
    }
    
    updateSupaImagePreview(brainrotData.imageUrl);
    
    document.getElementById('supaGenerateBtn').disabled = false;
    document.getElementById('supaStatus').classList.add('hidden');
    document.getElementById('supaError').classList.add('hidden');
    document.getElementById('supaDownloadSection').classList.add('hidden');
    document.getElementById('supaResultImage').classList.add('hidden');
    document.getElementById('supaPreviewPlaceholder').classList.remove('hidden');
    
    modal.classList.remove('hidden');
}

// Create Supa Generator Modal
function createSupaGeneratorModal() {
    const modal = document.createElement('div');
    modal.id = 'supaGeneratorModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeSupaModal()"></div>
        <div class="modal-content supa-modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-wand-magic-sparkles"></i> Supa Generator</h3>
                <button class="modal-close" onclick="closeSupaModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body supa-modal-body">
                <div class="supa-preview-section">
                    <div class="supa-preview-frame">
                        <div class="supa-preview-placeholder" id="supaPreviewPlaceholder">
                            <i class="fas fa-image"></i>
                            <p>Предпросмотр</p>
                        </div>
                        <img id="supaPreviewImage" class="supa-preview-image hidden" src="" alt="Preview">
                        <img id="supaResultImage" class="supa-result-image hidden" src="" alt="Result">
                    </div>
                    <div id="supaDownloadSection" class="supa-download-section hidden">
                        <button id="supaDownloadBtn" class="supa-download-btn" onclick="downloadSupaImage()">
                            <i class="fas fa-download"></i>
                            Скачать (800x800)
                        </button>
                        <button id="supaPostEldoradoBtn" class="supa-eldorado-btn" onclick="postToEldorado()">
                            <i class="fas fa-store"></i>
                            Post to Eldorado
                        </button>
                    </div>
                </div>
                <div class="supa-form-section">
                    <div class="supa-form-group supa-account-group">
                        <label><i class="fas fa-user"></i> Аккаунт</label>
                        <div id="supaAccountInfo" class="supa-account-info">-</div>
                    </div>
                    <div class="supa-form-group">
                        <label><i class="fas fa-tag"></i> Название</label>
                        <input type="text" id="supaName" placeholder="Название брейнрота">
                    </div>
                    <div class="supa-form-group">
                        <label><i class="fas fa-coins"></i> Доходность</label>
                        <input type="text" id="supaIncome" placeholder="338M/s">
                    </div>
                    <div class="supa-form-group">
                        <label><i class="fas fa-image"></i> URL изображения</label>
                        <input type="url" id="supaImageUrl" placeholder="https://..." onchange="updateSupaImagePreview(this.value)">
                    </div>
                    <button id="supaGenerateBtn" class="supa-generate-btn" onclick="generateSupaImage()">
                        <i class="fas fa-wand-magic-sparkles"></i>
                        Генерировать
                    </button>
                    <div id="supaStatus" class="supa-status hidden">
                        <div class="supa-spinner"></div>
                        <span id="supaStatusText">Обработка...</span>
                    </div>
                    <div id="supaError" class="supa-error hidden">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span id="supaErrorText"></span>
                    </div>
                </div>
            </div>
        </div>
    `;
    return modal;
}

function closeSupaModal() {
    const modal = document.getElementById('supaGeneratorModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function updateSupaImagePreview(url) {
    const previewImg = document.getElementById('supaPreviewImage');
    const placeholder = document.getElementById('supaPreviewPlaceholder');
    const resultImg = document.getElementById('supaResultImage');
    
    if (!url) {
        previewImg.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }
    
    const img = new Image();
    img.onload = () => {
        previewImg.src = url;
        previewImg.classList.remove('hidden');
        placeholder.classList.add('hidden');
        resultImg.classList.add('hidden');
    };
    img.onerror = () => {
        previewImg.classList.add('hidden');
        placeholder.classList.remove('hidden');
    };
    img.src = url;
}

let currentSupaResult = null;

// Poll for render status (client-side polling to avoid Vercel timeout)
async function pollForResult(taskId, statusText, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            statusText.textContent = `Рендеринг... (${i + 1}/${maxAttempts})`;
            
            const response = await fetch(`/api/supa-status?taskId=${taskId}`);
            const status = await response.json();
            
            console.log(`Poll attempt ${i + 1}:`, status.state);
            
            if (status.state === 'done' && status.resultUrl) {
                return status;
            }
            
            if (status.state === 'error') {
                throw new Error('Render failed on server');
            }
            
            // Wait 2 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
            console.error('Poll error:', err);
            // Continue polling on network errors
        }
    }
    
    return null; // Timeout
}

async function generateSupaImage() {
    const name = document.getElementById('supaName').value.trim();
    const income = document.getElementById('supaIncome').value.trim();
    const imageUrl = document.getElementById('supaImageUrl').value.trim();
    
    if (!name || !income) {
        showSupaError('Заполните название и доходность');
        return;
    }
    
    const accountId = currentSupaBrainrot?.accountId;
    const accountName = currentSupaBrainrot?.accountName;
    // Используем единый цвет панели
    const borderColor = collectionState.panelColor || '#4ade80';
    
    const generateBtn = document.getElementById('supaGenerateBtn');
    const statusEl = document.getElementById('supaStatus');
    const statusText = document.getElementById('supaStatusText');
    const errorEl = document.getElementById('supaError');
    const downloadSection = document.getElementById('supaDownloadSection');
    const resultImg = document.getElementById('supaResultImage');
    const previewImg = document.getElementById('supaPreviewImage');
    const placeholder = document.getElementById('supaPreviewPlaceholder');
    
    generateBtn.disabled = true;
    statusEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    downloadSection.classList.add('hidden');
    statusText.textContent = 'Загрузка изображения...';
    
    try {
        const response = await fetch('/api/supa-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name, 
                income, 
                imageUrl,
                borderColor,
                accountId,
                accountName
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Generation failed');
        }
        
        statusText.textContent = 'Рендеринг...';
        
        // If pending, poll for status
        if (result.pending && result.taskId) {
            const finalResult = await pollForResult(result.taskId, statusText);
            if (finalResult && finalResult.resultUrl) {
                currentSupaResult = { ...result, resultUrl: finalResult.resultUrl };
                
                resultImg.onload = async () => {
                    resultImg.classList.remove('hidden');
                    previewImg.classList.add('hidden');
                    placeholder.classList.add('hidden');
                    downloadSection.classList.remove('hidden');
                    statusEl.classList.add('hidden');
                    
                    await saveGeneration(name, accountId, finalResult.resultUrl);
                };
                resultImg.src = finalResult.resultUrl;
            } else {
                throw new Error('Render failed or timeout');
            }
        } else if (result.success && result.resultUrl) {
            currentSupaResult = result;
            
            resultImg.onload = async () => {
                resultImg.classList.remove('hidden');
                previewImg.classList.add('hidden');
                placeholder.classList.add('hidden');
                downloadSection.classList.remove('hidden');
                statusEl.classList.add('hidden');
                
                await saveGeneration(name, accountId, result.resultUrl);
            };
            resultImg.src = result.resultUrl;
        } else {
            throw new Error('No result received');
        }
        
    } catch (error) {
        console.error('Supa Generate error:', error);
        showSupaError(error.message);
        statusEl.classList.add('hidden');
    } finally {
        generateBtn.disabled = false;
    }
}

async function downloadSupaImage() {
    if (!currentSupaResult || !currentSupaResult.resultUrl) {
        showSupaError('Нет изображения для скачивания');
        return;
    }
    
    const downloadBtn = document.getElementById('supaDownloadBtn');
    const name = document.getElementById('supaName').value.trim();
    
    try {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Скачивание...';
        
        const filename = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
        
        const response = await fetch(currentSupaResult.resultUrl);
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Download error:', error);
        showSupaError('Ошибка скачивания: ' + error.message);
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Скачать (800x800)';
    }
}

function showSupaError(message) {
    const errorEl = document.getElementById('supaError');
    const errorText = document.getElementById('supaErrorText');
    errorText.textContent = message;
    errorEl.classList.remove('hidden');
}

// Post to Eldorado - opens eldorado.gg with brainrot data
function postToEldorado() {
    if (!currentSupaResult || !currentSupaResult.resultUrl) {
        showSupaError('Сначала сгенерируйте изображение');
        return;
    }
    
    const name = document.getElementById('supaName').value.trim();
    const income = document.getElementById('supaIncome').value.trim();
    const imageUrl = document.getElementById('supaImageUrl').value.trim();
    
    // Получаем цену из кэша или из данных брейнрота
    let minPrice = 0;
    let maxPrice = 0;
    
    if (currentSupaBrainrot) {
        const brainrotName = currentSupaBrainrot.name;
        // Пытаемся получить цену из eldoradoPrices
        if (collectionState.eldoradoPrices && collectionState.eldoradoPrices[brainrotName]) {
            const price = collectionState.eldoradoPrices[brainrotName];
            minPrice = Math.floor(price * 0.9); // -10% для минимальной
            maxPrice = Math.ceil(price * 1.1);  // +10% для максимальной
        } else if (collectionState.brainrotPrices && collectionState.brainrotPrices[brainrotName]) {
            const price = collectionState.brainrotPrices[brainrotName];
            minPrice = Math.floor(price * 0.9);
            maxPrice = Math.ceil(price * 1.1);
        }
    }
    
    // Формируем данные для Tampermonkey скрипта
    const offerData = {
        name: name,
        income: income,
        imageUrl: imageUrl,
        generatedImageUrl: currentSupaResult.resultUrl,
        minPrice: minPrice,
        maxPrice: maxPrice,
        rarity: currentSupaBrainrot?.rarity || '', // Secret, Mythical, etc
        accountId: currentSupaBrainrot?.accountId,
        accountName: currentSupaBrainrot?.accountName,
        timestamp: Date.now()
    };
    
    // Сохраняем данные в localStorage для Tampermonkey скрипта
    localStorage.setItem('glitched_offer_data', JSON.stringify(offerData));
    
    // Также можно передать через URL параметры (менее надежно для больших данных)
    const encodedData = encodeURIComponent(JSON.stringify(offerData));
    
    // Открываем страницу Eldorado с данными
    const eldoradoUrl = `https://www.eldorado.gg/sell/offer/CustomItem/259?glitched_data=${encodedData}`;
    
    // Открываем в новой вкладке
    window.open(eldoradoUrl, '_blank');
    
    console.log('Opening Eldorado with offer data:', offerData);
}

// Initialize collection listeners on DOM ready
setupCollectionListeners();

