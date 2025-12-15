// API Base URL - auto-detect for local dev or production
const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001/api' 
    : '/api';

// Brainrot images base URL
const BRAINROT_IMAGES_BASE = window.location.origin + '/brainrots';

// State
let state = {
    currentKey: null,
    savedKeys: [],
    farmersData: {},
    brainrotImages: {},
    eldoradoPrices: {} // Кэш цен Eldorado
};

// Кэш цен Eldorado (время жизни 5 минут)
const PRICE_CACHE_TTL = 5 * 60 * 1000;

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
 * Получить ключ кэша для цены
 */
function getPriceCacheKey(pitName, income) {
    return `${pitName.toLowerCase()}_${Math.floor(income / 10) * 10}`;
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
            brainrotName: brainrotName,
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
        const income = b.income || parseIncomeValue(b.incomeText);
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
    setupEventListeners();
    
    if (state.currentKey && state.savedKeys.length > 0) {
        showMainApp();
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
    
    statsEls.totalAccounts.textContent = accounts.length;
    statsEls.onlineAccounts.textContent = online;
    statsEls.totalIncome.textContent = formatIncome(totalIncome);
    statsEls.totalBrainrots.textContent = totalBrainrots;
    
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
    
    // Pre-fetch avatars (use cache)
    const avatarPromises = accounts.map(async (account) => {
        if (account.userId) {
            if (avatarCache[account.userId]) {
                account.avatarUrl = avatarCache[account.userId];
            } else {
                try {
                    const response = await fetch(`${API_BASE}/avatar?userId=${account.userId}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.imageUrl) {
                            avatarCache[account.userId] = data.imageUrl;
                            account.avatarUrl = data.imageUrl;
                        }
                    }
                } catch (err) {
                    // ignore
                }
            }
        }
        return account;
    });
    
    await Promise.all(avatarPromises);
    
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
    
    accountsListEl.innerHTML = accounts.map(account => {
        const avatarSrc = account.avatarUrl || avatarCache[account.userId] || getDefaultAvatar(account.playerName);
        const isOnline = account._isOnline;
        const statusClass = isOnline ? 'online' : 'offline';
        const actionText = isOnline ? (account.action || account.status || 'Idle') : 'Offline';
        
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
        const accountCount = data?.accounts?.length || 0;
        
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
// COLLECTION VIEW - All Brainrots from all accounts
// ==========================================

// Additional DOM Elements for Collection
const brainrotSearchEl = document.getElementById('brainrotSearch');
const sortDropdown = document.getElementById('sortDropdown');
const accountDropdown = document.getElementById('accountDropdown');
const accountDropdownMenu = document.getElementById('accountDropdownMenu');
const brainrotsGridEl = document.getElementById('brainrotsGrid');
const collectionStatsEl = document.getElementById('collectionStats');

// Collection state
let collectionState = {
    allBrainrots: [],
    filteredBrainrots: [],
    searchQuery: '',
    sortBy: 'income-desc',
    accountFilter: 'all'
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

// Setup Collection event listeners
function setupCollectionListeners() {
    if (brainrotSearchEl) {
        brainrotSearchEl.addEventListener('input', function(e) {
            collectionState.searchQuery = e.target.value.toLowerCase().trim();
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
function filterAndRenderCollection() {
    let filtered = [...collectionState.allBrainrots];

    // Filter by search
    if (collectionState.searchQuery) {
        filtered = filtered.filter(b => 
            b.name.toLowerCase().includes(collectionState.searchQuery)
        );
    }

    // Filter by account
    if (collectionState.accountFilter !== 'all') {
        filtered = filtered.filter(b => 
            b.accountName === collectionState.accountFilter
        );
    }

    // Sort
    switch (collectionState.sortBy) {
        case 'income-desc':
            filtered.sort((a, b) => b.income - a.income);
            break;
        case 'income-asc':
            filtered.sort((a, b) => a.income - b.income);
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
        let statsHtml = '<span><i class="fas fa-layer-group"></i> ' + collectionState.allBrainrots.length + ' total</span>';
        statsHtml += '<span><i class="fas fa-fingerprint"></i> ' + uniqueNames.size + ' unique</span>';
        if (collectionState.searchQuery || collectionState.accountFilter !== 'all') {
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

    // Первичный рендер без цен (быстрый)
    brainrotsGridEl.innerHTML = brainrots.map(b => `
        <div class="brainrot-card" data-brainrot-name="${b.name}">
            <div class="brainrot-image">
                ${b.imageUrl 
                    ? `<img src="${b.imageUrl}" alt="${b.name}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-brain\\'></i>'">`
                    : '<i class="fas fa-brain"></i>'
                }
            </div>
            <div class="brainrot-details">
                <div class="brainrot-name" title="${b.name}">${b.name}</div>
                <div class="brainrot-income">${b.incomeText || formatIncome(b.income)}</div>
                <div class="brainrot-account">
                    <i class="fas fa-user"></i>
                    ${b.accountName}
                </div>
            </div>
        </div>
    `).join('');
    
    // Цены временно отключены из-за rate limiting на Eldorado API
    // loadBrainrotPrices(brainrots);
}

/**
 * Загрузить и отобразить цены для брейнротов
 */
async function loadBrainrotPrices(brainrots) {
    try {
        const pricesMap = await fetchBulkEldoradoPrices(brainrots);
        
        // Обновляем DOM с ценами
        for (const b of brainrots) {
            const priceData = pricesMap.get(b.name);
            const card = brainrotsGridEl.querySelector(`[data-brainrot-name="${CSS.escape(b.name)}"]`);
            
            if (!card) continue;
            
            const priceEl = card.querySelector('.brainrot-price');
            if (!priceEl) continue;
            
            priceEl.removeAttribute('data-price-loading');
            
            if (priceData && priceData.suggestedPrice) {
                const rangeText = priceData.priceRange?.min && priceData.priceRange?.max
                    ? `Range: ${formatPrice(priceData.priceRange.min)} - ${formatPrice(priceData.priceRange.max)}`
                    : '';
                
                priceEl.innerHTML = `
                    <i class="fas fa-tag"></i>
                    <span class="price-text suggested">${formatPrice(priceData.suggestedPrice)}</span>
                    ${priceData.marketPrice ? `<span class="price-market" title="${rangeText}">~${formatPrice(priceData.marketPrice)}</span>` : ''}
                `;
                priceEl.title = `Suggested: ${formatPrice(priceData.suggestedPrice)}\n${rangeText}\nBased on ${priceData.totalOffersAnalyzed || 0} offers`;
            } else if (priceData && priceData.marketPrice) {
                priceEl.innerHTML = `
                    <i class="fas fa-tag"></i>
                    <span class="price-text">~${formatPrice(priceData.marketPrice)}</span>
                `;
            } else {
                priceEl.innerHTML = `
                    <i class="fas fa-tag" style="opacity: 0.5"></i>
                    <span class="price-text" style="opacity: 0.5">No data</span>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading brainrot prices:', error);
        
        // Показываем ошибку в карточках
        const priceEls = brainrotsGridEl.querySelectorAll('.brainrot-price[data-price-loading]');
        priceEls.forEach(el => {
            el.removeAttribute('data-price-loading');
            el.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="opacity: 0.5"></i>
                <span class="price-text" style="opacity: 0.5">Error</span>
            `;
        });
    }
}
}

// Update collection when data changes
function updateCollection() {
    collectAllBrainrots();
    filterAndRenderCollection();
}

// Initialize collection listeners on DOM ready
setupCollectionListeners();

