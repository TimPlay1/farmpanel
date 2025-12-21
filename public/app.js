// API Base URL - auto-detect for local dev or production
const API_BASE = window.location.hostname === 'localhost' 
    ? '/api' 
    : '/api';

// Brainrot images base URL
const BRAINROT_IMAGES_BASE = window.location.origin + '/brainrots';

// Simple notification function
function showNotification(message, type = 'info') {
    // Create notification element
    const existing = document.querySelector('.panel-notification');
    if (existing) existing.remove();
    
    const notif = document.createElement('div');
    notif.className = `panel-notification panel-notification-${type}`;
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        ${type === 'success' ? 'background: linear-gradient(135deg, #11998e, #38ef7d); color: white;' : ''}
        ${type === 'error' ? 'background: linear-gradient(135deg, #eb3349, #f45c43); color: white;' : ''}
        ${type === 'warning' ? 'background: linear-gradient(135deg, #f59e0b, #f97316); color: white;' : ''}
        ${type === 'info' ? 'background: linear-gradient(135deg, #667eea, #764ba2); color: white;' : ''}
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    
    setTimeout(() => notif.remove(), 5000);
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Format money with K/M/B suffixes (for prices)
function formatMoney(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    if (absNum >= 1e9) {
        return sign + (absNum / 1e9).toFixed(2) + 'B';
    } else if (absNum >= 1e6) {
        return sign + (absNum / 1e6).toFixed(2) + 'M';
    } else if (absNum >= 1e3) {
        return sign + (absNum / 1e3).toFixed(1) + 'K';
    }
    return sign + absNum.toLocaleString();
}

// Mutation styles for brainrot variants - includes background, text color, and glow color
function getMutationStyles(mutation) {
    if (!mutation) return null;
    
    // Clean from HTML tags
    let clean = mutation.replace(/<[^>]+>/g, '').trim();
    // Normalize Yin Yang
    if (clean.toLowerCase().includes('yin') && clean.toLowerCase().includes('yang')) {
        clean = 'YinYang';
    }
    
    const styles = {
        'Gold': {
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            textColor: '#4a3500',
            glowColor: '#FFD700'
        },
        'Diamond': {
            background: 'linear-gradient(135deg, #00BFFF, #87CEEB)',
            textColor: '#003366',
            glowColor: '#00BFFF'
        },
        'Bloodrot': {
            background: 'linear-gradient(135deg, #8B0000, #DC143C)',
            textColor: '#ffcccc',
            glowColor: '#DC143C'
        },
        'Rainbow': {
            background: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff)',
            textColor: '#ffffff',
            textShadow: '0 0 3px #000, 0 0 5px #000',
            glowColor: '#ff00ff'
        },
        'Candy': {
            background: 'linear-gradient(135deg, #FF69B4, #FF1493)',
            textColor: '#4a0020',
            glowColor: '#FF69B4'
        },
        'Lava': {
            background: 'linear-gradient(135deg, #FF4500, #FF6347)',
            textColor: '#3d0000',
            glowColor: '#FF4500'
        },
        'Galaxy': {
            background: 'linear-gradient(135deg, #9400D3, #4B0082)',
            textColor: '#e0c0ff',
            glowColor: '#9400D3'
        },
        'YinYang': {
            background: 'linear-gradient(135deg, #333, #fff, #333)',
            textColor: '#888',
            textShadow: '0 0 2px #fff, 0 0 4px #000',
            glowColor: '#888888'
        },
        'Yin Yang': {
            background: 'linear-gradient(135deg, #333, #fff, #333)',
            textColor: '#888',
            textShadow: '0 0 2px #fff, 0 0 4px #000',
            glowColor: '#888888'
        },
        'Radioactive': {
            background: 'linear-gradient(135deg, #32CD32, #00FF00)',
            textColor: '#003300',
            glowColor: '#32CD32'
        }
    };
    return styles[clean] || { background: '#888', textColor: '#fff', glowColor: '#888' };
}

// Get just the background color/gradient for mutation
function getMutationColor(mutation) {
    const styles = getMutationStyles(mutation);
    return styles ? styles.background : '#888';
}

// Clean mutation text for display
function cleanMutationText(mutation) {
    if (!mutation) return null;
    let clean = mutation.replace(/<[^>]+>/g, '').trim();
    if (clean.toLowerCase().includes('yin') && clean.toLowerCase().includes('yang')) {
        return 'YinYang';
    }
    return clean || null;
}

// Format income with K/M/B/T suffixes and /s unit (with space)
function formatIncomeSec(num) {
    if (num === null || num === undefined || isNaN(num)) return '0 /s';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    if (absNum >= 1e12) {
        return sign + (absNum / 1e12).toFixed(2) + ' T/s';
    } else if (absNum >= 1e9) {
        return sign + (absNum / 1e9).toFixed(2) + ' B/s';
    } else if (absNum >= 1e6) {
        return sign + (absNum / 1e6).toFixed(2) + ' M/s';
    } else if (absNum >= 1e3) {
        return sign + (absNum / 1e3).toFixed(1) + ' K/s';
    }
    return sign + absNum.toFixed(0) + ' /s';
}

// Format income from M/s format (number in millions) to display format
// API stores income as "390" meaning 390 M/s, need to convert to display "390 M/s"
function formatIncomeFromMs(num) {
    if (num === null || num === undefined || isNaN(num)) return '0 /s';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    // Convert from M/s stored format back to raw, then format
    // If number is small (< 10000), it's already in M/s format
    // If large, it's raw format
    if (absNum >= 10000) {
        // Raw format - use formatIncomeSec directly
        return formatIncomeSec(num);
    }
    
    // M/s format - number represents millions per second
    if (absNum >= 1e6) {
        return sign + (absNum / 1e6).toFixed(2) + ' T/s';
    } else if (absNum >= 1e3) {
        return sign + (absNum / 1e3).toFixed(2) + ' B/s';
    } else if (absNum >= 1) {
        return sign + absNum.toFixed(1) + ' M/s';
    } else if (absNum >= 0.001) {
        return sign + (absNum * 1000).toFixed(0) + ' K/s';
    }
    return sign + (absNum * 1e6).toFixed(0) + ' /s';
}

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
    avatarCache: {}, // Кэш аватаров по userId
    balanceHistory: {}, // История баланса по farmKey {farmKey: [{timestamp, value}]}
    currentTotalValue: 0, // Текущий баланс (синхронизирован везде)
    currentBalanceChange: null, // Текущее изменение баланса
    isManualPriceRefresh: false, // Флаг ручного рефреша цен (не записываем в историю)
    frozenBalance: null, // Замороженный баланс во время ручного рефреша
    lastRecordedPrices: {} // Последние записанные цены для сравнения
};

// Кэш цен Eldorado (время жизни 10 минут)
const PRICE_CACHE_TTL = 10 * 60 * 1000;
const PRICE_AUTO_REFRESH_INTERVAL = 10 * 60 * 1000; // Автообновление каждые 10 минут
const PRICE_STORAGE_KEY = 'eldoradoPriceCache';
const PREVIOUS_PRICES_KEY = 'previousPricesCache';
const AVATAR_STORAGE_KEY = 'avatarCache';
const BALANCE_HISTORY_KEY = 'balanceHistoryCache';
const CHART_PERIOD_KEY = 'chartPeriodCache';

// Периоды для графика
const PERIODS = {
    realtime: 5 * 60 * 1000,      // 5 минут - Real Time
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000
};

/**
 * Проверить, является ли строка base64 изображением
 */
function isBase64Avatar(url) {
    return url && url.startsWith('data:image/');
}

/**
 * Загрузить кэш аватаров из localStorage
 */
function loadAvatarCache() {
    try {
        const stored = localStorage.getItem(AVATAR_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Фильтруем только base64 аватары (они не истекают)
            // URL аватары от Roblox CDN истекают
            for (const [userId, data] of Object.entries(parsed)) {
                if (data && data.url && isBase64Avatar(data.url)) {
                    state.avatarCache[userId] = data;
                }
            }
            console.log(`Loaded ${Object.keys(state.avatarCache).length} base64 avatars from cache`);
        }
    } catch (e) {
        console.warn('Failed to load avatar cache:', e);
    }
}

/**
 * Сохранить аватар в кэш (только base64)
 */
function saveAvatarToCache(userId, avatarUrl) {
    // Сохраняем только base64 аватары (они не истекают)
    // URL аватары от Roblox CDN временные и истекают
    if (!isBase64Avatar(avatarUrl)) {
        return; // Не кэшируем временные URL
    }
    
    state.avatarCache[userId] = {
        url: avatarUrl,
        timestamp: Date.now()
    };
    
    try {
        // Ограничиваем размер кэша - максимум 30 аватаров чтобы не забить localStorage
        const cacheKeys = Object.keys(state.avatarCache);
        if (cacheKeys.length > 30) {
            // Удаляем старые записи
            const sorted = cacheKeys.sort((a, b) => 
                (state.avatarCache[a].timestamp || 0) - (state.avatarCache[b].timestamp || 0)
            );
            // Удаляем половину старых
            for (let i = 0; i < 15; i++) {
                delete state.avatarCache[sorted[i]];
            }
        }
        localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(state.avatarCache));
    } catch (e) {
        console.warn('Failed to save avatar cache:', e);
        // Если localStorage переполнен, очищаем кэш
        if (e.name === 'QuotaExceededError') {
            state.avatarCache = {};
            localStorage.removeItem(AVATAR_STORAGE_KEY);
        }
    }
}

/**
 * Получить аватар из кэша
 * Base64 аватары не имеют срока действия
 */
function getCachedAvatar(userId) {
    const cached = state.avatarCache[userId];
    if (cached && cached.url) {
        // Base64 аватары не истекают
        if (isBase64Avatar(cached.url)) {
            return cached.url;
        }
        // URL аватары истекают через 24 часа
        if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
            return cached.url;
        }
    }
    return null;
}

/**
 * Загрузить аватар через серверный API (конвертирует в base64 и сохраняет)
 */
async function fetchRobloxAvatar(userId) {
    try {
        // Используем серверный API который конвертирует в base64 и сохраняет в MongoDB
        const response = await fetch(`${API_BASE}/account-avatar?userId=${userId}`);
        const data = await response.json();
        
        if (data.avatarUrl) {
            saveAvatarToCache(userId, data.avatarUrl);
            return data.avatarUrl;
        }
        
        // Fallback: прямой запрос к Roblox API (менее надёжно, URL временные)
        const robloxResponse = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
        );
        const robloxData = await robloxResponse.json();
        if (robloxData.data?.[0]?.imageUrl) {
            const url = robloxData.data[0].imageUrl;
            saveAvatarToCache(userId, url);
            return url;
        }
    } catch (e) {
        console.warn('Failed to fetch Roblox avatar for', userId, e);
    }
    return null;
}

/**
 * Получить аватар: сначала из сервера/кэша, затем с Roblox
 */
async function getAccountAvatar(userId, serverAvatars) {
    if (!userId) return null;
    
    const key = String(userId);
    
    // 1. Проверяем серверные данные (base64)
    const serverAvatar = serverAvatars?.[key];
    if (serverAvatar?.base64) {
        return serverAvatar.base64;
    }
    if (serverAvatar?.url) {
        return serverAvatar.url;
    }
    
    // 2. Проверяем локальный кэш
    const cached = getCachedAvatar(userId);
    if (cached) {
        return cached;
    }
    
    // 3. Загружаем с Roblox (в фоне)
    return fetchRobloxAvatar(userId);
}

// ============ Balance History Functions ============

/**
 * Загрузить историю баланса из сервера (MongoDB)
 */
async function loadBalanceHistory() {
    if (!state.currentKey) {
        console.log('loadBalanceHistory: no currentKey, skipping');
        return;
    }
    
    console.log('loadBalanceHistory: loading for', state.currentKey);
    
    try {
        // Загружаем только из сервера (localStorage отключен для экономии места)
        const response = await fetch(`${API_BASE}/balance-history?farmKey=${encodeURIComponent(state.currentKey)}&period=${PERIODS.month}`);
        if (response.ok) {
            const data = await response.json();
            if (data.history && data.history.length > 0) {
                state.balanceHistory[state.currentKey] = data.history;
                console.log(`Loaded ${data.history.length} balance history records from server`);
                return;
            }
        }
    } catch (e) {
        console.warn('Failed to load balance history from server:', e);
    }
    
    // Инициализируем пустой массив если сервер недоступен
    if (!state.balanceHistory[state.currentKey]) {
        state.balanceHistory[state.currentKey] = [];
    }
}

/**
 * Сохранить запись истории баланса на сервер
 */
async function saveBalanceHistoryToServer(farmKey, value) {
    try {
        await fetch(`${API_BASE}/balance-history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ farmKey, value, timestamp: Date.now() })
        });
    } catch (e) {
        console.warn('Failed to save balance history to server:', e);
    }
}

/**
 * Сохранить историю баланса в localStorage (ОТКЛЮЧЕНО - данные на сервере)
 */
function saveBalanceHistory() {
    // История баланса хранится на сервере, локальный кэш не нужен
    // Это экономит ~500KB+ в localStorage
    return;
}

/**
 * Очистить всю историю баланса (для сброса тестовых данных)
 */
async function clearBalanceHistory() {
    state.balanceHistory = {};
    state.currentBalanceChange = null;
    localStorage.removeItem(BALANCE_HISTORY_KEY);
    
    // Очищаем на сервере
    try {
        await fetch(`${API_BASE}/balance-history?all=true&secret=cleanup-farmpanel-2024`, {
            method: 'DELETE'
        });
        console.log('Balance history cleared on server');
    } catch (e) {
        console.warn('Failed to clear balance history on server:', e);
    }
    
    console.log('Balance history cleared');
    updateBalanceChart();
    updateUI();
    renderFarmKeys();
}

/**
 * Добавить запись в историю баланса
 * Записывает ТОЛЬКО если:
 * 1. Это НЕ ручной рефреш цен
 * 2. Баланс реально изменился (цены изменились)
 */
function recordBalanceHistory(farmKey, value) {
    if (!farmKey || value === undefined || value === null) return;
    
    // При ручном рефреше не записываем в историю
    if (state.isManualPriceRefresh) {
        console.log('Skip balance history: manual price refresh');
        return;
    }
    
    if (!state.balanceHistory[farmKey]) {
        state.balanceHistory[farmKey] = [];
    }
    
    const history = state.balanceHistory[farmKey];
    const now = Date.now();
    
    // Записываем раз в 10 секунд для real-time графика
    if (history.length > 0) {
        const last = history[history.length - 1];
        if (now - last.timestamp < 10000) return;
        
        // Не записываем если баланс не изменился (разница < $0.01)
        if (Math.abs(last.value - value) < 0.01) {
            return;
        }
    }
    
    history.push({ timestamp: now, value: value });
    console.log(`Balance history: recorded $${value.toFixed(2)} for ${farmKey}`);
    
    // Сохраняем на сервер (async, не блокируем)
    saveBalanceHistoryToServer(farmKey, value);
    
    // Ограничиваем размер истории (макс 2000 записей на аккаунт)
    if (history.length > 2000) {
        state.balanceHistory[farmKey] = history.slice(-1000);
    }
    
    // Сохраняем в localStorage как backup
    saveBalanceHistory();
}

/**
 * Получить изменение баланса за период
 */
function getBalanceChange(farmKey, periodMs) {
    const history = state.balanceHistory[farmKey];
    if (!history || history.length < 2) return null;
    
    const now = Date.now();
    const periodStart = now - periodMs;
    
    // Находим самую раннюю запись в периоде
    let oldestInPeriod = null;
    for (const entry of history) {
        if (entry.timestamp >= periodStart) {
            oldestInPeriod = entry;
            break;
        }
    }
    
    if (!oldestInPeriod) {
        // Если нет записей в периоде, берём самую старую
        oldestInPeriod = history[0];
    }
    
    const latest = history[history.length - 1];
    
    if (oldestInPeriod.value === 0) return null;
    
    const change = latest.value - oldestInPeriod.value;
    const changePercent = (change / oldestInPeriod.value) * 100;
    
    return {
        change: change,
        changePercent: changePercent,
        oldValue: oldestInPeriod.value,
        newValue: latest.value
    };
}

/**
 * Получить данные для графика
 */
function getChartData(farmKey, periodMs, points = 30) {
    const history = state.balanceHistory[farmKey];
    if (!history || history.length < 2) return { labels: [], values: [] };
    
    const now = Date.now();
    const periodStart = now - periodMs;
    
    // Фильтруем записи в периоде
    let periodHistory = history.filter(e => e.timestamp >= periodStart);
    
    // Fallback: если для периода < 2 записей, берём последние записи
    if (periodHistory.length < 2 && history.length >= 2) {
        // Для realtime берём последние 50 записей, для остальных - 30
        const isRealtime = periodMs <= PERIODS.realtime;
        const fallbackCount = isRealtime ? Math.min(50, history.length) : Math.min(30, history.length);
        periodHistory = history.slice(-fallbackCount);
        console.log(`Chart fallback: using last ${periodHistory.length} records instead of period filter`);
    }
    
    if (periodHistory.length < 2) return { labels: [], values: [] };
    
    // Для realtime показываем все точки
    const isRealtime = periodMs <= PERIODS.realtime;
    const maxPoints = isRealtime ? 100 : points;
    
    // Сэмплируем до нужного количества точек
    const step = Math.max(1, Math.floor(periodHistory.length / maxPoints));
    const sampled = [];
    for (let i = 0; i < periodHistory.length; i += step) {
        sampled.push(periodHistory[i]);
    }
    // Всегда включаем последнюю точку
    if (sampled[sampled.length - 1] !== periodHistory[periodHistory.length - 1]) {
        sampled.push(periodHistory[periodHistory.length - 1]);
    }
    
    // Форматируем метки времени
    const labels = sampled.map(entry => {
        const date = new Date(entry.timestamp);
        if (periodMs <= PERIODS.hour) {
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } else if (periodMs <= PERIODS.day) {
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        }
    });
    
    const values = sampled.map(entry => entry.value);
    
    return { labels, values };
}

/**
 * Форматировать изменение баланса для отображения
 */
function formatBalanceChange(changePercent, compact = false) {
    if (changePercent === null || changePercent === undefined || isNaN(changePercent)) {
        return '';
    }
    
    const isPositive = changePercent >= 0;
    const arrow = isPositive ? '↑' : '↓';
    const colorClass = isPositive ? 'change-positive' : 'change-negative';
    const absPercent = Math.abs(changePercent);
    
    if (compact) {
        return `<span class="${colorClass}">${arrow}${absPercent.toFixed(1)}%</span>`;
    }
    
    return `<span class="${colorClass}">${arrow} ${absPercent.toFixed(2)}%</span>`;
}

/**
 * Загрузить кэш цен из MongoDB (серверный централизованный кэш)
 * Сначала пробуем новый prices-cache API (от cron сканера)
 * Fallback на старый prices API
 */
async function loadPricesFromServer() {
    // Пробуем новый централизованный кэш
    try {
        const response = await fetch(`${API_BASE}/prices-cache?all=true`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.prices && Object.keys(data.prices).length > 0) {
                // Сохраняем текущие цены как предыдущие перед загрузкой новых
                savePreviousPrices();
                
                // Загружаем цены в state
                for (const [key, priceData] of Object.entries(data.prices)) {
                    state.brainrotPrices[key] = {
                        ...priceData,
                        timestamp: new Date(priceData.updatedAt).getTime()
                    };
                }
                console.log(`Loaded ${Object.keys(data.prices).length} prices from centralized server cache`);
                return true;
            }
        }
    } catch (e) {
        console.warn('Failed to load from centralized cache, trying fallback:', e.message);
    }
    
    // Fallback на старый API (если cron не работает)
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
                console.log(`Loaded ${Object.keys(data.prices).length} prices from global server cache (fallback)`);
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
            const parsed = JSON.parse(prevStored);
            const twoHours = 2 * 60 * 60 * 1000;
            const now = Date.now();
            
            // Фильтруем - оставляем только записи за последние 2 часа
            for (const [key, data] of Object.entries(parsed)) {
                // Поддержка нового формата {price, timestamp} и старого (просто число)
                if (typeof data === 'object' && data.timestamp) {
                    if (now - data.timestamp < twoHours) {
                        state.previousPrices[key] = data;
                    }
                }
                // Старый формат (просто число) - пропускаем, т.к. нет timestamp
            }
            console.log(`Loaded ${Object.keys(state.previousPrices).length} recent previous prices`);
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
    const now = Date.now();
    for (const [key, data] of Object.entries(state.brainrotPrices)) {
        if (data && data.suggestedPrice) {
            state.previousPrices[key] = {
                price: data.suggestedPrice,
                timestamp: now
            };
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
 * Получить % изменения цены (только если предыдущая цена была в последний час)
 */
function getPriceChangePercent(cacheKey, newPrice) {
    const prevData = state.previousPrices[cacheKey];
    if (!prevData) return null;
    
    // Поддержка старого формата (просто число)
    const oldPrice = typeof prevData === 'object' ? prevData.price : prevData;
    const timestamp = typeof prevData === 'object' ? prevData.timestamp : 0;
    
    // Если нет цены или цены равны - нет изменения
    if (!oldPrice || oldPrice === newPrice) return null;
    
    // Показываем изменение только если предыдущая цена была в последний час
    const oneHour = 60 * 60 * 1000;
    if (timestamp && Date.now() - timestamp > oneHour) return null;
    
    const change = ((newPrice - oldPrice) / oldPrice) * 100;
    
    // Игнорируем маленькие изменения (< 1%)
    if (Math.abs(change) < 1) return null;
    
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
 * @param {string|number} incomeText - например "$112.5M/s", "$1.5B/s" или число
 * @returns {number} - доходность в M/s
 */
function parseIncomeValue(incomeText) {
    if (!incomeText && incomeText !== 0) return 0;
    
    // Если это число - возвращаем как есть или нормализуем
    if (typeof incomeText === 'number') {
        // Если очень большое число - это сырое значение, делим на 1M
        if (incomeText > 10000) {
            return Math.round(incomeText / 1000000 * 10) / 10;
        }
        return incomeText;
    }
    
    // Убираем пробелы и приводим к нижнему регистру
    const clean = String(incomeText).replace(/\s+/g, '').toLowerCase();
    
    // Сначала проверяем B/s (billions) - конвертируем в M/s (*1000)
    const bMatch = clean.match(/\$?([\d.]+)b/);
    if (bMatch) {
        return parseFloat(bMatch[1]) * 1000; // 1.5B -> 1500 M/s
    }
    
    // Паттерны: $112.5m/s, 112.5m/s, $112.5 m/s
    const match = clean.match(/\$?([\d.]+)m/);
    if (match) {
        return parseFloat(match[1]);
    }
    
    // Попробуем просто получить число
    const numMatch = clean.match(/[\d.]+/);
    if (numMatch) {
        return parseFloat(numMatch[0]);
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
 * AI-FIRST: сначала пробуем AI эндпоинт, fallback на regex
 * 
 * @param {string} brainrotName - имя брейнрота
 * @param {number} income - доходность M/s
 * @returns {Promise<object>} - данные о цене
 */
async function fetchEldoradoPrice(brainrotName, income) {
    const cacheKey = getPriceCacheKey(brainrotName, income);
    
    // Проверяем кэш
    const cached = state.eldoradoPrices[cacheKey];
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
        // Если в кэше regex результат и AI pending - пробуем обновить
        if (cached.data && cached.data.aiPending && cached.data.source === 'regex') {
            // Проверяем AI статус в фоне (не блокируем)
            checkAIStatus(brainrotName, income, cacheKey);
        }
        return cached.data;
    }
    
    try {
        const params = new URLSearchParams({
            name: brainrotName,
            income: income.toString()
        });
        
        // Пробуем AI-first эндпоинт
        let data = null;
        try {
            const aiResponse = await fetch(`${API_BASE}/ai-price?${params}`);
            if (aiResponse.ok) {
                data = await aiResponse.json();
                console.log(`🤖 AI price for ${brainrotName}: $${data.suggestedPrice} (source: ${data.source})`);
            }
        } catch (aiError) {
            console.warn('AI price endpoint failed, falling back to regex:', aiError.message);
        }
        
        // Fallback на обычный eldorado-price если AI не сработал
        if (!data || data.error) {
            const response = await fetch(`${API_BASE}/eldorado-price?${params}`);
            if (!response.ok) {
                throw new Error('Failed to fetch price');
            }
            data = await response.json();
            data.source = data.source || 'regex';
        }
        
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
 * Проверяет статус AI парсинга в фоне и обновляет кэш
 */
async function checkAIStatus(brainrotName, income, cacheKey) {
    try {
        const params = new URLSearchParams({
            name: brainrotName,
            income: income.toString(),
            status: ''
        });
        
        const response = await fetch(`${API_BASE}/ai-price?${params}`);
        if (!response.ok) return;
        
        const status = await response.json();
        
        // Если AI закончил - обновляем данные
        if (status.status === 'cached' && status.source === 'ai') {
            // Получаем полные данные
            const aiParams = new URLSearchParams({
                name: brainrotName,
                income: income.toString()
            });
            const aiResponse = await fetch(`${API_BASE}/ai-price?${aiParams}`);
            if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                if (aiData.source === 'ai') {
                    console.log(`🤖 AI update for ${brainrotName}: $${aiData.suggestedPrice}`);
                    state.eldoradoPrices[cacheKey] = {
                        data: aiData,
                        timestamp: Date.now()
                    };
                    // Перерисовываем collection если нужно
                    if (typeof renderBrainrotCollection === 'function') {
                        // Не вызываем полную перерисовку, просто обновим при следующем рендере
                    }
                }
            }
        }
    } catch (e) {
        // Игнорируем ошибки фонового обновления
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

// Offers elements
const offersGridEl = document.getElementById('offersGrid');
const offersStatsEl = document.getElementById('offersStats');
const offerSearchEl = document.getElementById('offerSearch');
const offerSortDropdown = document.getElementById('offerSortDropdown');
const offerStatusDropdown = document.getElementById('offerStatusDropdown');
const selectAllOffersEl = document.getElementById('selectAllOffers');
const bulkAdjustBtn = document.getElementById('bulkAdjustBtn');
const bulkPriceModal = document.getElementById('bulkPriceModal');
const offerPriceModal = document.getElementById('offerPriceModal');

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

// Loading screen element
const loadingScreen = document.getElementById('loadingScreen');

// Hide loading screen
function hideLoadingScreen() {
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadBrainrotMapping();
    loadState();
    loadFarmersDataFromCache(); // Загружаем кэш данных фермеров для мгновенного отображения
    loadPriceCacheFromStorage(); // Загружаем кэш цен из localStorage
    loadAvatarCache(); // Загружаем кэш аватаров
    loadOffersFromStorage(); // Загружаем кэш офферов из localStorage (для подсветки)
    await loadBalanceHistory(); // Загружаем историю баланса (await!)
    setupEventListeners();
    
    if (state.currentKey && state.savedKeys.length > 0) {
        showMainApp();
        hideLoadingScreen(); // Скрываем loading screen после показа приложения
        // Сразу показываем данные из кэша
        if (state.farmersData[state.currentKey]) {
            updateUI();
        }
        // Пробуем загрузить цены с сервера для быстрого отображения
        loadPricesFromServer().then(async loaded => {
            if (loaded) {
                console.log('Loaded prices from server cache');
                // v9.8.10: Also update offers prices
                if (offersState.offers.length > 0) {
                    await updateOffersRecommendedPrices();
                    filterAndRenderOffers();
                }
                updateUI();
                renderFarmKeys();
            }
        });
        // Загружаем офферы в фоне (для подсветки в коллекции)
        loadOffers(false, true).then(() => {
            // После загрузки офферов перерисовываем коллекцию если она открыта
            if (collectionState.allBrainrots.length > 0) {
                renderCollection();
            }
        });
        // Предзагружаем данные топа в фоне
        preloadTopData();
        // Запускаем polling сразу - данные будут обновляться в фоне
        startPolling();
        // Загружаем данные всех фермеров в фоне (не блокируя UI)
        fetchAllFarmersData();
        
        // Автообновление цен каждые 10 минут
        startAutoPriceRefresh();
        
        // Слушаем события обновления офферов от Tampermonkey скрипта
        setupOffersRefreshListener();
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

// Кэширование данных фермеров в localStorage
const FARMERS_CACHE_KEY = 'farmerPanelFarmersCache';
const FARMERS_CACHE_EXPIRY = 5 * 60 * 1000; // 5 минут

function saveFarmersDataToCache() {
    try {
        // Сохраняем только текущий ключ чтобы уменьшить размер
        const currentKeyData = state.farmersData[state.currentKey];
        if (!currentKeyData) return;
        
        const cache = {
            timestamp: Date.now(),
            currentKey: state.currentKey,
            data: { [state.currentKey]: currentKeyData }
        };
        localStorage.setItem(FARMERS_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        // Если QuotaExceeded - очищаем старые данные
        if (e.name === 'QuotaExceededError') {
            console.warn('localStorage full, clearing old cache...');
            try {
                localStorage.removeItem(FARMERS_CACHE_KEY);
                localStorage.removeItem('farmerPanelAvatarCache');
                localStorage.removeItem('farmerPanelBrainrotImages');
            } catch (clearError) {
                console.error('Failed to clear cache:', clearError);
            }
        } else {
            console.error('Failed to save farmers cache:', e);
        }
    }
}

function loadFarmersDataFromCache() {
    try {
        const cached = localStorage.getItem(FARMERS_CACHE_KEY);
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            // Проверяем что кэш не устарел
            if (Date.now() - timestamp < FARMERS_CACHE_EXPIRY && data) {
                state.farmersData = data;
                console.log('Loaded farmers data from cache');
                return true;
            }
        }
    } catch (e) {
        console.error('Failed to load farmers cache:', e);
    }
    return false;
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
    
    // Account switcher dropdown
    const farmerWrapper = document.getElementById('currentFarmerWrapper');
    if (farmerWrapper) {
        farmerWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAccountDropdown();
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const switcher = document.getElementById('accountSwitcher');
        if (switcher && !switcher.contains(e.target)) {
            toggleAccountDropdown(false);
        }
    });
    
    // Mass selection FAB button
    const massSelectFab = document.getElementById('massSelectFab');
    if (massSelectFab) {
        massSelectFab.addEventListener('click', toggleMassSelectionMode);
    }
    
    // Mass generation modal close button
    const closeMassGenModal = document.getElementById('closeMassGenModal');
    if (closeMassGenModal) {
        closeMassGenModal.addEventListener('click', closeMassGenerationModal);
    }
    
    // Start mass generation button
    const startMassGenBtn = document.getElementById('startMassGenBtn');
    if (startMassGenBtn) {
        startMassGenBtn.addEventListener('click', startMassGeneration);
    }
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
        
        // Проверяем новый ли это ключ
        const isNewKey = !state.savedKeys.find(k => k.farmKey === key);
        
        // Add key to saved keys if not exists
        if (isNewKey) {
            state.savedKeys.push({
                farmKey: key,
                username: data.username,
                avatar: data.avatar,
                addedAt: new Date().toISOString()
            });
            
            // Автоматически назначаем цвет рамки для нового пользователя
            try {
                await fetch(`${API_BASE}/user-color`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ farmKey: key })
                });
                console.log('Default color assigned for new user');
            } catch (e) {
                console.warn('Failed to assign default color:', e);
            }
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

// Полная очистка кэша (для решения проблем с отображением)
function clearAllCache() {
    try {
        // Очищаем ВСЁ из localStorage для чистоты
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) keysToRemove.push(key);
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Очищаем state
        state.farmersData = {};
        console.log('All localStorage cleared! Removed', keysToRemove.length, 'keys');
        
        // Перезагружаем страницу
        alert('Кэш очищен! Страница перезагрузится.');
        location.reload();
        return true;
    } catch (e) {
        console.error('Failed to clear cache:', e);
        return false;
    }
}

// Экспортируем в window для доступа из консоли
window.clearAllCache = clearAllCache;

// Views
function showLoginScreen() {
    hideLoadingScreen(); // Скрываем loading screen
    loginScreen.classList.remove('hidden');
    mainApp.classList.add('hidden');
    farmKeyInput.value = '';
    loginError.textContent = '';
}

function showMainApp() {
    hideLoadingScreen(); // Скрываем loading screen
    loginScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    updateCurrentFarmer();
    renderFarmKeys();
    
    // Восстанавливаем последнюю активную вкладку
    restoreLastView();
}

function switchView(viewName) {
    navTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === viewName);
    });
    
    views.forEach(view => {
        view.classList.toggle('active', view.id === `${viewName}View`);
    });
    
    // Сохраняем активную вкладку в localStorage
    try {
        localStorage.setItem('glitched_active_view', viewName);
    } catch (e) {
        console.warn('Failed to save active view:', e);
    }
    
    // Управление видимостью FAB кнопки массового выбора
    const massSelectFab = document.getElementById('massSelectFab');
    if (massSelectFab) {
        if (viewName === 'collection') {
            massSelectFab.classList.add('visible');
        } else {
            massSelectFab.classList.remove('visible');
            // При выходе из collection view - выключаем режим массового выбора
            if (typeof massSelectionState !== 'undefined' && massSelectionState.enabled) {
                toggleMassSelectionMode();
            }
        }
    }
    
    // При переключении на Farm Keys - обновляем данные всех фермеров
    if (viewName === 'farmers') {
        fetchAllFarmersData();
    }
    
    // При переключении на Offers - загружаем офферы и запускаем auto-refresh
    if (viewName === 'offers') {
        initOffersView();
    } else {
        // Останавливаем auto-refresh офферов при выходе с вкладки
        stopOffersAutoRefresh();
    }
    
    // При переключении на Top - инициализируем раздел
    if (viewName === 'top') {
        initTopView();
    }
}

// Восстановить последнюю активную вкладку
function restoreLastView() {
    try {
        const savedView = localStorage.getItem('glitched_active_view');
        if (savedView) {
            // Проверяем что такая вкладка существует
            const validViews = ['dashboard', 'accounts', 'collection', 'farmers', 'offers', 'top'];
            if (validViews.includes(savedView)) {
                switchView(savedView);
                return true;
            }
        }
    } catch (e) {
        console.warn('Failed to restore active view:', e);
    }
    return false;
}

// Polling
let pollingInterval = null;
let currentFetchController = null; // AbortController для отмены запросов
let fetchRequestId = 0; // ID запроса для проверки актуальности

function startPolling() {
    fetchFarmerData();
    pollingInterval = setInterval(fetchFarmerData, 3000); // Быстрее обновление - 3 сек
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// Отменить текущий запрос (при переключении пользователя)
function abortCurrentFetch() {
    if (currentFetchController) {
        currentFetchController.abort();
        currentFetchController = null;
    }
}

async function fetchFarmerData() {
    if (!state.currentKey) return;
    
    const requestKey = state.currentKey;
    
    try {
        const response = await fetch(`${API_BASE}/sync?key=${encodeURIComponent(requestKey)}`);
        
        // Проверяем что ключ не изменился пока ждали ответ
        if (state.currentKey !== requestKey) {
            return;
        }
        
        if (!response.ok) {
            console.error('Failed to fetch farmer data, status:', response.status);
            return;
        }
        
        const data = await response.json();
        
        // Ещё раз проверяем что ключ не изменился
        if (state.currentKey !== requestKey) {
            return;
        }
        
        state.farmersData[requestKey] = data;
        
        // Сохраняем в localStorage для быстрой загрузки
        saveFarmersDataToCache();
        
        // Кэшируем base64 аватары в localStorage для офлайн доступа
        if (data.accountAvatars) {
            for (const [userId, avatarData] of Object.entries(data.accountAvatars)) {
                const avatarUrl = avatarData?.base64 || avatarData?.url;
                if (avatarUrl && isBase64Avatar(avatarUrl)) {
                    saveAvatarToCache(userId, avatarUrl);
                }
            }
        }
        
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
    let currentKeyLoaded = false;
    
    const promises = state.savedKeys.map(async (key) => {
        // Пропускаем текущий ключ если данные уже есть
        if (key.farmKey === state.currentKey && state.farmersData[key.farmKey]) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/sync?key=${encodeURIComponent(key.farmKey)}`);
            if (response.ok) {
                const data = await response.json();
                state.farmersData[key.farmKey] = data;
                
                // Отмечаем что загрузили данные для текущего ключа
                if (key.farmKey === state.currentKey) {
                    currentKeyLoaded = true;
                }
                
                // Кэшируем base64 аватары для офлайн доступа
                if (data.accountAvatars) {
                    for (const [userId, avatarData] of Object.entries(data.accountAvatars)) {
                        const avatarUrl = avatarData?.base64 || avatarData?.url;
                        if (avatarUrl && isBase64Avatar(avatarUrl)) {
                            saveAvatarToCache(userId, avatarUrl);
                        }
                    }
                }
                
                // Записываем баланс в историю
                if (data.totalValue && data.totalValue > 0) {
                    recordBalanceHistory(key.farmKey, data.totalValue);
                } else if (data.accounts && data.accounts.length > 0) {
                    // Рассчитываем если нет totalValue
                    let totalValue = 0;
                    data.accounts.forEach(account => {
                        if (account.brainrots) {
                            totalValue += calculateAccountValue(account);
                        }
                    });
                    if (totalValue > 0) {
                        recordBalanceHistory(key.farmKey, totalValue);
                    }
                }
                
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
    saveFarmersDataToCache(); // Сохраняем в кэш
    renderFarmKeys();
    
    // Если загрузили данные для текущего ключа - обновляем UI
    if (currentKeyLoaded) {
        console.log('Current key data loaded via fetchAllFarmersData, updating UI');
        updateUI();
    }
}

// Check if account is online based on lastUpdate timestamp (primary) and isOnline flag (secondary)
// Account is considered online only if lastUpdate is within last 2 minutes
function isAccountOnline(account) {
    if (!account) return false;
    
    // Primary: always check lastUpdate first - if no recent update, account is offline
    if (!account.lastUpdate) {
        // No lastUpdate - fall back to isOnline flag only
        return account.isOnline === true;
    }
    
    try {
        let lastUpdateTime;
        if (account.lastUpdate.includes('T') || account.lastUpdate.includes('Z')) {
            lastUpdateTime = new Date(account.lastUpdate).getTime();
        } else {
            const isoString = account.lastUpdate.replace(' ', 'T') + 'Z';
            lastUpdateTime = new Date(isoString).getTime();
        }
        
        const now = Date.now();
        const diffSeconds = (now - lastUpdateTime) / 1000;
        
        // If last update was more than 2 minutes ago, account is offline
        // regardless of isOnline flag (script may have crashed without cleanup)
        if (diffSeconds > 120) {
            return false;
        }
        
        // Recent update - trust the isOnline flag, or assume online if flag not set
        return account.isOnline !== false;
    } catch (e) {
        return account.isOnline === true;
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
    
    // Update account value stat
    const accountValue = calculateAccountValue(account);
    let valueStat = cardEl.querySelector('.account-stat.account-value');
    if (accountValue > 0) {
        if (valueStat) {
            const valueEl = valueStat.querySelector('.account-stat-value');
            if (valueEl) valueEl.textContent = '$' + accountValue.toFixed(2);
        } else {
            // Create value stat if it doesn't exist
            const statsContainer = cardEl.querySelector('.account-stats');
            if (statsContainer) {
                const newValueStat = document.createElement('div');
                newValueStat.className = 'account-stat account-value';
                newValueStat.innerHTML = `
                    <div class="account-stat-value">$${accountValue.toFixed(2)}</div>
                    <div class="account-stat-label">Value</div>
                `;
                statsContainer.appendChild(newValueStat);
            }
        }
    } else if (valueStat) {
        valueStat.remove();
    }
    
    // Update brainrots section
    const brainrotsContainer = cardEl.querySelector('.account-brainrots');
    if (account.brainrots && account.brainrots.length > 0) {
        const brainrotsHtml = account.brainrots.slice(0, 10).map(b => {
            const imageUrl = b.imageUrl || getBrainrotImageUrl(b.name);
            // Mutation badge for mini brainrot with custom tooltip
            const mutationColor = b.mutation ? getMutationColor(b.mutation) : null;
            const mutationName = b.mutation ? cleanMutationText(b.mutation) : '';
            const mutationBadge = mutationColor ? `<div class="brainrot-mini-mutation" style="background: ${mutationColor};" data-mutation="${mutationName}"></div>` : '';
            return `
                <div class="brainrot-mini${b.mutation ? ' has-mutation' : ''}" title="${b.name}\n${b.incomeText || ''}">
                    ${mutationBadge}
                    <div class="brainrot-mini-img">
                        ${imageUrl 
                            ? `<img src="${imageUrl}" alt="${b.name}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-brain\\'></i>'">`
                            : '<i class="fas fa-brain" style="color: var(--text-muted); font-size: 1.5rem;"></i>'
                        }
                    </div>
                    <div class="brainrot-mini-name">${truncate(b.name, 8)}</div>
                    <div class="brainrot-mini-income" style="${b.mutation ? 'color: ' + mutationColor : ''}">${b.incomeText || ''}</div>
                </div>
            `;
        }).join('');
        
        if (brainrotsContainer) {
            const scrollEl = brainrotsContainer.querySelector('.brainrots-scroll');
            if (scrollEl) scrollEl.innerHTML = brainrotsHtml;
        } else {
            // Create brainrots section if it doesn't exist
            const footer = cardEl.querySelector('.account-footer');
            const newBrainrots = document.createElement('div');
            newBrainrots.className = 'account-brainrots';
            newBrainrots.innerHTML = `
                <div class="brainrots-title">
                    <i class="fas fa-brain"></i>
                    Top Brainrots
                </div>
                <div class="brainrots-scroll">
                    ${brainrotsHtml}
                </div>
            `;
            if (footer) {
                cardEl.insertBefore(newBrainrots, footer);
            } else {
                cardEl.appendChild(newBrainrots);
            }
        }
    } else if (brainrotsContainer) {
        brainrotsContainer.remove();
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
    
    // Calculate _isOnline for each account
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
    let totalValue = calculateTotalValue(allBrainrots);
    
    // При ручном рефреше используем замороженный баланс чтобы не показывать $0
    if (state.isManualPriceRefresh && state.frozenBalance !== null) {
        totalValue = state.frozenBalance;
    }
    
    // Сохраняем в state для синхронизации везде (но не перезаписываем на 0 при рефреше)
    if (!state.isManualPriceRefresh || totalValue > 0) {
        state.currentTotalValue = totalValue;
    }
    state.currentBalanceChange = getBalanceChange(state.currentKey, PERIODS.hour);
    
    // Записываем в историю баланса
    if (totalValue > 0) {
        recordBalanceHistory(state.currentKey, totalValue);
    }
    
    statsEls.totalAccounts.textContent = accounts.length;
    statsEls.onlineAccounts.textContent = online;
    statsEls.totalIncome.textContent = formatIncome(totalIncome);
    statsEls.totalBrainrots.textContent = totalBrainrots;
    
    // Update total value with change indicator
    if (statsEls.totalValue) {
        const displayValue = state.isManualPriceRefresh && state.frozenBalance !== null ? state.frozenBalance : totalValue;
        statsEls.totalValue.textContent = displayValue > 0 ? `$${displayValue.toFixed(2)}` : '$0.00';
        
        // Show % change from history (hour period) - но НЕ при ручном рефреше
        if (statsEls.totalValueChange) {
            if (!state.isManualPriceRefresh && state.currentBalanceChange && Math.abs(state.currentBalanceChange.changePercent) > 0.01) {
                statsEls.totalValueChange.innerHTML = formatBalanceChange(state.currentBalanceChange.changePercent);
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
    
    // Update balance chart
    updateBalanceChart();
}

function updateCurrentFarmer() {
    const savedKey = state.savedKeys.find(k => k.farmKey === state.currentKey);
    if (!savedKey) return;
    
    const avatar = savedKey.avatar || { icon: 'fa-user', color: '#6366f1' };
    const shortKey = state.currentKey.split('-').slice(-1)[0];
    
    // Get current farmer data
    const data = state.farmersData[state.currentKey];
    const accounts = data?.accounts || [];
    const accountCount = accounts.length;
    
    // Используем синхронизированное значение из state
    const totalValue = state.currentTotalValue;
    
    currentFarmerEl.innerHTML = `
        <div class="farmer-avatar" style="background: ${avatar.color}20; color: ${avatar.color}">
            <i class="fas ${avatar.icon}"></i>
        </div>
        <div class="farmer-info">
            <div class="farmer-name">${savedKey.username || 'Unknown'}</div>
            <div class="farmer-key">...${shortKey}</div>
        </div>
    `;
    
    // Update mini stats in header with % change (используем значение из state)
    // НЕ показываем изменения при ручном рефреше
    // При рефреше используем frozen balance
    const balanceEl = document.getElementById('farmerBalance');
    const countEl = document.getElementById('farmerAccountsCount');
    const displayBalance = state.isManualPriceRefresh && state.frozenBalance !== null ? state.frozenBalance : totalValue;
    
    if (balanceEl) {
        let changeHtml = '';
        if (!state.isManualPriceRefresh && state.currentBalanceChange && Math.abs(state.currentBalanceChange.changePercent) > 0.01) {
            changeHtml = ` ${formatBalanceChange(state.currentBalanceChange.changePercent, true)}`;
        }
        balanceEl.innerHTML = `$${displayBalance.toFixed(2)}${changeHtml}`;
    }
    
    const accountText = accountCount === 1 ? 'account' : 'accounts';
    if (countEl) countEl.textContent = `${accountCount} ${accountText}`;
    
    // Update account dropdown
    updateFarmerSwitcherDropdown();
}

function updateFarmerSwitcherDropdown() {
    const dropdownList = document.getElementById('accountDropdownList');
    if (!dropdownList) return;
    
    if (state.savedKeys.length === 0) {
        dropdownList.innerHTML = `
            <div class="account-dropdown-item" style="justify-content: center; color: var(--text-muted);">
                No saved accounts
            </div>
        `;
        return;
    }
    
    dropdownList.innerHTML = state.savedKeys.map(key => {
        const isActive = key.farmKey === state.currentKey;
        const avatar = key.avatar || { icon: 'fa-user', color: '#6366f1' };
        const data = state.farmersData[key.farmKey];
        const accounts = data?.accounts || [];
        const accountCount = accounts.length;
        const shortKey = key.farmKey.split('-').slice(-1)[0];
        const accountText = accountCount === 1 ? 'account' : 'accounts';
        
        // Для текущего аккаунта используем синхронизированное значение из state
        let farmerValue;
        if (isActive) {
            farmerValue = state.currentTotalValue;
        } else {
            farmerValue = data?.totalValue || 0;
            if (farmerValue === 0 && accounts.length > 0) {
                accounts.forEach(account => {
                    if (account.brainrots) {
                        farmerValue += calculateAccountValue(account);
                    }
                });
            }
        }
        
        return `
            <div class="account-dropdown-item ${isActive ? 'active' : ''}" onclick="quickSwitchAccount('${key.farmKey}')">
                <div class="dropdown-avatar" style="background: ${avatar.color}20; color: ${avatar.color}">
                    <i class="fas ${avatar.icon}"></i>
                </div>
                <div class="dropdown-info">
                    <div class="dropdown-name">${key.username || 'Unknown'}</div>
                    <div class="dropdown-key">...${shortKey}</div>
                </div>
                <div class="dropdown-stats">
                    <div class="dropdown-value">$${farmerValue.toFixed(2)}</div>
                    <div class="dropdown-accounts">${accountCount} ${accountText}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Quick switch account from dropdown
window.quickSwitchAccount = function(farmKey) {
    if (farmKey === state.currentKey) {
        // Close dropdown if clicking active account
        toggleAccountDropdown(false);
        return;
    }
    
    selectFarmKey(farmKey);
    toggleAccountDropdown(false);
    showNotification(`Switched to ${state.savedKeys.find(k => k.farmKey === farmKey)?.username || 'account'}`, 'success');
};

// Toggle account dropdown
function toggleAccountDropdown(show) {
    const switcher = document.getElementById('accountSwitcher');
    const dropdown = document.getElementById('accountDropdownPanel');
    
    if (show === undefined) {
        show = dropdown.classList.contains('hidden');
    }
    
    if (show) {
        dropdown.classList.remove('hidden');
        switcher.classList.add('open');
    } else {
        dropdown.classList.add('hidden');
        switcher.classList.remove('open');
    }
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
    
    // Получаем аватары из данных сервера (теперь base64)
    const data = state.farmersData[state.currentKey];
    const serverAvatars = data?.accountAvatars || {};
    const playerUserIdMap = data?.playerUserIdMap || {}; // Маппинг playerName -> userId
    
    // Применяем серверные аватары к аккаунтам
    accounts.forEach(account => {
        // Определяем userId: напрямую из account или через маппинг по имени
        let userId = account.userId;
        if (!userId && account.playerName && playerUserIdMap[account.playerName]) {
            userId = playerUserIdMap[account.playerName];
        }
        
        if (userId) {
            const avatarData = serverAvatars[String(userId)];
            // Предпочитаем base64 (новый формат), fallback на url (старый формат)
            const avatarUrl = avatarData?.base64 || avatarData?.url;
            if (avatarUrl) {
                account.avatarUrl = avatarUrl;
                // Также сохраняем в локальный кэш для быстрого доступа
                saveAvatarToCache(userId, avatarUrl);
            } else {
                // Fallback на локальный кэш
                const cachedAvatar = getCachedAvatar(userId);
                if (cachedAvatar) {
                    account.avatarUrl = cachedAvatar;
                } else {
                    // Загружаем с Roblox в фоне
                    fetchRobloxAvatar(userId).then(url => {
                        if (url) {
                            // Обновляем изображение в DOM если карточка существует
                            const cardId = getAccountCardId(account);
                            const cardEl = document.getElementById(cardId);
                            if (cardEl) {
                                const img = cardEl.querySelector('.account-avatar img');
                                if (img) img.src = url;
                            }
                        }
                    });
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
    const playerUserIdMap = data?.playerUserIdMap || {}; // Маппинг playerName -> userId
    
    accountsListEl.innerHTML = accounts.map(account => {
        // Получаем аватар из серверных данных (предпочитаем base64)
        let avatarSrc = getDefaultAvatar(account.playerName);
        
        // Определяем userId: напрямую из account или через маппинг по имени
        let userId = account.userId;
        if (!userId && account.playerName && playerUserIdMap[account.playerName]) {
            userId = playerUserIdMap[account.playerName];
        }
        
        if (userId) {
            const avatarData = serverAvatars[String(userId)];
            // Предпочитаем base64, затем url
            const serverAvatar = avatarData?.base64 || avatarData?.url;
            if (serverAvatar) {
                avatarSrc = serverAvatar;
            } else if (account.avatarUrl) {
                avatarSrc = account.avatarUrl;
            } else {
                const cached = getCachedAvatar(userId);
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
        
        // Для текущего аккаунта используем синхронизированное значение из state
        let farmerValue;
        let balanceChange;
        
        if (isActive) {
            farmerValue = state.currentTotalValue;
            balanceChange = state.currentBalanceChange;
        } else {
            farmerValue = data?.totalValue || 0;
            if (farmerValue === 0 && accounts.length > 0) {
                accounts.forEach(account => {
                    if (account.brainrots) {
                        farmerValue += calculateAccountValue(account);
                    }
                });
            }
            balanceChange = getBalanceChange(key.farmKey, PERIODS.hour);
        }
        
        // НЕ показываем изменения при ручном рефреше
        const changeHtml = !state.isManualPriceRefresh && balanceChange && Math.abs(balanceChange.changePercent) > 0.01 
            ? formatBalanceChange(balanceChange.changePercent, true) 
            : '';
        
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
                        <div class="farm-key-code blurred" onclick="toggleAndCopyKey(this, '${key.farmKey}')" title="Click to reveal and copy">
                            <span class="key-text">${key.farmKey}</span>
                            <i class="fas fa-eye-slash key-icon"></i>
                        </div>
                    </div>
                </div>
                <div class="farm-key-right">
                    <div class="farm-key-stats">
                        <div class="farm-key-accounts">${accountCount}</div>
                        <div class="farm-key-label">accounts</div>
                    </div>
                    ${farmerValue > 0 ? `
                    <div class="farm-key-stats farm-key-value">
                        <div class="farm-key-accounts">$${farmerValue.toFixed(2)} ${changeHtml}</div>
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

// Toggle blur and copy farm key
window.toggleAndCopyKey = function(element, farmKey) {
    const wasBlurred = element.classList.contains('blurred');
    const icon = element.querySelector('.key-icon');
    
    // Toggle blur
    element.classList.toggle('blurred');
    
    if (wasBlurred) {
        // Was blurred, now revealed - copy to clipboard
        navigator.clipboard.writeText(farmKey).then(() => {
            showNotification('Key copied to clipboard!', 'success');
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
            
            // Re-blur after 3 seconds
            setTimeout(() => {
                element.classList.add('blurred');
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }, 3000);
        }).catch(() => {
            showNotification('Failed to copy key', 'error');
        });
    } else {
        // Was revealed, now blurred
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    }
};

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
    
    if (!/^[a-zA-Z]{1,15}$/.test(newUsername)) {
        usernameError.textContent = 'Max 15 English letters only (a-z, A-Z)';
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
    // Если уже выбран этот ключ - ничего не делаем
    if (state.currentKey === farmKey) {
        return;
    }
    
    // Останавливаем текущий polling и отменяем запросы
    stopPolling();
    abortCurrentFetch();
    
    state.currentKey = farmKey;
    saveState();
    
    // Сразу показываем данные из кэша если есть
    const cachedData = state.farmersData[farmKey];
    if (cachedData) {
        console.log('Using cached data for', farmKey);
        updateUI();
    }
    
    renderFarmKeys();
    
    // Перезапускаем polling для нового пользователя
    startPolling();
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

// Track last loaded key to avoid repeated loads
let lastLoadedGenerationsKey = null;
let lastLoadedColorKey = null;

// Load generations data for current user (with caching)
async function loadGenerationsData(forceRefresh = false) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return;
        
        // Skip if already loaded for this key (unless forced)
        if (!forceRefresh && lastLoadedGenerationsKey === farmKey && Object.keys(collectionState.generations).length > 0) {
            return;
        }
        
        const response = await fetch(`/api/generations?farmKey=${encodeURIComponent(farmKey)}`);
        const data = await response.json();
        collectionState.generations = data.generations || {};
        lastLoadedGenerationsKey = farmKey;
        console.log('Loaded generations:', Object.keys(collectionState.generations).length);
    } catch (err) {
        console.error('Error loading generations:', err);
        collectionState.generations = {};
    }
}

// Load panel color (single color for entire panel based on farmKey) - with caching
async function loadPanelColor(forceRefresh = false) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) {
            collectionState.panelColor = '#4ade80';
            return;
        }
        
        // Skip if already loaded for this key (unless forced)
        if (!forceRefresh && lastLoadedColorKey === farmKey && collectionState.panelColor) {
            return;
        }
        
        // Пробуем новый API
        try {
            const response = await fetch(`${API_BASE}/user-color?farmKey=${encodeURIComponent(farmKey)}`);
            if (response.ok) {
                const result = await response.json();
                collectionState.panelColor = result.color || '#4ade80';
                collectionState.colorPalette = result.palette || [];
                lastLoadedColorKey = farmKey;
                console.log('User color:', collectionState.panelColor, result.isCustom ? '(custom)' : '(default)');
                return;
            }
        } catch (e) {
            console.warn('New color API failed, using fallback');
        }
        
        // Fallback на старый API
        const response = await fetch(`${API_BASE}/account-colors?farmKey=${encodeURIComponent(farmKey)}`);
        const result = await response.json();
        collectionState.panelColor = result.color || '#4ade80';
        collectionState.colorPalette = result.palette || [];
        lastLoadedColorKey = farmKey;
        console.log('Panel color:', collectionState.panelColor);
    } catch (err) {
        console.error('Error loading panel color:', err);
        collectionState.panelColor = '#4ade80';
    }
}

// Сохранить цвет пользователя
async function saveUserColor(color) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return false;
        
        const response = await fetch(`${API_BASE}/user-color`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ farmKey, color })
        });
        
        if (response.ok) {
            const result = await response.json();
            collectionState.panelColor = result.color;
            console.log('User color saved:', result.color);
            return true;
        }
    } catch (err) {
        console.error('Error saving user color:', err);
    }
    return false;
}

// Save generation record
async function saveGeneration(brainrotName, accountId, resultUrl, income) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return;
        
        const normalizedIncome = normalizeIncomeForApi(income, '');
        
        const response = await fetch('/api/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                farmKey,
                brainrotName,
                accountId,
                income: normalizedIncome,
                resultUrl,
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        if (data.success) {
            // Используем уникальный ключ accountId + name + income
            const genKey = getGenerationKey(accountId, brainrotName, normalizedIncome);
            collectionState.generations[genKey] = data.generation;
            renderCollection();
        }
    } catch (err) {
        console.error('Error saving generation:', err);
    }
}

// Генерация уникального ключа для брейнрота
// ВАЖНО: Заменяем точки на подчёркивания (MongoDB не позволяет точки в ключах)
function getGenerationKey(accountId, name, income) {
    if (!name) return null;
    const normalizedIncome = String(normalizeIncomeForApi(income, '')).replace(/\./g, '_');
    return `${accountId}_${name.toLowerCase().trim().replace(/\./g, '_')}_${normalizedIncome}`;
}

// NOTE: getGroupKey is defined later in MASS SELECTION MODE section

// Check if specific brainrot was generated (by accountId + name + income)
function isGenerated(accountId, name, income) {
    const key = getGenerationKey(accountId, name, income);
    if (!key) return false;
    return !!collectionState.generations[key];
}

// Check if ANY brainrot in group was generated (for grouped cards)
function isGroupGenerated(name, income) {
    const groupKey = getGroupKey(name, income);
    if (!groupKey) return false;
    for (const [key, gen] of Object.entries(collectionState.generations)) {
        if (key.endsWith('_' + groupKey)) {
            return true;
        }
    }
    return false;
}

// Get generation info for specific brainrot
function getGenerationInfo(accountId, name, income) {
    const key = getGenerationKey(accountId, name, income);
    return collectionState.generations[key] || null;
}

// Get all generation infos for a group (returns array)
function getGroupGenerationInfos(name, income) {
    const groupKey = getGroupKey(name, income);
    if (!groupKey) return [];
    const infos = [];
    for (const [key, gen] of Object.entries(collectionState.generations)) {
        if (key.endsWith('_' + groupKey)) {
            infos.push(gen);
        }
    }
    return infos;
}

// Get total generation count for a group (sum of all count values)
function getGroupTotalGenerationCount(name, income) {
    const infos = getGroupGenerationInfos(name, income);
    return infos.reduce((sum, gen) => sum + (gen.count || 1), 0);
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
        collectionState.groupedBrainrots = [];
        return;
    }

    const brainrots = [];
    const accounts = data.accounts;
    let mutationCount = 0;

    for (const account of accounts) {
        if (!account.brainrots) continue;
        
        for (const b of account.brainrots) {
            if (b.mutation) mutationCount++;
            brainrots.push({
                name: b.name,
                income: b.income || 0,
                incomeText: b.incomeText || '',
                imageUrl: b.imageUrl || getBrainrotImageUrl(b.name),
                accountName: account.playerName || 'Unknown',
                accountId: account.visibleUsername || account.userId,
                mutation: b.mutation || null
            });
        }
    }
    
    console.log('[Collection] Total brainrots:', brainrots.length, 'with mutations:', mutationCount);

    collectionState.allBrainrots = brainrots;
    
    // Группируем одинаковые брейнроты (по имени + income)
    collectionState.groupedBrainrots = groupBrainrots(brainrots);
    
    updateAccountDropdown(accounts);
}

// Группировка одинаковых брейнротов по имени и доходу
function groupBrainrots(brainrots) {
    const groups = new Map();
    
    for (const b of brainrots) {
        const income = normalizeIncomeForApi(b.income, b.incomeText);
        const groupKey = getGroupKey(b.name, income);
        
        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                name: b.name,
                income: income, // Use normalized income, not raw
                incomeText: b.incomeText,
                imageUrl: b.imageUrl,
                mutation: b.mutation || null,
                items: [],
                quantity: 0
            });
        }
        
        const group = groups.get(groupKey);
        group.items.push({
            accountId: b.accountId,
            accountName: b.accountName,
            imageUrl: b.imageUrl,
            mutation: b.mutation
        });
        group.quantity++;
        
        // Если у группы ещё нет мутации, но у этого brainrot есть - добавляем
        if (!group.mutation && b.mutation) {
            group.mutation = b.mutation;
        }
    }
    
    return Array.from(groups.values());
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

/**
 * Генерация ссылки на Eldorado для конкретного брейнрота
 * attr_ids mapping для M/s диапазонов:
 * 0-0 = Any, 0-1 = 0-24, 0-2 = 25-49, 0-3 = 50-99, 0-4 = 100-249, 
 * 0-5 = 250-499, 0-6 = 500-749, 0-7 = 750-999, 0-8 = 1+ B/s
 */
function getEldoradoSearchLink(brainrotName, income) {
    const incomeValue = typeof income === 'string' ? parseFloat(income) : income;
    
    // Определяем attr_ids на основе income
    let attrIds = '0-0'; // default = Any
    if (incomeValue >= 1000) attrIds = '0-8';      // 1+ B/s
    else if (incomeValue >= 750) attrIds = '0-7';  // 750-999 M/s
    else if (incomeValue >= 500) attrIds = '0-6';  // 500-749 M/s
    else if (incomeValue >= 250) attrIds = '0-5';  // 250-499 M/s
    else if (incomeValue >= 100) attrIds = '0-4';  // 100-249 M/s
    else if (incomeValue >= 50) attrIds = '0-3';   // 50-99 M/s
    else if (incomeValue >= 25) attrIds = '0-2';   // 25-49 M/s
    else if (incomeValue > 0) attrIds = '0-1';     // 0-24 M/s
    
    const encodedName = encodeURIComponent(brainrotName);
    return `https://www.eldorado.gg/steal-a-brainrot-brainrots/i/259?attr_ids=${attrIds}&te_v2=${encodedName}&offerSortingCriterion=Price&isAscending=true&gamePageOfferIndex=1&gamePageOfferSize=24`;
}

/**
 * Открыть ссылку Eldorado для брейнрота
 */
function openEldoradoLink(brainrotName, income) {
    const link = getEldoradoSearchLink(brainrotName, income);
    window.open(link, '_blank');
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
        const searchText = searchParsed.text;
        const isShortNumeric = /^\d{1,3}$/.test(searchText); // 1-3 digit numbers like 67, 25
        
        filtered = filtered.filter(b => {
            const nameLower = b.name.toLowerCase();
            const accountLower = b.accountName.toLowerCase();
            
            if (isShortNumeric) {
                // For short numeric names, use exact match or word boundary match
                // "67" should match "67" but not "167" or "567"
                const exactMatch = nameLower === searchText;
                const wordBoundaryMatch = new RegExp(`(^|[^\\d])${searchText}([^\\d]|$)`).test(nameLower);
                return exactMatch || wordBoundaryMatch || accountLower.includes(searchText);
            }
            
            // Default includes search for longer queries
            return nameLower.includes(searchText) || accountLower.includes(searchText);
        });
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
    const isSelectionMode = massSelectionState && massSelectionState.isActive;
    
    // Update stats (используем синхронизированное значение из state)
    // При ручном рефреше используем frozen balance
    if (collectionStatsEl) {
        const uniqueNames = new Set(collectionState.allBrainrots.map(b => b.name.toLowerCase()));
        const totalValue = state.isManualPriceRefresh && state.frozenBalance !== null 
            ? state.frozenBalance 
            : state.currentTotalValue;
        
        // Get balance change for collection (используем из state) - НЕ при ручном рефреше
        let changeHtml = '';
        if (!state.isManualPriceRefresh && state.currentBalanceChange && Math.abs(state.currentBalanceChange.changePercent) > 0.01) {
            changeHtml = ' ' + formatBalanceChange(state.currentBalanceChange.changePercent, true);
        }
        
        let statsHtml = '<span><i class="fas fa-layer-group"></i> ' + collectionState.allBrainrots.length + ' total</span>';
        statsHtml += '<span><i class="fas fa-fingerprint"></i> ' + uniqueNames.size + ' unique</span>';
        if (totalValue > 0) {
            statsHtml += '<span class="total-value"><i class="fas fa-dollar-sign"></i> ' + totalValue.toFixed(2) + changeHtml + '</span>';
        }
        if (collectionState.searchQuery || collectionState.accountFilter !== 'all' || collectionState.priceFilter !== 'all') {
            statsHtml += '<span><i class="fas fa-filter"></i> ' + brainrots.length + ' shown</span>';
        }
        if (isSelectionMode) {
            statsHtml += '<span style="color: var(--accent-primary);"><i class="fas fa-check-square"></i> Режим выбора</span>';
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

    // Группируем отфильтрованные брейнроты для отображения
    const groupedFiltered = groupBrainrots(brainrots);
    
    // Рендер карточек с группировкой
    brainrotsGridEl.innerHTML = groupedFiltered.map((group, index) => {
        const income = normalizeIncomeForApi(group.income, group.incomeText);
        const cacheKey = getPriceCacheKey(group.name, income);
        const cachedPrice = state.brainrotPrices[cacheKey];
        
        // Проверяем генерацию для всей группы
        const groupGenerated = isGroupGenerated(group.name, income);
        const generatedCount = getGroupGenerationInfos(group.name, income).length;
        
        // Сколько в группе НЕ сгенерировано
        const notGeneratedCount = group.items.filter(item => 
            !isGenerated(item.accountId, group.name, income)
        ).length;
        
        // Selection mode variables - use group key for stable selection
        const groupKey = getGroupKey(group);
        const isSelected = isSelectionMode && massSelectionState.selectedItems.has(groupKey);
        
        // Check if brainrot has active offer
        const hasOffer = hasActiveOffer(group.name, group.income);
        
        let priceHtml;
        
        if (cachedPrice && cachedPrice.suggestedPrice) {
            // competitorPrice - это цена конкурента (может быть upper или max на рынке)
            // Если priceSource содержит "above market" - показываем "max" вместо "~"
            const isAboveMarket = cachedPrice.priceSource && cachedPrice.priceSource.includes('above market');
            const competitorInfo = cachedPrice.competitorPrice 
                ? `${isAboveMarket ? 'max ' : '~'}$${cachedPrice.competitorPrice.toFixed(2)}` 
                : '';
            const priceChange = getPriceChangePercent(cacheKey, cachedPrice.suggestedPrice);
            const changeHtml = formatPriceChange(priceChange);
            
            // Check for spike
            const isSpikePrice = cachedPrice.isSpike || false;
            const spikeHtml = isSpikePrice 
                ? `<span class="price-spike-badge" title="Price spike detected! Waiting for verification...">⚠️ Spike</span>` 
                : '';
            const pendingInfo = isSpikePrice && cachedPrice.pendingPrice 
                ? `<span class="price-pending" title="Pending: $${cachedPrice.pendingPrice.toFixed(2)}">→ $${cachedPrice.pendingPrice.toFixed(2)}</span>` 
                : '';
            
            // Parsing source badge (regex, ai, or hybrid)
            // Приоритет: source (новый AI-first API) > parsingSource (старый)
            const source = cachedPrice.source || cachedPrice.parsingSource || 'regex';
            let sourceBadge = '';
            
            if (source === 'ai') {
                sourceBadge = `<span class="parsing-source-badge ai" title="Price determined by AI"><i class="fas fa-brain"></i></span>`;
            } else if (source === 'hybrid') {
                sourceBadge = `<span class="parsing-source-badge hybrid" title="AI + Regex hybrid"><i class="fas fa-brain"></i><i class="fas fa-robot"></i></span>`;
            } else {
                // Regex source
                sourceBadge = `<span class="parsing-source-badge regex" title="Price by Bot (Regex)"><i class="fas fa-robot"></i></span>`;
            }
            
            priceHtml = `
                <div class="brainrot-price ${isSpikePrice ? 'spike-warning' : ''}" title="${cachedPrice.priceSource || ''}">
                    <i class="fas fa-tag"></i>
                    <span class="price-text suggested">${formatPrice(cachedPrice.suggestedPrice)}</span>
                    ${sourceBadge}
                    ${isSpikePrice ? spikeHtml : changeHtml}
                    ${pendingInfo}
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
        
        // Определяем статус генерации: все сгенерированы, частично, или ни одного
        const allGenerated = notGeneratedCount === 0;
        const partialGenerated = generatedCount > 0 && notGeneratedCount > 0;
        
        // Собираем детальную информацию по аккаунтам для tooltip
        const accountsDetails = group.items.map(item => {
            const isGen = isGenerated(item.accountId, group.name, income);
            const statusIcon = isGen ? '✅' : '⏳';
            return `${statusIcon} ${item.accountName}`;
        }).join('\n');
        
        const accountsList = group.items.map(i => i.accountName).join(', ');
        
        // Получаем общее количество генераций для этого оффера (суммируем count всех генераций)
        const totalGenerationCount = getGroupTotalGenerationCount(group.name, income);
        
        // Build class list for selection mode
        const cardClasses = ['brainrot-card'];
        if (allGenerated) cardClasses.push('brainrot-generated');
        if (partialGenerated) cardClasses.push('brainrot-partial');
        if (isSelectionMode) cardClasses.push('selectable');
        if (isSelected) cardClasses.push('selected');
        if (hasOffer) cardClasses.push('has-offer');
        
        // Click handler for selection mode
        const clickHandler = isSelectionMode 
            ? `onclick="toggleBrainrotSelection(${index})"` 
            : '';
        
        return `
        <div class="${cardClasses.join(' ')} ${group.mutation ? 'brainrot-mutated' : ''}" 
             data-brainrot-name="${group.name}" 
             data-brainrot-income="${income}" 
             data-brainrot-index="${index}"
             data-brainrot-key="${groupKey}"
             data-quantity="${group.quantity}"
             ${clickHandler}>
            ${hasOffer ? `<div class="brainrot-offer-badge" title="На продаже"><i class="fas fa-shopping-cart"></i></div>` : ''}
            <div class="brainrot-generate-btn ${totalGenerationCount > 0 ? 'has-generations' : ''}" onclick="event.stopPropagation(); handleGroupGenerateClick(${index})" title="Генерировать изображение${group.quantity > 1 ? ' (x' + group.quantity + ')' : ''}${totalGenerationCount > 0 ? '\nСгенерировано: ' + totalGenerationCount + ' раз' : ''}">
                ${totalGenerationCount > 0 ? `<span class="generation-count">${totalGenerationCount}</span>` : `<i class="fas fa-plus"></i>`}
            </div>
            ${group.quantity > 1 ? `
            <div class="brainrot-quantity-badge" data-tooltip="Фермеры:\n${accountsDetails}">
                x${group.quantity}
            </div>
            ` : ''}
            ${groupGenerated && partialGenerated ? `
            <div class="brainrot-generated-badge" title="Сгенерировано аккаунтов: ${generatedCount}/${group.quantity}">
                <i class="fas fa-check-circle"></i>
                <span class="gen-count">${generatedCount}/${group.quantity}</span>
            </div>
            ` : ''}
            <div class="brainrot-image">
                ${group.imageUrl 
                    ? `<img src="${group.imageUrl}" alt="${group.name}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-brain\\'></i>'">`
                    : '<i class="fas fa-brain"></i>'
                }
            </div>
            <div class="brainrot-details">
                <div class="brainrot-name" title="${group.name}">${group.name}</div>
                ${group.mutation ? (() => {
                    const mStyles = getMutationStyles(group.mutation);
                    const textShadow = mStyles.textShadow ? `text-shadow: ${mStyles.textShadow};` : '';
                    return `<div class="brainrot-mutation-line"><span class="brainrot-mutation-badge-inline" style="background: ${mStyles.background}; color: ${mStyles.textColor}; ${textShadow} --glow-color: ${mStyles.glowColor};">${cleanMutationText(group.mutation)}</span></div>`;
                })() : ''}
                <div class="brainrot-income">${group.incomeText || formatIncome(group.income)}</div>
                ${priceHtml}
                <div class="brainrot-account" title="${accountsList}">
                    <i class="fas fa-user${group.quantity > 1 ? 's' : ''}"></i>
                    ${group.quantity > 1 ? group.quantity + ' accounts' : group.items[0]?.accountName || 'Unknown'}
                </div>
            </div>
            <button class="brainrot-eldorado-link" onclick="event.stopPropagation(); openEldoradoLink('${group.name.replace(/'/g, "\\'")}', ${income})" title="View on Eldorado">
                <i class="fas fa-external-link-alt"></i>
            </button>
        </div>`;
    }).join('');
    
    // Сохраняем сгруппированные данные для обработчиков
    collectionState.displayedGroups = groupedFiltered;
    
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
        
        // v9.8.10: Update offers with new prices from collection
        if (offersState.offers.length > 0) {
            await updateOffersRecommendedPrices();
            filterAndRenderOffers();
        }
        
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
        
        // Check for spike
        const isSpikePrice = priceData.isSpike || false;
        const spikeHtml = isSpikePrice 
            ? `<span class="price-spike-badge" title="Price spike detected!">⚠️ Spike</span>` 
            : '';
        const pendingInfo = isSpikePrice && priceData.pendingPrice 
            ? `<span class="price-pending">→ $${priceData.pendingPrice.toFixed(2)}</span>` 
            : '';
        
        // Parsing source badge (regex, ai, or hybrid)
        // Приоритет: source (новый AI-first API) > parsingSource (старый)
        const source = priceData.source || priceData.parsingSource || 'regex';
        let sourceBadge = '';
        
        if (source === 'ai') {
            sourceBadge = `<span class="parsing-source-badge ai" title="Price determined by AI"><i class="fas fa-brain"></i></span>`;
        } else if (source === 'hybrid') {
            sourceBadge = `<span class="parsing-source-badge hybrid" title="AI + Regex hybrid"><i class="fas fa-brain"></i><i class="fas fa-robot"></i></span>`;
        } else {
            sourceBadge = `<span class="parsing-source-badge regex" title="Price by Bot (Regex)"><i class="fas fa-robot"></i></span>`;
        }
        
        if (isSpikePrice) {
            priceEl.classList.add('spike-warning');
        } else {
            priceEl.classList.remove('spike-warning');
        }
        
        priceEl.innerHTML = `
            <i class="fas fa-tag"></i>
            <span class="price-text suggested">${formatPrice(priceData.suggestedPrice)}</span>
            ${sourceBadge}
            ${isSpikePrice ? spikeHtml : changeHtml}
            ${pendingInfo}
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
    // РУЧНОЙ РЕФРЕШ - не записываем изменения в историю баланса
    state.isManualPriceRefresh = true;
    
    // ЗАМОРАЖИВАЕМ баланс ПЕРЕД очисткой цен - он будет отображаться пока цены загружаются
    state.frozenBalance = state.currentTotalValue;
    console.log('Manual price refresh started - balance frozen at $' + state.frozenBalance.toFixed(2));
    
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
    
    // Сбрасываем флаг после завершения рефреша (с задержкой чтобы все обновления прошли)
    setTimeout(() => {
        state.isManualPriceRefresh = false;
        state.frozenBalance = null;
        console.log('Manual price refresh completed - balance unfrozen');
    }, 30000); // 30 секунд на загрузку всех цен
}

/**
 * Автоматическое обновление цен каждые 10 минут
 * Постепенно обновляет цены для всех брейнротов в коллекции
 */
let autoPriceRefreshInterval = null;
let isAutoRefreshing = false;

function startAutoPriceRefresh() {
    if (autoPriceRefreshInterval) {
        clearInterval(autoPriceRefreshInterval);
    }
    
    // Запускаем первое обновление через 10 минут
    autoPriceRefreshInterval = setInterval(async () => {
        if (!state.currentKey || isAutoRefreshing) return;
        
        console.log('🔄 Starting automatic price refresh...');
        await refreshAllPricesGradually();
    }, PRICE_AUTO_REFRESH_INTERVAL);
    
    console.log('⏰ Auto price refresh scheduled every 10 minutes');
}

function stopAutoPriceRefresh() {
    if (autoPriceRefreshInterval) {
        clearInterval(autoPriceRefreshInterval);
        autoPriceRefreshInterval = null;
    }
}

/**
 * Постепенное обновление цен для всех уникальных брейнротов
 * Обновляет по одному брейнроту с задержкой между запросами
 */
async function refreshAllPricesGradually() {
    if (isAutoRefreshing) {
        console.log('Auto refresh already in progress, skipping');
        return;
    }
    
    isAutoRefreshing = true;
    
    try {
        // Собираем все уникальные брейнроты с income
        const uniqueBrainrots = new Map();
        const data = state.farmersData[state.currentKey];
        
        if (!data || !data.accounts) {
            isAutoRefreshing = false;
            return;
        }
        
        for (const account of data.accounts) {
            if (!account.brainrots) continue;
            for (const b of account.brainrots) {
                const income = normalizeIncomeForApi(b.income, b.incomeText);
                const key = `${b.name.toLowerCase()}_${income}`;
                if (!uniqueBrainrots.has(key)) {
                    uniqueBrainrots.set(key, { name: b.name, income, incomeText: b.incomeText });
                }
            }
        }
        
        const total = uniqueBrainrots.size;
        let refreshed = 0;
        
        console.log(`🔄 Refreshing prices for ${total} unique brainrots...`);
        
        // Обновляем по одному с задержкой 500ms между запросами
        for (const [key, brainrot] of uniqueBrainrots) {
            try {
                const cacheKey = getPriceCacheKey(brainrot.name, brainrot.income);
                
                // Проверяем возраст кэша
                const cached = state.eldoradoPrices[cacheKey];
                const cacheAge = cached?.timestamp ? Date.now() - cached.timestamp : Infinity;
                
                // Обновляем только если кэш старше 10 минут
                if (cacheAge > PRICE_CACHE_TTL) {
                    // Удаляем из кэша чтобы принудить новый запрос
                    delete state.eldoradoPrices[cacheKey];
                    delete state.brainrotPrices[cacheKey];
                    
                    // Запрашиваем новую цену
                    const priceData = await fetchEldoradoPrice(brainrot.name, brainrot.income);
                    
                    if (priceData && priceData.suggestedPrice) {
                        // Сохраняем в brainrotPrices для отображения
                        state.brainrotPrices[cacheKey] = {
                            ...priceData,
                            timestamp: Date.now()
                        };
                        refreshed++;
                        console.log(`   ${brainrot.name} (${brainrot.income}M/s): $${priceData.suggestedPrice} [${priceData.source || 'regex'}]`);
                    }
                    
                    // Задержка между запросами чтобы не перегружать API
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (e) {
                console.warn(`Failed to refresh price for ${brainrot.name}:`, e.message);
            }
        }
        
        console.log(`✅ Auto price refresh complete: ${refreshed}/${total} updated`);
        
        // Обновляем UI после всех обновлений
        if (refreshed > 0) {
            savePriceCacheToStorage();
            updateUI();
        }
        
    } catch (error) {
        console.error('Auto price refresh error:', error);
    } finally {
        isAutoRefreshing = false;
    }
}

// Update collection when data changes
async function updateCollection() {
    // Собираем брейнроты и рендерим СРАЗУ (без ожидания)
    collectAllBrainrots();
    filterAndRenderCollection();
    
    // Загружаем generations и panel color в фоне (не блокируем)
    Promise.all([
        loadGenerationsData(),
        loadPanelColor()
    ]).then(() => {
        // Перерендериваем с badges если они изменились
        if (collectionState.filteredBrainrots.length > 0) {
            renderCollection();
        }
    }).catch(err => console.warn('Background load error:', err));
}

// Handle generate button click (for individual brainrots - deprecated, use handleGroupGenerateClick)
function handleGenerateClick(index) {
    const brainrot = collectionState.filteredBrainrots[index];
    if (brainrot) {
        openSupaGenerator(brainrot);
    }
}

// Handle generate button click for grouped brainrots
function handleGroupGenerateClick(index) {
    const group = collectionState.displayedGroups?.[index];
    if (!group) return;
    
    const income = normalizeIncomeForApi(group.income, group.incomeText);
    
    // Находим первый не сгенерированный брейнрот в группе
    const notGeneratedItem = group.items.find(item => 
        !isGenerated(item.accountId, group.name, income)
    );
    
    // Если все сгенерированы - берём первый
    const itemToGenerate = notGeneratedItem || group.items[0];
    
    const brainrotData = {
        name: group.name,
        income: group.income,
        incomeText: group.incomeText,
        imageUrl: group.imageUrl,
        accountName: itemToGenerate.accountName,
        accountId: itemToGenerate.accountId,
        quantity: group.quantity, // Передаём количество для Eldorado
        groupItems: group.items // Все элементы группы
    };
    
    openSupaGenerator(brainrotData);
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
        // Показываем информацию о количестве если > 1
        const quantity = brainrotData.quantity || 1;
        const accountsInfo = quantity > 1 
            ? `${quantity} шт (${brainrotData.groupItems?.map(i => i.accountName).join(', ')})`
            : brainrotData.accountName;
        
        accountInfoEl.innerHTML = `
            <span style="display: inline-flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 12px; border-radius: 3px; background: ${panelColor};"></span>
                ${accountsInfo}
            </span>
            ${quantity > 1 ? `<span class="quantity-badge" style="background: #f59e0b; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">x${quantity}</span>` : ''}
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
                    
                    await saveGeneration(name, accountId, finalResult.resultUrl, income);
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
                
                await saveGeneration(name, accountId, result.resultUrl, income);
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
    
    // Получаем цену по ключу name + income
    const normalizedIncome = normalizeIncomeForApi(currentSupaBrainrot?.income, income);
    const priceKey = getPriceCacheKey(name, normalizedIncome);
    const priceData = state.brainrotPrices[priceKey];
    
    if (priceData && priceData.suggestedPrice) {
        maxPrice = priceData.suggestedPrice;
        minPrice = Math.floor(maxPrice * 0.9);
    }
    
    // Количество одинаковых брейнротов (для Eldorado Quantity)
    const quantity = currentSupaBrainrot?.quantity || 1;
    
    // Формируем данные для Tampermonkey скрипта
    const offerData = {
        name: name,
        income: income,
        imageUrl: imageUrl,
        generatedImageUrl: currentSupaResult.resultUrl,
        minPrice: minPrice,
        maxPrice: maxPrice,
        quantity: quantity, // Количество для Eldorado Total Quantity
        rarity: currentSupaBrainrot?.rarity || '', // Secret, Mythical, etc
        accountId: currentSupaBrainrot?.accountId,
        accountName: currentSupaBrainrot?.accountName,
        farmKey: state.currentKey, // Передаём farmKey для сохранения оффера в панель
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

// ==========================================
// MASS SELECTION MODE
// ==========================================

/**
 * Get unique key for a brainrot group (name + income)
 * Used for stable selection across search/filter operations
 * Can be called as getGroupKey(group) or getGroupKey(name, income)
 * Note: income is NOT rounded - each unique income value creates a separate group
 */
function getGroupKey(nameOrGroup, incomeArg) {
    let name, income;
    
    // Support both signatures: getGroupKey(group) and getGroupKey(name, income)
    if (typeof nameOrGroup === 'object' && nameOrGroup !== null) {
        // Called with group object
        if (!nameOrGroup.name) return '';
        name = nameOrGroup.name;
        income = normalizeIncomeForApi(nameOrGroup.income, nameOrGroup.incomeText);
    } else {
        // Called with name and income
        if (!nameOrGroup) return '';
        name = nameOrGroup;
        income = incomeArg || 0;
    }
    
    // Use exact income (with dots replaced by underscores) - NO rounding!
    // Each unique income value should be a separate group
    const incomeStr = String(income).replace(/\./g, '_');
    return `${name.toLowerCase()}_${incomeStr}`;
}

/**
 * Check if brainrot has an active offer
 */
function hasActiveOffer(brainrotName, income) {
    if (!offersState.offers || offersState.offers.length === 0) return false;
    const normalizedIncome = normalizeIncomeForApi(income, null);
    const roundedIncome = Math.floor(normalizedIncome / 10) * 10;
    
    return offersState.offers.some(offer => {
        if (!offer.brainrotName) return false;
        const offerIncome = normalizeIncomeForApi(offer.income, offer.incomeRaw);
        const offerRoundedIncome = Math.floor(offerIncome / 10) * 10;
        return offer.brainrotName.toLowerCase() === brainrotName.toLowerCase() && 
               offerRoundedIncome === roundedIncome;
    });
}

// Mass selection state
const MASS_SELECTION_MAX = 10; // Maximum items for mass generation
let massSelectionState = {
    isActive: false,
    selectedItems: new Set(), // Set of group keys (stable across search/filter)
    isGenerating: false
};

// Toggle mass selection mode
function toggleMassSelectionMode() {
    massSelectionState.isActive = !massSelectionState.isActive;
    
    const fab = document.getElementById('massSelectFab');
    const indicator = document.getElementById('massSelectIndicator');
    
    if (massSelectionState.isActive) {
        fab.classList.add('active');
        fab.innerHTML = '<i class="fas fa-times"></i>';
        fab.title = 'Выйти из режима выбора';
        indicator.classList.add('visible');
        massSelectionState.selectedItems = new Set();
        updateMassSelectionUI();
    } else {
        fab.classList.remove('active');
        fab.innerHTML = '<i class="fas fa-layer-group"></i>';
        fab.title = 'Массовый выбор для генерации';
        indicator.classList.remove('visible');
        massSelectionState.selectedItems = new Set();
    }
    
    // Re-render collection to show/hide checkboxes
    renderCollection();
}

// Toggle brainrot group selection (now uses group key instead of index)
function toggleBrainrotSelection(index) {
    if (!massSelectionState.isActive) return;
    
    const group = collectionState.displayedGroups?.[index];
    if (!group) return;
    
    const key = getGroupKey(group);
    
    if (massSelectionState.selectedItems.has(key)) {
        massSelectionState.selectedItems.delete(key);
    } else {
        // Check limit before adding
        if (massSelectionState.selectedItems.size >= MASS_SELECTION_MAX) {
            showNotification(`Максимум ${MASS_SELECTION_MAX} брейнротов для массовой генерации`, 'warning');
            return;
        }
        massSelectionState.selectedItems.add(key);
    }
    
    updateMassSelectionUI();
    
    // Update card appearance
    const card = document.querySelector(`[data-brainrot-index="${index}"]`);
    if (card) {
        card.classList.toggle('selected', massSelectionState.selectedItems.has(key));
    }
}

// Update mass selection UI (counter and button)
function updateMassSelectionUI() {
    const countEl = document.getElementById('massSelectCount');
    const btnEl = document.getElementById('massSelectGenerateBtn');
    const selectedCount = massSelectionState.selectedItems.size;
    
    // Calculate total quantity by finding groups with matching keys
    let totalQuantity = 0;
    if (collectionState.displayedGroups) {
        for (const group of collectionState.displayedGroups) {
            const key = getGroupKey(group);
            if (massSelectionState.selectedItems.has(key)) {
                totalQuantity += group.quantity || 1;
            }
        }
    }
    
    // Show: selected groups count (and total brainrots if different)
    if (countEl) {
        if (totalQuantity > selectedCount) {
            countEl.textContent = `${selectedCount} групп (${totalQuantity} шт)`;
        } else {
            countEl.textContent = `${selectedCount} шт`;
        }
    }
    if (btnEl) {
        btnEl.disabled = selectedCount === 0;
        btnEl.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> Генерировать ${selectedCount} шт`;
    }
}

// Open mass generation modal
function openMassGenerationModal() {
    console.log('openMassGenerationModal called, selected items:', massSelectionState.selectedItems.size);
    
    if (massSelectionState.selectedItems.size === 0) {
        console.warn('No items selected');
        return;
    }
    
    const modal = document.getElementById('massGenerationModal');
    if (!modal) {
        console.error('Mass generation modal not found!');
        return;
    }
    
    console.log('Modal found:', modal);
    console.log('displayedGroups:', collectionState.displayedGroups?.length);
    
    const list = document.getElementById('massGenList');
    const countEl = document.getElementById('massGenCount');
    const progressEl = document.getElementById('massGenProgress');
    const errorEl = document.getElementById('massGenError');
    const startBtn = document.getElementById('startMassGen');
    const actionsEl = document.getElementById('massGenActions');
    const footerInfo = document.getElementById('massGenFooterInfo');
    
    // Reset state
    if (progressEl) progressEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (actionsEl) actionsEl.classList.add('hidden');
    if (footerInfo) footerInfo.classList.remove('hidden');
    if (startBtn) startBtn.disabled = false;
    massSelectionState.generationResults = [];
    
    // Get selected groups by key (find in displayedGroups)
    const selectedGroups = [];
    if (collectionState.displayedGroups) {
        for (const group of collectionState.displayedGroups) {
            const key = getGroupKey(group);
            if (massSelectionState.selectedItems.has(key)) {
                selectedGroups.push({ ...group, groupKey: key });
            }
        }
    }
    
    const totalItems = selectedGroups.reduce((sum, g) => sum + (g.quantity || 1), 0);
    
    // Update button text
    const btnText = document.getElementById('massGenBtnText');
    if (btnText) {
        btnText.textContent = `Генерировать ${selectedGroups.length} шт`;
    }
    startBtn.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> <span id="massGenBtnText">Генерировать ${selectedGroups.length} шт</span>`;
    
    // Render list of selected items
    list.innerHTML = selectedGroups.map((group, i) => {
        const accountsList = group.items ? group.items.map(item => item.accountName).join(', ') : 'Unknown';
        return `
            <div class="mass-gen-item" data-item-index="${i}" data-group-key="${group.groupKey}">
                <img class="mass-gen-item-img" src="${group.imageUrl || ''}" alt="${group.name}" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%231a1a2e%22 width=%2240%22 height=%2240%22/></svg>'">
                <div class="mass-gen-item-info">
                    <div class="mass-gen-item-name">${group.name}${group.quantity > 1 ? ` <span style="color:#f59e0b;">x${group.quantity}</span>` : ''}</div>
                    <div class="mass-gen-item-details">
                        <span><i class="fas fa-coins"></i> ${group.incomeText || formatIncome(group.income)}</span>
                        <span><i class="fas fa-user"></i> ${accountsList}</span>
                    </div>
                </div>
                <div class="mass-gen-item-status pending" data-status-index="${i}">
                    <i class="fas fa-clock"></i>
                </div>
                <button class="mass-gen-item-remove" onclick="removeMassGenItem(${i})" title="Удалить">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
    
    // Update count in modal (if element exists)
    if (countEl) {
        countEl.textContent = selectedGroups.length;
    }
    modal.classList.remove('hidden');
}

// Remove item from mass generation list
function removeMassGenItem(itemIndex) {
    const list = document.getElementById('massGenList');
    const item = list.querySelector(`[data-item-index="${itemIndex}"]`);
    
    if (item) {
        item.remove();
        
        // Update indices for remaining items
        const items = list.querySelectorAll('.mass-gen-item');
        items.forEach((el, newIdx) => {
            el.dataset.itemIndex = newIdx;
            const statusEl = el.querySelector('[data-status-index]');
            if (statusEl) statusEl.dataset.statusIndex = newIdx;
            const removeBtn = el.querySelector('.mass-gen-item-remove');
            if (removeBtn) removeBtn.setAttribute('onclick', `removeMassGenItem(${newIdx})`);
        });
        
        // Update count
        const countEl = document.getElementById('massGenCount');
        const startBtn = document.getElementById('startMassGen');
        const count = items.length;
        countEl.textContent = count;
        
        if (count === 0) {
            startBtn.disabled = true;
        }
    }
}

// Close mass generation modal
function closeMassGenerationModal() {
    const modal = document.getElementById('massGenerationModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    // Reset generating state if was cancelled
    if (massSelectionState.isGenerating) {
        massSelectionState.isGenerating = false;
    }
}

// Start mass generation
async function startMassGeneration() {
    const list = document.getElementById('massGenList');
    const items = list.querySelectorAll('.mass-gen-item');
    const progressEl = document.getElementById('massGenProgress');
    const progressFill = document.getElementById('massGenProgressFill');
    const progressText = document.getElementById('massGenProgressText');
    const progressPercent = document.getElementById('massGenProgressPercent');
    const startBtn = document.getElementById('startMassGen');
    const errorEl = document.getElementById('massGenError');
    const footerInfo = document.getElementById('massGenFooterInfo');
    
    if (items.length === 0) return;
    
    massSelectionState.isGenerating = true;
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Генерация...';
    progressEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    if (footerInfo) footerInfo.classList.add('hidden');
    
    // Disable remove buttons
    list.querySelectorAll('.mass-gen-item-remove').forEach(btn => btn.style.display = 'none');
    
    // Get groups to generate from DOM items using stored groupKey
    const groupsToGenerate = [];
    items.forEach((item, idx) => {
        const groupKey = item.dataset.groupKey;
        // Find the group in displayed groups by groupKey (unique identifier)
        const group = collectionState.displayedGroups?.find(g => getGroupKey(g) === groupKey);
        if (group) {
            console.log('[MassGen] Found group:', group.name, 'quantity:', group.quantity);
            groupsToGenerate.push({
                ...group,
                itemIndex: idx
            });
        } else {
            console.warn('[MassGen] Group not found for key:', groupKey);
        }
    });
    
    const total = groupsToGenerate.length;
    let completed = 0;
    let errors = 0;
    const results = [];
    
    // Queue for Eldorado
    const eldoradoQueue = [];
    
    for (const group of groupsToGenerate) {
        const idx = group.itemIndex;
        const statusEl = list.querySelector(`[data-status-index="${idx}"]`);
        
        // Update status to processing
        if (statusEl) {
            statusEl.className = 'mass-gen-item-status processing';
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        
        try {
            // Get price from cache
            const income = normalizeIncomeForApi(group.income, group.incomeText);
            const cacheKey = getPriceCacheKey(group.name, income);
            const cachedPrice = state.brainrotPrices[cacheKey];
            const price = cachedPrice?.suggestedPrice || 0;
            
            // Use panel color
            const borderColor = collectionState.panelColor || '#4ade80';
            
            // Generate image
            const response = await fetch(`/api/supa-generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: group.name, 
                    income: group.incomeText || formatIncome(group.income), 
                    price: price ? `$${price.toFixed(2)}` : '',
                    imageUrl: group.imageUrl,
                    borderColor,
                    quantity: group.quantity || 1
                })
            });
            
            let result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Generation failed');
            }
            
            // If pending, poll for result
            if (result.pending && result.taskId) {
                console.log('Generation pending, polling for result...');
                for (let attempt = 0; attempt < 20; attempt++) {
                    await new Promise(r => setTimeout(r, 1500));
                    const statusResponse = await fetch(`/api/supa-status?taskId=${result.taskId}`);
                    const statusData = await statusResponse.json();
                    
                    if (statusData.state === 'done' && statusData.resultUrl) {
                        result = { ...result, resultUrl: statusData.resultUrl, pending: false };
                        break;
                    } else if (statusData.state === 'error') {
                        throw new Error('Generation failed during polling');
                    }
                }
                
                if (!result.resultUrl) {
                    throw new Error('Generation timed out');
                }
            }
            
            // Save generation record for each item in the group
            if (group.items) {
                for (const item of group.items) {
                    await saveGeneration(group.name, item.accountId, result.resultUrl, income);
                }
            }
            
            // Always add to Eldorado queue
            eldoradoQueue.push({
                name: group.name,
                income: group.incomeText || formatIncome(group.income),
                imageUrl: result.resultUrl,
                price: price || 0,
                quantity: group.quantity || 1,
                accountName: group.items?.map(i => i.accountName).join(', ') || 'Unknown'
            });
            
            results.push({ success: true, name: group.name, resultUrl: result.resultUrl });
            
            // Update status to done and update image
            if (statusEl) {
                statusEl.className = 'mass-gen-item-status done';
                statusEl.innerHTML = '<i class="fas fa-check"></i>';
            }
            
            // Update image in the modal to show generated result
            const itemEl = list.querySelector(`[data-item-index="${idx}"]`);
            if (itemEl) {
                const imgEl = itemEl.querySelector('.mass-gen-item-img');
                if (imgEl) {
                    imgEl.src = result.resultUrl;
                    imgEl.style.border = '2px solid #22c55e';
                }
            }
            
        } catch (error) {
            console.error('Mass gen error for', group.name, error);
            errors++;
            results.push({ success: false, name: group.name, error: error.message });
            
            // Update status to error
            if (statusEl) {
                statusEl.className = 'mass-gen-item-status error';
                statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            }
        }
        
        completed++;
        const percent = Math.round((completed / total) * 100);
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `${completed} / ${total}`;
        progressPercent.textContent = `${percent}%`;
        
        // Small delay between generations
        if (completed < total) {
            await new Promise(r => setTimeout(r, 500));
        }
    }
    
    // Save Eldorado queue to localStorage (always save if there are items)
    if (eldoradoQueue.length > 0) {
        localStorage.setItem('eldoradoQueue', JSON.stringify(eldoradoQueue));
        localStorage.setItem('eldoradoQueueIndex', '0');
        localStorage.setItem('eldoradoQueueCompleted', '[]');
        localStorage.setItem('eldoradoQueueTimestamp', Date.now().toString());
        console.log('Eldorado queue saved:', eldoradoQueue.length, 'items');
    }
    
    // Store results for download/eldorado actions
    massSelectionState.generationResults = results;
    massSelectionState.isGenerating = false;
    
    // Show results
    const successCount = results.filter(r => r.success).length;
    startBtn.innerHTML = `<i class="fas fa-check"></i> Готово ${successCount}/${total}`;
    
    if (errors > 0) {
        errorEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${errors} ошибок при генерации`;
        errorEl.classList.remove('hidden');
    }
    
    // Update collection to show generated badges
    renderCollection();
    
    // Show action buttons if there are successful generations
    if (successCount > 0) {
        const actionsEl = document.getElementById('massGenActions');
        if (actionsEl) {
            actionsEl.classList.remove('hidden');
        }
    }
    
    // Show notification
    if (eldoradoQueue.length > 0) {
        showNotification(`✅ Сгенерировано ${successCount}/${total}. Нажмите "Выложить на Eldorado" для создания офферов.`, 'success');
    } else {
        showNotification(`✅ Сгенерировано ${successCount} из ${total}`, successCount === total ? 'success' : 'info');
    }
}

// Download all generated images
async function downloadAllMassGenImages() {
    const results = massSelectionState.generationResults || [];
    const successResults = results.filter(r => r.success && r.resultUrl);
    
    if (successResults.length === 0) {
        showNotification('Нет изображений для скачивания', 'error');
        return;
    }
    
    const downloadBtn = document.getElementById('massGenDownloadAll');
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Скачивание...';
    
    try {
        for (let i = 0; i < successResults.length; i++) {
            const result = successResults[i];
            const response = await fetch(result.resultUrl);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${result.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            // Small delay between downloads
            if (i < successResults.length - 1) {
                await new Promise(r => setTimeout(r, 300));
            }
        }
        
        showNotification(`✅ Скачано ${successResults.length} изображений`, 'success');
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Ошибка при скачивании: ' + error.message, 'error');
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Скачать все';
    }
}

// Start Eldorado queue from mass generation
async function startMassEldoradoQueue() {
    const queue = localStorage.getItem('eldoradoQueue');
    if (!queue) {
        showNotification('Очередь пуста. Сначала выполните генерацию с включённой опцией "Создать очередь для Eldorado"', 'error');
        return;
    }
    
    const queueData = JSON.parse(queue);
    if (queueData.length === 0) {
        showNotification('Очередь пуста', 'error');
        return;
    }
    
    // Get first item
    const firstItem = queueData[0];
    
    // Save queue to API for cross-domain access
    try {
        await fetch(`${API_BASE}/queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                farmKey: state.currentKey,
                queue: queueData
            })
        });
        console.log('Queue saved to API for cross-domain access');
    } catch (e) {
        console.warn('Failed to save queue to API:', e);
    }
    
    // Build offer data for URL - minimal data only, queue is in API
    const offerData = {
        name: firstItem.name,
        income: firstItem.income,
        generatedImageUrl: firstItem.imageUrl,
        maxPrice: parseFloat(firstItem.price) || 0,
        minPrice: parseFloat(firstItem.price) || 0,
        quantity: firstItem.quantity || 1,
        accountName: firstItem.accountName,
        farmKey: state.currentKey,
        fromQueue: true,
        queueIndex: 0,
        queueTotal: queueData.length
        // fullQueue removed - too long for URL, using API instead
    };
    
    const encodedData = encodeURIComponent(JSON.stringify(offerData));
    const url = `https://www.eldorado.gg/sell/offer/CustomItem/259?glitched_data=${encodedData}`;
    
    // Open in new tab
    window.open(url, '_blank');
    
    showNotification(`🚀 Запущена очередь Eldorado: ${queueData.length} офферов`, 'success');
    
    // Close modal and exit selection mode
    closeMassGenerationModal();
    if (massSelectionState.isActive) {
        toggleMassSelectionMode();
    }
}

// Setup mass selection event listeners
function setupMassSelectionListeners() {
    const fab = document.getElementById('massSelectFab');
    const generateBtn = document.getElementById('massSelectGenerateBtn');
    const closeModalBtn = document.getElementById('closeMassGenModal');
    const cancelBtn = document.getElementById('cancelMassGen');
    const startBtn = document.getElementById('startMassGen');
    const modalOverlay = document.querySelector('#massGenerationModal .modal-overlay');
    const downloadAllBtn = document.getElementById('massGenDownloadAll');
    const startEldoradoBtn = document.getElementById('massGenStartEldorado');
    
    if (fab) {
        fab.addEventListener('click', toggleMassSelectionMode);
    }
    
    if (generateBtn) {
        generateBtn.addEventListener('click', openMassGenerationModal);
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeMassGenerationModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeMassGenerationModal);
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', startMassGeneration);
    }
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeMassGenerationModal);
    }
    
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', downloadAllMassGenImages);
    }
    
    if (startEldoradoBtn) {
        startEldoradoBtn.addEventListener('click', startMassEldoradoQueue);
    }
}

// Initialize collection listeners on DOM ready
setupCollectionListeners();
setupMassSelectionListeners();

// ==========================================
// OFFERS MANAGEMENT
// ==========================================

// Offers state
const offersState = {
    offers: [],
    filteredOffers: [],
    selectedOffers: new Set(),
    searchQuery: '',
    sortBy: 'newest',
    statusFilter: 'all',
    currentOffer: null,
    lastLoadedKey: null,  // Track which key offers were loaded for
    lastLoadTime: 0       // Track when offers were loaded
};

const OFFERS_CACHE_TTL = 10 * 1000; // 10 seconds cache for real-time updates
const OFFERS_STORAGE_KEY = 'farmpanel_offers_cache';
const OFFER_IMAGES_CACHE_KEY = 'farmpanel_offer_images';

// Image cache for offer images (base64)
let offerImagesCache = {};

// Load cached offer images from localStorage
function loadOfferImagesCache() {
    try {
        const cached = localStorage.getItem(OFFER_IMAGES_CACHE_KEY);
        if (cached) {
            offerImagesCache = JSON.parse(cached);
            console.log('Loaded', Object.keys(offerImagesCache).length, 'cached offer images');
        }
    } catch (e) {
        console.error('Error loading offer images cache:', e);
        offerImagesCache = {};
    }
}

// Save offer images cache to localStorage
function saveOfferImagesCache() {
    try {
        localStorage.setItem(OFFER_IMAGES_CACHE_KEY, JSON.stringify(offerImagesCache));
    } catch (e) {
        console.error('Error saving offer images cache:', e);
    }
}

// Get cached image or return original URL
// Note: External images (like Eldorado's Azure Blob) don't support CORS,
// so we can't fetch them to convert to base64. Just return the URL and let <img> display it.
function getCachedOfferImage(imageUrl, offerId) {
    if (!imageUrl) return null;
    
    // Use offerId as cache key
    const cacheKey = offerId || imageUrl;
    
    // Return cached base64 if available (for previously cached images)
    if (offerImagesCache[cacheKey]) {
        return offerImagesCache[cacheKey];
    }
    
    // Don't try to fetch external images - they block CORS
    // Just return the original URL for <img> tag to display
    return imageUrl;
}

// Disabled: External images don't support CORS, can't fetch to convert to base64
// async function cacheOfferImage(imageUrl, cacheKey) { ... }

// Initialize offer images cache
loadOfferImagesCache();

// Load offers from localStorage cache
function loadOffersFromStorage() {
    try {
        const cached = localStorage.getItem(OFFERS_STORAGE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            if (data.farmKey === state.currentKey && data.offers) {
                offersState.offers = data.offers;
                offersState.lastLoadedKey = data.farmKey;
                offersState.lastLoadTime = data.timestamp || 0;
                console.log('Loaded', data.offers.length, 'offers from localStorage cache');
                return true;
            }
        }
    } catch (e) {
        console.error('Error loading offers from storage:', e);
    }
    return false;
}

// Save offers to localStorage cache
function saveOffersToStorage() {
    try {
        const data = {
            farmKey: state.currentKey,
            offers: offersState.offers,
            timestamp: Date.now()
        };
        localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving offers to storage:', e);
    }
}

// Load offers from server (with caching) - silent mode for background loading
async function loadOffers(forceRefresh = false, silent = false) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return;
        
        const now = Date.now();
        const isSameKey = offersState.lastLoadedKey === farmKey;
        const cacheValid = now - offersState.lastLoadTime < OFFERS_CACHE_TTL;
        
        // Use cache if same key and not expired (unless force refresh)
        if (!forceRefresh && isSameKey && cacheValid && offersState.offers.length > 0) {
            // Just re-render from cache
            if (!silent) {
                filterAndRenderOffers();
            }
            return;
        }
        
        // Save previous state for comparison
        const previousOffers = [...offersState.offers];
        
        // Trigger server scan first (non-blocking for silent mode)
        if (forceRefresh && typeof triggerServerScan === 'function') {
            if (silent) {
                triggerServerScan(); // Don't await in silent mode
            } else {
                await triggerServerScan();
            }
        }
        
        const response = await fetch(`${API_BASE}/offers?farmKey=${encodeURIComponent(farmKey)}`);
        const data = await response.json();
        
        // Server already includes recommendedPrice from global_brainrot_prices
        offersState.offers = data.offers || [];
        offersState.lastLoadedKey = farmKey;
        offersState.lastLoadTime = data.timestamp || now;
        
        // v9.8.10: Update with local price cache (may be fresher than server DB)
        await updateOffersRecommendedPrices();
        
        // Save to localStorage for persistence
        saveOffersToStorage();
        
        // Always update UI - compare with previous state for silent mode
        const offersChanged = hasOffersChanged(previousOffers, offersState.offers);
        if (!silent || offersChanged) {
            filterAndRenderOffers();
            if (silent && offersChanged) {
                console.log('🔄 Offers UI updated (changes detected)');
            }
        }
        console.log('Loaded offers from server:', offersState.offers.length, 'with prices from global cache');
    } catch (err) {
        console.error('Error loading offers:', err);
        offersState.offers = [];
    }
}

// Check if offers have changed (for smart UI updates)
function hasOffersChanged(oldOffers, newOffers) {
    if (!oldOffers || oldOffers.length !== newOffers.length) return true;
    
    for (let i = 0; i < newOffers.length; i++) {
        const newOffer = newOffers[i];
        const oldOffer = oldOffers.find(o => o.offerId === newOffer.offerId);
        
        if (!oldOffer) return true;
        if (oldOffer.status !== newOffer.status) return true;
        if (oldOffer.currentPrice !== newOffer.currentPrice) return true;
        if (oldOffer.imageUrl !== newOffer.imageUrl) return true;
    }
    
    return false;
}

// Setup listener for offers refresh from Tampermonkey script
function setupOffersRefreshListener() {
    // Listen for storage changes (cross-tab communication)
    window.addEventListener('storage', (e) => {
        if (e.key === 'glitched_refresh_offers') {
            console.log('Received offers refresh signal from Tampermonkey');
            // Force refresh offers
            setTimeout(() => {
                loadOffers(true, false).then(() => {
                    console.log('Offers refreshed after signal');
                    showNotification('✅ Офферы обновлены', 'success');
                });
            }, 2000); // Wait 2 seconds for Eldorado to process the offer
        }
    });
    
    // Also check on focus (when user switches back to panel)
    window.addEventListener('focus', () => {
        const lastRefresh = localStorage.getItem('glitched_refresh_offers');
        if (lastRefresh) {
            const age = Date.now() - parseInt(lastRefresh, 10);
            if (age < 30000) { // Within 30 seconds
                console.log('Detected recent offers update on focus');
                loadOffers(true, false);
                localStorage.removeItem('glitched_refresh_offers');
            }
        }
    });
}

// Update recommended prices for offers
async function updateOffersRecommendedPrices() {
    let updated = 0;
    let notFound = 0;
    
    for (const offer of offersState.offers) {
        if (offer.brainrotName && offer.income) {
            // Use incomeRaw for proper parsing (handles "1.5B/s" etc)
            const normalizedIncome = normalizeIncomeForApi(offer.income, offer.incomeRaw);
            const priceKey = getPriceCacheKey(offer.brainrotName, normalizedIncome);
            const priceData = state.brainrotPrices[priceKey];
            
            if (priceData && priceData.suggestedPrice && priceData.suggestedPrice > 0) {
                // Store previous recommended price before updating
                if (offer.recommendedPrice && offer.recommendedPrice !== priceData.suggestedPrice) {
                    offer.previousRecommendedPrice = offer.recommendedPrice;
                }
                offer.recommendedPrice = priceData.suggestedPrice;
                // Spike logic removed - centralized cache has verified prices
                updated++;
            } else {
                // Keep existing recommendedPrice from DB if price not in cache
                // Don't overwrite with 0
                notFound++;
            }
        }
    }
    
    if (notFound > 0) {
        console.log(`Offers prices: ${updated} updated, ${notFound} not found in cache`);
    }
}

// Filter and render offers
function filterAndRenderOffers() {
    let filtered = [...offersState.offers];
    
    // Search filter
    if (offersState.searchQuery) {
        const q = offersState.searchQuery.toLowerCase();
        const isShortNumeric = /^\d{1,3}$/.test(q); // 1-3 digit numbers like 67, 25
        
        filtered = filtered.filter(o => {
            const nameLower = o.brainrotName?.toLowerCase() || '';
            const offerIdLower = o.offerId?.toLowerCase() || '';
            
            if (isShortNumeric) {
                // For short numeric names, use exact match or word boundary match
                const exactMatch = nameLower === q;
                const wordBoundaryMatch = new RegExp(`(^|[^\\d])${q}([^\\d]|$)`).test(nameLower);
                return exactMatch || wordBoundaryMatch || offerIdLower.includes(q);
            }
            
            return nameLower.includes(q) || offerIdLower.includes(q);
        });
    }
    
    // Status filter
    if (offersState.statusFilter === 'active') {
        filtered = filtered.filter(o => o.status === 'active');
    } else if (offersState.statusFilter === 'paused') {
        filtered = filtered.filter(o => o.status === 'paused');
    } else if (offersState.statusFilter === 'needs-update') {
        filtered = filtered.filter(o => {
            const diff = calculatePriceDiff(o.currentPrice, o.recommendedPrice);
            return Math.abs(diff) > 5; // More than 5% difference
        });
    }
    
    // Sort
    switch (offersState.sortBy) {
        case 'oldest':
            filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
        case 'price-desc':
            filtered.sort((a, b) => (b.currentPrice || 0) - (a.currentPrice || 0));
            break;
        case 'price-asc':
            filtered.sort((a, b) => (a.currentPrice || 0) - (b.currentPrice || 0));
            break;
        case 'diff-desc':
            filtered.sort((a, b) => {
                const diffA = Math.abs(calculatePriceDiff(a.currentPrice, a.recommendedPrice));
                const diffB = Math.abs(calculatePriceDiff(b.currentPrice, b.recommendedPrice));
                return diffB - diffA;
            });
            break;
        case 'diff-asc':
            filtered.sort((a, b) => {
                const diffA = Math.abs(calculatePriceDiff(a.currentPrice, a.recommendedPrice));
                const diffB = Math.abs(calculatePriceDiff(b.currentPrice, b.recommendedPrice));
                return diffA - diffB;
            });
            break;
        default: // newest
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    offersState.filteredOffers = filtered;
    renderOffers();
    updateOffersStats();
}

// Calculate price difference percentage
// Shows how much the price needs to change: positive = can raise price, negative = need to lower
function calculatePriceDiff(currentPrice, recommendedPrice) {
    if (!currentPrice || !recommendedPrice) return 0;
    // (recommended - current) / current * 100
    // If recommended > current → positive (green, can raise)
    // If recommended < current → negative (red, need to lower)
    return ((recommendedPrice - currentPrice) / currentPrice) * 100;
}

// v9.8.21: Count brainrots in collection with same income as offer
function countBrainrotsWithSameIncome(offerIncome, offerIncomeRaw) {
    if (!collectionState || !collectionState.allBrainrots || collectionState.allBrainrots.length === 0) {
        return 0;
    }
    
    // Normalize offer income for comparison
    const normalizedOfferIncome = normalizeIncomeForApi(offerIncome, offerIncomeRaw);
    if (!normalizedOfferIncome) return 0;
    
    let count = 0;
    for (const b of collectionState.allBrainrots) {
        const normalizedBrainrotIncome = normalizeIncomeForApi(b.income, b.incomeText);
        if (normalizedBrainrotIncome === normalizedOfferIncome) {
            count++;
        }
    }
    
    return count;
}

// Check if price change is a suspicious spike (>100% change)
function isPriceSpike(currentPrice, recommendedPrice, previousRecommended) {
    if (!currentPrice || !recommendedPrice) return false;
    const diff = Math.abs(calculatePriceDiff(currentPrice, recommendedPrice));
    
    // If change is more than 100%, it's suspicious
    if (diff > 100) return true;
    
    // If we have previous recommended price, check the change between recommendations
    if (previousRecommended && previousRecommended > 0) {
        const recChange = Math.abs((recommendedPrice - previousRecommended) / previousRecommended * 100);
        if (recChange > 100) return true;
    }
    
    return false;
}

// Render offers grid
function renderOffers() {
    if (!offersGridEl) return;
    
    if (offersState.filteredOffers.length === 0) {
        offersGridEl.innerHTML = `
            <div class="offers-empty">
                <i class="fas fa-store"></i>
                <h3>${offersState.offers.length === 0 ? 'No offers yet' : 'No matches'}</h3>
                <p>${offersState.offers.length === 0 
                    ? 'Offers created via Eldorado will appear here' 
                    : 'Try adjusting your search or filters'}</p>
            </div>
        `;
        return;
    }
    
    offersGridEl.innerHTML = offersState.filteredOffers.map(offer => {
        const hasRecommendedPrice = offer.recommendedPrice && offer.recommendedPrice > 0;
        const diff = hasRecommendedPrice ? calculatePriceDiff(offer.currentPrice, offer.recommendedPrice) : 0;
        // Use isSpike from API data if available, otherwise calculate locally
        const isSpike = offer.isSpike || isPriceSpike(offer.currentPrice, offer.recommendedPrice, offer.previousRecommendedPrice);
        // Green (up) = can raise price (recommended > current, diff > 0)
        // Red (down) = need to lower price (recommended < current, diff < 0)
        const diffClass = !hasRecommendedPrice ? 'unknown' : (isSpike ? 'spike' : (diff > 0 ? 'up' : diff < 0 ? 'down' : 'same'));
        const diffText = !hasRecommendedPrice ? '—' : (isSpike ? '⚠️ Spike' : (diff === 0 ? '0%' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`));
        const isSelected = offersState.selectedOffers.has(offer.offerId);
        const needsUpdate = hasRecommendedPrice && !isSpike && Math.abs(diff) > 5;
        
        // v9.6: Show paused status
        const isPaused = offer.status === 'paused';
        const statusBadgeClass = isPaused ? 'paused' : (needsUpdate ? 'needs-update' : 'active');
        // v9.7: Better paused icon using FontAwesome
        const statusBadgeText = isPaused ? '<i class="fas fa-pause-circle"></i> Paused' : (needsUpdate ? 'Needs Update' : 'Active');
        
        // v9.8.21: Count brainrots in collection with same income for paused offers
        let brainrotsCountBadge = '';
        if (isPaused) {
            const brainrotsCount = countBrainrotsWithSameIncome(offer.income, offer.incomeRaw);
            if (brainrotsCount > 0) {
                brainrotsCountBadge = `<span class="offer-brainrots-badge has-brainrots" title="You have ${brainrotsCount} brainrot(s) with same income in collection"><i class="fas fa-brain"></i> ${brainrotsCount}</span>`;
            } else {
                brainrotsCountBadge = `<span class="offer-brainrots-badge no-brainrots" title="No brainrots with same income in collection"><i class="fas fa-brain"></i> 0</span>`;
            }
        }
        
        // v9.7.6: Calculate time until auto-delete for paused offers
        let pausedInfo = '';
        if (isPaused) {
            // Use pausedAt if available, otherwise use updatedAt or fallback to 3 days from now
            const pausedDate = offer.pausedAt ? new Date(offer.pausedAt) : 
                              (offer.updatedAt ? new Date(offer.updatedAt) : new Date());
            const deleteDate = new Date(pausedDate.getTime() + 3 * 24 * 60 * 60 * 1000);
            const msLeft = deleteDate - Date.now();
            const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
            const daysLeft = Math.floor(hoursLeft / 24);
            const remainingHours = hoursLeft % 24;
            
            if (msLeft > 0) {
                let timeText = '';
                if (daysLeft > 0) {
                    timeText = `${daysLeft}d ${remainingHours}h`;
                } else if (hoursLeft > 0) {
                    timeText = `${hoursLeft}h`;
                } else {
                    const minsLeft = Math.floor(msLeft / (60 * 1000));
                    timeText = `${minsLeft}m`;
                }
                pausedInfo = `<div class="offer-paused-info">Auto-delete in ${timeText}</div>`;
            } else {
                pausedInfo = `<div class="offer-paused-info urgent">Will be deleted soon</div>`;
            }
        }
        
        return `
        <div class="offer-card ${isSelected ? 'selected' : ''} ${isPaused ? 'paused' : ''} ${offer.mutation ? 'has-mutation' : ''}" data-offer-id="${offer.offerId}" ${offer.mutation ? `style="border-color: ${getMutationColor(offer.mutation)}; box-shadow: 0 0 12px ${getMutationColor(offer.mutation)}40;"` : ''}>
            ${brainrotsCountBadge}
            <div class="offer-card-checkbox">
                <label class="checkbox-wrapper">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleOfferSelection('${offer.offerId}')">
                    <span class="checkmark"></span>
                </label>
            </div>
            <div class="offer-card-header">
                <span class="offer-status-badge ${statusBadgeClass}">
                    ${statusBadgeText}
                </span>
                <div class="offer-card-header-content">
                    <div class="offer-card-image">
                        ${offer.imageUrl 
                            ? `<img src="${getCachedOfferImage(offer.imageUrl, offer.offerId)}" alt="${offer.brainrotName}" loading="lazy">`
                            : '<i class="fas fa-brain" style="font-size: 1.5rem; color: var(--text-muted);"></i>'
                        }
                    </div>
                    <div class="offer-card-info">
                        <div class="offer-card-name" title="${offer.brainrotName}">${offer.brainrotName || 'Unknown'}</div>
                        ${cleanMutationText(offer.mutation) ? (() => {
                            const mStyles = getMutationStyles(offer.mutation);
                            const textShadow = mStyles.textShadow ? `text-shadow: ${mStyles.textShadow};` : '';
                            return `<div class="offer-mutation-line"><span class="offer-mutation-badge" style="background: ${mStyles.background}; color: ${mStyles.textColor}; ${textShadow} --glow-color: ${mStyles.glowColor};">${cleanMutationText(offer.mutation)}</span></div>`;
                        })() : ''}
                        <div class="offer-card-id">${offer.offerId}</div>
                        <div class="offer-card-income">${offer.incomeRaw || formatIncomeSec(offer.income)}</div>
                    </div>
                </div>
            </div>
            <div class="offer-card-prices">
                <div class="offer-price-item">
                    <div class="offer-price-label">Current</div>
                    <div class="offer-price-value current">$${(offer.currentPrice || 0).toFixed(2)}</div>
                </div>
                <div class="offer-price-diff">
                    <div class="offer-diff-badge ${diffClass}">${diffText}</div>
                    ${isSpike && offer.pendingPrice ? `<div class="offer-pending-price">Pending: $${offer.pendingPrice.toFixed(2)}</div>` : ''}
                </div>
                <div class="offer-price-item">
                    <div class="offer-price-label">${isSpike ? 'Recommended (old)' : 'Recommended'}</div>
                    <div class="offer-price-value recommended ${isSpike ? 'spike-value' : ''} ${!hasRecommendedPrice ? 'no-price' : ''}">${hasRecommendedPrice ? '$' + offer.recommendedPrice.toFixed(2) : 'N/A'}</div>
                </div>
            </div>
            <div class="offer-card-actions">
                <button class="btn btn-sm btn-adjust" onclick="openOfferPriceModal('${offer.offerId}')">
                    <i class="fas fa-edit"></i>
                    Adjust Price
                </button>
                ${isPaused ? `
                <button class="btn btn-sm btn-delete" onclick="deleteOffer('${offer.offerId}', '${(offer.brainrotName || 'Unknown').replace(/'/g, "\\'")}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
                ${pausedInfo}
                ` : ''}
            </div>
        </div>
        `;
    }).join('');
}

// Update offers stats
function updateOffersStats() {
    if (!offersStatsEl) return;
    
    const total = offersState.offers.length;
    const pausedCount = offersState.offers.filter(o => o.status === 'paused').length;
    const needsUpdate = offersState.offers.filter(o => {
        if (o.status === 'paused') return false;
        const diff = Math.abs(calculatePriceDiff(o.currentPrice, o.recommendedPrice));
        return diff > 5;
    }).length;
    
    offersStatsEl.innerHTML = `
        <span><i class="fas fa-store"></i> ${total} total</span>
        ${pausedCount > 0 ? `<span style="color: #9ca3af;"><i class="fas fa-pause-circle"></i> ${pausedCount} paused</span>` : ''}
        ${needsUpdate > 0 ? `<span style="color: #fbbf24;"><i class="fas fa-exclamation-triangle"></i> ${needsUpdate} need update</span>` : ''}
        ${offersState.selectedOffers.size > 0 ? `<span style="color: var(--accent-primary);"><i class="fas fa-check-square"></i> ${offersState.selectedOffers.size} selected</span>` : ''}
    `;
}

// Toggle offer selection
function toggleOfferSelection(offerId) {
    if (offersState.selectedOffers.has(offerId)) {
        offersState.selectedOffers.delete(offerId);
    } else {
        offersState.selectedOffers.add(offerId);
    }
    updateBulkActionsState();
    renderOffers();
}

// v9.7.6: Delete a paused offer from server
async function deleteOffer(offerId, brainrotName) {
    if (!confirm(`Delete offer "${brainrotName}" (${offerId}) from farmpanel?\n\nThis will remove it from tracking. The offer on Eldorado will NOT be affected.`)) {
        return;
    }
    
    try {
        const currentFarmKey = state.currentKey;
        if (!currentFarmKey) {
            showNotification('❌ No farm key selected', 'error');
            return;
        }
        
        const response = await fetch(`${API_BASE}/offers?farmKey=${encodeURIComponent(currentFarmKey)}&offerId=${encodeURIComponent(offerId)}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete offer');
        }
        
        // Remove from local state immediately
        offersState.offers = offersState.offers.filter(o => o.offerId !== offerId);
        offersState.filteredOffers = offersState.filteredOffers.filter(o => o.offerId !== offerId);
        offersState.selectedOffers.delete(offerId);
        
        // Clear cache to force fresh data on next load
        offersCache = { data: null, timestamp: 0 };
        
        // Update UI immediately
        updateOffersStats();
        renderOffers();
        showNotification(`✅ Offer "${brainrotName}" deleted`, 'success');
        
    } catch (error) {
        console.error('Delete offer error:', error);
        showNotification(`❌ Failed to delete offer: ${error.message}`, 'error');
    }
}

// Toggle select all offers
function toggleSelectAllOffers() {
    if (offersState.selectedOffers.size === offersState.filteredOffers.length) {
        offersState.selectedOffers.clear();
    } else {
        offersState.filteredOffers.forEach(o => offersState.selectedOffers.add(o.offerId));
    }
    updateBulkActionsState();
    renderOffers();
}

// Update bulk actions button state
function updateBulkActionsState() {
    if (bulkAdjustBtn) {
        bulkAdjustBtn.disabled = offersState.selectedOffers.size === 0;
    }
    if (selectAllOffersEl) {
        selectAllOffersEl.checked = offersState.selectedOffers.size === offersState.filteredOffers.length && offersState.filteredOffers.length > 0;
    }
    updateOffersStats();
}

// Open single offer price modal
function openOfferPriceModal(offerId) {
    const offer = offersState.offers.find(o => o.offerId === offerId);
    if (!offer) return;
    
    offersState.currentOffer = offer;
    
    const previewEl = document.getElementById('offerPreview');
    const recommendedValueEl = document.getElementById('recommendedPriceValue');
    const customInputEl = document.getElementById('customPriceInput');
    
    if (previewEl) {
        previewEl.innerHTML = `
            ${offer.imageUrl ? `<img src="${getCachedOfferImage(offer.imageUrl, offer.offerId)}" alt="${offer.brainrotName}">` : ''}
            <div class="offer-preview-info">
                <h4>${offer.brainrotName || 'Unknown'}</h4>
                <p>${offer.income || '0/s'} • Current: $${(offer.currentPrice || 0).toFixed(2)}</p>
            </div>
        `;
    }
    
    if (recommendedValueEl) {
        recommendedValueEl.textContent = `$${(offer.recommendedPrice || 0).toFixed(2)}`;
    }
    
    if (customInputEl) {
        customInputEl.value = offer.currentPrice || '';
    }
    
    // Reset radio to recommended
    document.querySelector('input[name="priceType"][value="recommended"]').checked = true;
    
    openModal(offerPriceModal);
}

// Open bulk price modal
function openBulkPriceModal() {
    const selectedOffers = offersState.offers.filter(o => offersState.selectedOffers.has(o.offerId));
    if (selectedOffers.length === 0) return;
    
    const bulkOffersListEl = document.getElementById('bulkOffersList');
    const bulkCountEl = document.getElementById('bulkCount');
    
    if (bulkCountEl) {
        bulkCountEl.textContent = selectedOffers.length;
    }
    
    if (bulkOffersListEl) {
        bulkOffersListEl.innerHTML = selectedOffers.map(offer => `
            <div class="bulk-offer-item" data-offer-id="${offer.offerId}">
                ${offer.imageUrl ? `<img src="${getCachedOfferImage(offer.imageUrl, offer.offerId)}" alt="${offer.brainrotName}">` : '<div style="width:40px;height:40px;background:var(--bg-tertiary);border-radius:6px;"></div>'}
                <div class="bulk-offer-info">
                    <div class="bulk-offer-name">${offer.brainrotName || 'Unknown'}</div>
                    <div class="bulk-offer-current">Current: $${(offer.currentPrice || 0).toFixed(2)}</div>
                </div>
                <div class="bulk-offer-price-input custom-price-input hidden">
                    <input type="number" step="0.01" min="0" value="${offer.currentPrice || ''}" placeholder="0.00">
                </div>
                <div class="bulk-offer-recommended">$${(offer.recommendedPrice || 0).toFixed(2)}</div>
            </div>
        `).join('');
    }
    
    // Reset to recommended
    document.querySelector('input[name="bulkPriceType"][value="recommended"]').checked = true;
    document.getElementById('singlePriceInput')?.classList.add('hidden');
    bulkOffersListEl?.querySelectorAll('.custom-price-input').forEach(el => el.classList.add('hidden'));
    
    openModal(bulkPriceModal);
}

// Handle bulk price type change
function handleBulkPriceTypeChange(type) {
    const singlePriceInput = document.getElementById('singlePriceInput');
    const customInputs = document.querySelectorAll('#bulkOffersList .custom-price-input');
    
    singlePriceInput?.classList.toggle('hidden', type !== 'custom-single');
    customInputs.forEach(el => el.classList.toggle('hidden', type !== 'custom-each'));
}

// Confirm single offer price adjustment
async function confirmOfferPriceAdjustment() {
    const offer = offersState.currentOffer;
    if (!offer) return;
    
    const priceType = document.querySelector('input[name="priceType"]:checked')?.value;
    let newPrice;
    
    if (priceType === 'recommended') {
        newPrice = offer.recommendedPrice;
    } else {
        newPrice = parseFloat(document.getElementById('customPriceInput')?.value);
    }
    
    if (!newPrice || newPrice <= 0) {
        document.getElementById('offerPriceError').textContent = 'Please enter a valid price';
        return;
    }
    
    // Create adjustment data for Tampermonkey
    const adjustmentData = {
        action: 'adjust_price',
        offers: [{
            offerId: offer.offerId,
            brainrotName: offer.brainrotName,
            income: offer.income,
            newPrice: newPrice,
            currentPrice: offer.currentPrice
        }],
        returnUrl: window.location.href,
        timestamp: Date.now()
    };
    
    // Store in localStorage for Tampermonkey
    localStorage.setItem('glitched_price_adjustment', JSON.stringify(adjustmentData));
    
    // Open Eldorado dashboard
    const eldoradoUrl = `https://www.eldorado.gg/dashboard/offers?category=CustomItem&glitched_adjust=${encodeURIComponent(JSON.stringify(adjustmentData))}`;
    window.open(eldoradoUrl, '_blank');
    
    closeModalFn(offerPriceModal);
}

// Confirm bulk price adjustment
async function confirmBulkPriceAdjustment() {
    const selectedOffers = offersState.offers.filter(o => offersState.selectedOffers.has(o.offerId));
    if (selectedOffers.length === 0) return;
    
    const priceType = document.querySelector('input[name="bulkPriceType"]:checked')?.value;
    const adjustments = [];
    
    for (const offer of selectedOffers) {
        let newPrice;
        
        if (priceType === 'recommended') {
            newPrice = offer.recommendedPrice;
        } else if (priceType === 'custom-single') {
            newPrice = parseFloat(document.getElementById('singleCustomPrice')?.value);
        } else if (priceType === 'custom-each') {
            const input = document.querySelector(`#bulkOffersList .bulk-offer-item[data-offer-id="${offer.offerId}"] input`);
            newPrice = parseFloat(input?.value);
        }
        
        if (newPrice && newPrice > 0) {
            adjustments.push({
                offerId: offer.offerId,
                brainrotName: offer.brainrotName,
                income: offer.income,
                newPrice: newPrice,
                currentPrice: offer.currentPrice
            });
        }
    }
    
    if (adjustments.length === 0) {
        document.getElementById('bulkPriceError').textContent = 'Please enter valid prices';
        return;
    }
    
    // Create adjustment data for Tampermonkey
    const adjustmentData = {
        action: 'adjust_price',
        offers: adjustments,
        returnUrl: window.location.href,
        timestamp: Date.now()
    };
    
    // Store in localStorage for Tampermonkey
    localStorage.setItem('glitched_price_adjustment', JSON.stringify(adjustmentData));
    
    // Open Eldorado dashboard
    const eldoradoUrl = `https://www.eldorado.gg/dashboard/offers?category=CustomItem&glitched_adjust=${encodeURIComponent(JSON.stringify(adjustmentData))}`;
    window.open(eldoradoUrl, '_blank');
    
    closeModalFn(bulkPriceModal);
}

// Save offer to server (called after creating offer via Tampermonkey)
async function saveOffer(offerData) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return;
        
        const response = await fetch(`${API_BASE}/offers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                farmKey,
                ...offerData
            })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('Offer saved:', offerData.offerId);
            await loadOffers();
        }
    } catch (err) {
        console.error('Error saving offer:', err);
    }
}

// Setup offers event listeners
function setupOffersListeners() {
    // Search
    if (offerSearchEl) {
        offerSearchEl.addEventListener('input', (e) => {
            offersState.searchQuery = e.target.value.trim();
            filterAndRenderOffers();
        });
    }
    
    // Sort dropdown
    initDropdown(offerSortDropdown, (value) => {
        offersState.sortBy = value;
        filterAndRenderOffers();
    });
    
    // Status dropdown
    initDropdown(offerStatusDropdown, (value) => {
        offersState.statusFilter = value;
        filterAndRenderOffers();
    });
    
    // Select all
    if (selectAllOffersEl) {
        selectAllOffersEl.addEventListener('change', toggleSelectAllOffers);
    }
    
    // Bulk adjust button
    if (bulkAdjustBtn) {
        bulkAdjustBtn.addEventListener('click', openBulkPriceModal);
    }
    
    // Scan Eldorado button (also refreshes offers after scan)
    const scanOffersBtn = document.getElementById('scanOffersBtn');
    if (scanOffersBtn) {
        scanOffersBtn.addEventListener('click', scanEldoradoOffers);
    }
    
    // Bulk price type radio buttons
    document.querySelectorAll('input[name="bulkPriceType"]').forEach(radio => {
        radio.addEventListener('change', (e) => handleBulkPriceTypeChange(e.target.value));
    });
    
    // Modal close buttons
    document.getElementById('closeBulkPriceModal')?.addEventListener('click', () => closeModalFn(bulkPriceModal));
    document.getElementById('cancelBulkPrice')?.addEventListener('click', () => closeModalFn(bulkPriceModal));
    document.getElementById('confirmBulkPrice')?.addEventListener('click', confirmBulkPriceAdjustment);
    
    document.getElementById('closeOfferPriceModal')?.addEventListener('click', () => closeModalFn(offerPriceModal));
    document.getElementById('cancelOfferPrice')?.addEventListener('click', () => closeModalFn(offerPriceModal));
    document.getElementById('confirmOfferPrice')?.addEventListener('click', confirmOfferPriceAdjustment);
    
    // Auto-select custom radio when user starts typing in custom price input
    document.getElementById('customPriceInput')?.addEventListener('input', () => {
        const customRadio = document.querySelector('input[name="priceType"][value="custom"]');
        if (customRadio) customRadio.checked = true;
    });
    
    // Auto-select custom-single radio when user types in single custom price
    document.getElementById('singleCustomPrice')?.addEventListener('input', () => {
        const customSingleRadio = document.querySelector('input[name="bulkPriceType"][value="custom-single"]');
        if (customSingleRadio) customSingleRadio.checked = true;
    });
    
    // Auto-select custom-each radio when user types in individual custom inputs
    document.getElementById('bulkOffersList')?.addEventListener('input', (e) => {
        if (e.target.matches('.custom-price-input input')) {
            const customEachRadio = document.querySelector('input[name="bulkPriceType"][value="custom-each"]');
            if (customEachRadio) customEachRadio.checked = true;
        }
    });
}

// Refresh offers from server (data already contains recommendedPrice from global cache)
async function scanEldoradoOffers() {
    const scanBtn = document.getElementById('scanOffersBtn');
    const progressEl = document.getElementById('offersScanProgress');
    const progressFill = document.getElementById('offersScanProgressFill');
    const progressText = document.getElementById('offersScanProgressText');
    
    if (!scanBtn) return;
    
    if (!state.currentKey) {
        showNotification('❌ Ключ фермы не выбран', 'error');
        return;
    }
    
    const originalContent = scanBtn.innerHTML;
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Show progress bar
    if (progressEl) {
        progressEl.classList.remove('hidden');
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
    }
    
    const updateProgress = (percent, text) => {
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = text || `${percent}%`;
    };
    
    try {
        updateProgress(30, 'Загрузка...');
        
        // Just reload offers from server - they already include recommendedPrice
        await loadOffers(true);
        
        updateProgress(100, 'Готово!');
        
        const activeCount = offersState.offers.filter(o => o.status === 'active').length;
        const pausedCount = offersState.offers.filter(o => o.status === 'paused').length;
        const total = offersState.offers.length;
        
        // Build message
        let message = '';
        let type = 'success';
        
        if (total === 0) {
            message = 'ℹ️ Нет офферов';
            type = 'info';
        } else if (activeCount > 0 && pausedCount > 0) {
            message = `✅ ${activeCount} активных, ${pausedCount} на паузе`;
        } else if (activeCount > 0) {
            message = `✅ ${activeCount} офферов обновлено`;
        } else if (pausedCount > 0) {
            message = `⚠️ ${pausedCount} офферов на паузе`;
            type = 'warning';
        } else {
            message = `ℹ️ ${total} офферов загружено`;
            type = 'info';
        }
        
        showNotification(message, type);
        
    } catch (err) {
        console.error('Refresh error:', err);
        updateProgress(0, 'Ошибка');
        showNotification('❌ Ошибка загрузки: ' + err.message, 'error');
    } finally {
        scanBtn.disabled = false;
        scanBtn.innerHTML = originalContent;
        
        // Hide progress bar after delay
        setTimeout(() => {
            if (progressEl) progressEl.classList.add('hidden');
        }, 1500);
    }
}

// v9.8.7: Smart auto-refresh for offers
let offersAutoRefreshInterval = null;
let lastOffersRefreshTime = 0;
const OFFERS_REFRESH_INTERVAL = 10000; // 10 seconds

function startOffersAutoRefresh() {
    // Check if we need immediate refresh (timer already passed while away)
    const timeSinceLastRefresh = Date.now() - lastOffersRefreshTime;
    
    if (lastOffersRefreshTime > 0 && timeSinceLastRefresh >= OFFERS_REFRESH_INTERVAL) {
        // Timer already passed - refresh immediately
        console.log('🔄 Returning to Offers - refreshing immediately (timer passed)');
        doOffersRefresh();
    } else if (lastOffersRefreshTime > 0) {
        // Timer not yet passed - wait for remaining time
        const remainingTime = OFFERS_REFRESH_INTERVAL - timeSinceLastRefresh;
        console.log(`⏳ Returning to Offers - waiting ${Math.round(remainingTime/1000)}s for next refresh`);
        
        // Set one-time timeout for remaining time, then start interval
        if (!offersAutoRefreshInterval) {
            offersAutoRefreshInterval = setTimeout(async () => {
                await doOffersRefresh();
                // Now start regular interval
                offersAutoRefreshInterval = setInterval(doOffersRefresh, OFFERS_REFRESH_INTERVAL);
            }, remainingTime);
        }
        return;
    }
    
    // First time or fresh start - just start interval
    if (!offersAutoRefreshInterval) {
        offersAutoRefreshInterval = setInterval(doOffersRefresh, OFFERS_REFRESH_INTERVAL);
        console.log('🔄 Offers auto-refresh started (every 10s)');
    }
}

async function doOffersRefresh() {
    if (state.currentKey && offersState.offers.length > 0) {
        console.log('🔄 Auto-refreshing offers...');
        lastOffersRefreshTime = Date.now();
        // First trigger server scan to update DB
        await triggerServerScan();
        // Then load updated offers
        await loadOffers(true, true); // Force refresh, silent mode
    }
}

// Trigger server-side scan of Glitched Store offers
async function triggerServerScan() {
    try {
        const response = await fetch(`${API_BASE}/scan-glitched`);
        const data = await response.json();
        if (data.success && !data.cached) {
            console.log(`📡 Server scan: ${data.updated} updated, ${data.markedPaused} paused`);
        }
    } catch (err) {
        console.warn('Server scan failed:', err.message);
    }
}

function stopOffersAutoRefresh() {
    if (offersAutoRefreshInterval) {
        clearInterval(offersAutoRefreshInterval);
        clearTimeout(offersAutoRefreshInterval);
        offersAutoRefreshInterval = null;
        // DON'T reset lastOffersRefreshTime - keep it for smart resume!
        console.log('⏸️ Offers auto-refresh paused (timer preserved)');
    }
}

// Initialize offers when view is shown
function initOffersView() {
    console.log('📋 Offers view opened');
    
    // v9.8.7: Smart refresh - check if we need to load or use cache
    const timeSinceLastRefresh = Date.now() - lastOffersRefreshTime;
    const needsRefresh = lastOffersRefreshTime === 0 || timeSinceLastRefresh >= OFFERS_REFRESH_INTERVAL;
    
    if (needsRefresh) {
        console.log('Loading offers (first time or stale)...');
        loadOffers();
        lastOffersRefreshTime = Date.now();
    } else {
        console.log(`Using cached offers (${Math.round(timeSinceLastRefresh/1000)}s old)`);
    }
    
    startOffersAutoRefresh();
}

// Setup offers listeners on DOM ready
setupOffersListeners();

// Check for returned data from Tampermonkey after price adjustment
function checkForPriceAdjustmentResult() {
    const result = localStorage.getItem('glitched_price_result');
    if (result) {
        try {
            const data = JSON.parse(result);
            if (data.success) {
                console.log('Price adjustment completed:', data);
                // Update local offer data
                for (const adjusted of data.adjusted || []) {
                    const offer = offersState.offers.find(o => o.offerId === adjusted.offerId);
                    if (offer) {
                        offer.currentPrice = adjusted.newPrice;
                    }
                }
                filterAndRenderOffers();
            }
            localStorage.removeItem('glitched_price_result');
        } catch (e) {
            console.error('Error parsing price result:', e);
        }
    }
}

// Check periodically for Tampermonkey results
setInterval(checkForPriceAdjustmentResult, 2000);

// ============================================
// TOP / LEADERBOARDS SECTION (Server-based)
// ============================================

let topState = {
    activeTab: 'income',
    initialized: false,
    cache: {
        income: null,
        value: null,
        total: null
    },
    loading: false
};

// Preload top data in background (silent, no UI updates)
async function preloadTopData() {
    const types = ['income', 'value', 'total'];
    
    for (const type of types) {
        // Skip if already cached
        if (topState.cache[type]) continue;
        
        try {
            const response = await fetch(`${API_BASE}/top?type=${type}`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    topState.cache[type] = result.data;
                }
            }
        } catch (error) {
            // Silent fail - will load on demand
        }
    }
    console.log('Preloaded top data');
}

function initTopView() {
    if (!topState.initialized) {
        setupTopTabListeners();
        topState.initialized = true;
    }
    loadAndRenderTop();
}

function setupTopTabListeners() {
    const topTabs = document.querySelectorAll('.top-tab');
    topTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            topTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            topState.activeTab = tab.dataset.top;
            loadAndRenderTop();
        });
    });
}

async function loadAndRenderTop() {
    const container = document.querySelector('.top-content');
    if (!container) return;
    
    const type = topState.activeTab;
    
    // Показываем загрузку
    if (!topState.cache[type]) {
        container.innerHTML = `
            <div class="top-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Загрузка топа...</p>
            </div>
        `;
    }
    
    // Если есть кэш - рендерим его сразу
    if (topState.cache[type]) {
        renderTopData(topState.cache[type], type);
    }
    
    // Загружаем с сервера
    try {
        const response = await fetch(`${API_BASE}/top?type=${type}`);
        if (!response.ok) {
            throw new Error('Failed to fetch top data');
        }
        
        const result = await response.json();
        if (result.success && result.data) {
            topState.cache[type] = result.data;
            renderTopData(result.data, type);
        }
    } catch (error) {
        console.error('Error loading top:', error);
        if (!topState.cache[type]) {
            container.innerHTML = `
                <div class="top-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Ошибка загрузки</h3>
                    <p>Не удалось загрузить данные топа</p>
                    <button onclick="loadAndRenderTop()" class="retry-btn">
                        <i class="fas fa-redo"></i> Повторить
                    </button>
                </div>
            `;
        }
    }
}

function renderTopData(data, type) {
    const container = document.querySelector('.top-content');
    if (!container) return;
    
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="top-empty">
                <i class="fas fa-trophy"></i>
                <h3>Пока нет данных</h3>
                <p>Топ формируется из данных всех пользователей панели</p>
            </div>
        `;
        return;
    }
    
    const top3 = data.slice(0, 3);
    const rest = data.slice(3, 10);
    
    let html = '';
    
    if (type === 'total') {
        html = renderTopPodiumTotal(top3);
    } else {
        html = renderTopPodium(top3, type);
    }
    
    // Render positions 4-10 (real data + placeholders)
    html += `<div class="top-list">`;
    for (let i = 0; i < 7; i++) {
        const rank = i + 4;
        const item = rest[i];
        
        if (item) {
            const avatarIcon = item.avatar?.icon || 'fa-user';
            const avatarColor = item.avatar?.color || '#6366f1';
            const accountText = item.accountsCount === 1 ? 'account' : 'accounts';
            
            if (type === 'total') {
                html += `
                    <div class="top-list-item">
                        <div class="top-list-rank">${rank}</div>
                        <div class="top-list-avatar-icon" style="background: ${avatarColor}20; color: ${avatarColor}">
                            <i class="fas ${avatarIcon}"></i>
                        </div>
                        <div class="top-list-info">
                            <div class="top-list-name">${item.username}</div>
                            <div class="top-list-brainrot">${item.accountsCount} ${accountText}</div>
                        </div>
                        <div class="top-list-stats">
                            <div class="top-list-value">${formatIncomeFromMs(item.value)}</div>
                        </div>
                    </div>
                `;
            } else {
                const valueDisplay = type === 'income' 
                    ? formatIncomeFromMs(item.value)
                    : `$${formatMoney(item.value)}`;
                    
                html += `
                    <div class="top-list-item">
                        <div class="top-list-rank">${rank}</div>
                        <div class="top-list-avatar-icon" style="background: ${avatarColor}20; color: ${avatarColor}">
                            <i class="fas ${avatarIcon}"></i>
                        </div>
                        <div class="top-list-info">
                            <div class="top-list-name">${item.username}</div>
                            <div class="top-list-brainrot">${item.brainrot?.name || 'Unknown'}${type === 'value' && item.brainrot?.income ? ` <span class="top-list-income">${formatIncomeFromMs(item.brainrot.income)}</span>` : ''}</div>
                        </div>
                        <div class="top-list-stats">
                            <div class="top-list-value">${valueDisplay}</div>
                        </div>
                    </div>
                `;
            }
        } else {
            // Placeholder for empty position
            html += `
                <div class="top-list-item top-list-placeholder">
                    <div class="top-list-rank">${rank}</div>
                    <div class="top-list-avatar-icon placeholder-avatar">
                        <i class="fas fa-question"></i>
                    </div>
                    <div class="top-list-info">
                        <div class="top-list-name placeholder-text">???</div>
                        <div class="top-list-brainrot">Waiting for player...</div>
                    </div>
                    <div class="top-list-stats">
                        <div class="top-list-value placeholder-text">---</div>
                    </div>
                </div>
            `;
        }
    }
    html += `</div>`;
    
    container.innerHTML = html;
}

// Render top 3 podium for income/value tabs - brainrot images in round avatars
function renderTopPodium(top3, type) {
    if (top3.length === 0) return '';
    
    const positions = ['first', 'second', 'third'];
    
    let html = `<div class="top-podium">`;
    
    top3.forEach((item, index) => {
        const position = positions[index];
        const brainrotImg = getBrainrotImage(item.brainrot?.name);
        const valueDisplay = type === 'income' 
            ? formatIncomeFromMs(item.value)
            : `$${formatMoney(item.value)}`;
        const avatarIcon = item.avatar?.icon || 'fa-user';
        const avatarColor = item.avatar?.color || '#6366f1';
        
        // Для вкладки Value показываем также income
        const incomeInfo = type === 'value' && item.brainrot?.income
            ? `<div class="podium-income">${formatIncomeFromMs(item.brainrot.income)}</div>`
            : '';
        
        // Брейнрот отображается в круглом аватаре сверху, аватар юзера слева от никнейма
        html += `
            <div class="podium-item ${position}">
                <div class="podium-avatar podium-brainrot-avatar">
                    ${index === 0 ? '<div class="podium-crown"><i class="fas fa-crown"></i></div>' : ''}
                    <img src="${brainrotImg}" class="podium-brainrot-circle podium-animated" alt="${item.brainrot?.name || ''}" onerror="this.src='https://via.placeholder.com/100'">
                </div>
                <div class="podium-rank">#${index + 1}</div>
                <div class="podium-user-row">
                    <div class="podium-user-mini" style="background: ${avatarColor}20; color: ${avatarColor}">
                        <i class="fas ${avatarIcon}"></i>
                    </div>
                    <span class="podium-name">${item.username}</span>
                </div>
                <div class="podium-brainrot-label">${item.brainrot?.name || 'Unknown'}</div>
                ${incomeInfo}
                <div class="podium-value">${valueDisplay}</div>
            </div>
        `;
    });
    
    html += `</div>`;
    return html;
}

// Render top 3 podium for total tab (panel avatars in circles)
function renderTopPodiumTotal(top3) {
    if (top3.length === 0) return '';
    
    const positions = ['first', 'second', 'third'];
    
    let html = `<div class="top-podium">`;
    
    top3.forEach((item, index) => {
        const position = positions[index];
        const avatarIcon = item.avatar?.icon || 'fa-user';
        const avatarColor = item.avatar?.color || '#6366f1';
        
        const accountText = item.accountsCount === 1 ? 'account' : 'accounts';
        
        // Круглый аватар пользователя с иконкой (стиль как farmer-avatar)
        html += `
            <div class="podium-item ${position}">
                <div class="podium-avatar podium-user-avatar">
                    ${index === 0 ? '<div class="podium-crown"><i class="fas fa-crown"></i></div>' : ''}
                    <div class="podium-user-circle podium-animated" style="background: ${avatarColor}20; color: ${avatarColor}; border-color: ${position === 'first' ? '#ffd700' : position === 'second' ? '#c0c0c0' : '#cd7f32'}">
                        <i class="fas ${avatarIcon}"></i>
                    </div>
                </div>
                <div class="podium-rank">#${index + 1}</div>
                <div class="podium-name">${item.username}</div>
                <div class="podium-brainrot-label">${item.accountsCount} ${accountText}</div>
                <div class="podium-value">${formatIncomeFromMs(item.value)}</div>
            </div>
        `;
    });
    
    html += `</div>`;
    return html;
}

// Helper to get brainrot image
function getBrainrotImage(brainrotName) {
    if (!brainrotName) return 'https://via.placeholder.com/60';
    
    const normalizedName = brainrotName.toLowerCase();
    
    // Сначала пробуем брать из state.brainrotImages (уже загружен)
    if (state.brainrotImages && state.brainrotImages[normalizedName]) {
        return `${BRAINROT_IMAGES_BASE}/${state.brainrotImages[normalizedName]}`;
    }
    
    // Пробуем варианты имени
    const variations = [
        normalizedName,
        normalizedName.replace(/ /g, '_'),
        normalizedName.replace(/ /g, '')
    ];
    
    for (const variant of variations) {
        if (state.brainrotImages && state.brainrotImages[variant]) {
            return `${BRAINROT_IMAGES_BASE}/${state.brainrotImages[variant]}`;
        }
    }
    
    return 'https://via.placeholder.com/60';
}

// Balance Chart instance
let balanceChart = null;
let currentChartPeriod = null;

// Load saved chart period
function loadChartPeriod() {
    try {
        const saved = localStorage.getItem(CHART_PERIOD_KEY);
        if (saved) {
            const period = parseInt(saved);
            if (Object.values(PERIODS).includes(period)) {
                currentChartPeriod = period;
                return;
            }
        }
    } catch (e) {}
    currentChartPeriod = PERIODS.day;
}

// Save chart period
function saveChartPeriod(period) {
    try {
        localStorage.setItem(CHART_PERIOD_KEY, period.toString());
    } catch (e) {}
}

// Debounce timer for chart updates
let chartUpdateTimer = null;
let lastChartDataHash = null; // Track if data actually changed
let isChartUpdating = false; // Prevent concurrent updates

// Update balance chart with debounce (non-blocking)
function updateBalanceChart(period = currentChartPeriod) {
    // Clear pending update
    if (chartUpdateTimer) {
        clearTimeout(chartUpdateTimer);
    }
    
    // Skip if already updating
    if (isChartUpdating) {
        return;
    }
    
    // Debounce chart updates to prevent flickering
    chartUpdateTimer = setTimeout(() => {
        // Use requestAnimationFrame for non-blocking UI
        requestAnimationFrame(() => {
            _doUpdateBalanceChart(period);
        });
    }, 100); // Reduced debounce for faster response
}

// Simple hash for chart data to detect changes
function getChartDataHash(chartData) {
    if (!chartData || !chartData.values) return '';
    const vals = chartData.values;
    // Use first, last, length and sum for quick comparison
    const sum = vals.reduce((a, b) => a + b, 0);
    return `${vals.length}_${vals[0]?.toFixed(2)}_${vals[vals.length-1]?.toFixed(2)}_${sum.toFixed(2)}`;
}

// Track chart retry count to avoid infinite loops
let chartRetryCount = 0;
const MAX_CHART_RETRIES = 10;

// Actual chart update implementation
function _doUpdateBalanceChart(period) {
    // Mark as updating to prevent concurrent calls
    isChartUpdating = true;
    
    const chartContainer = document.getElementById('balanceChart');
    const chartEmpty = document.querySelector('.chart-empty');
    const chartStats = document.querySelector('.chart-stats');
    
    if (!chartContainer || !state.currentKey) {
        isChartUpdating = false;
        return;
    }
    
    // Check if canvas is properly sized - retry later if not ready yet (with limit)
    if (chartContainer.offsetWidth === 0 || chartContainer.offsetHeight === 0) {
        if (chartRetryCount < MAX_CHART_RETRIES) {
            chartRetryCount++;
            isChartUpdating = false;
            setTimeout(() => _doUpdateBalanceChart(period), 200);
        } else {
            isChartUpdating = false;
        }
        // Don't spam console - only log occasionally
        return;
    }
    
    // Reset retry count on success
    chartRetryCount = 0;
    
    // При ручном рефреше НЕ обновляем график - оставляем как есть
    if (state.isManualPriceRefresh) {
        console.log('Skip chart update during manual price refresh');
        isChartUpdating = false;
        return;
    }
    
    // Load period if not set
    if (!currentChartPeriod) {
        loadChartPeriod();
        period = currentChartPeriod;
    }
    
    currentChartPeriod = period;
    saveChartPeriod(period);
    
    // Update active tab
    document.querySelectorAll('.period-tab').forEach(tab => {
        tab.classList.toggle('active', parseInt(tab.dataset.period) === period);
    });
    
    const chartData = getChartData(state.currentKey, period);
    
    // Check if data actually changed - skip update if same
    const newHash = getChartDataHash(chartData);
    if (newHash === lastChartDataHash && balanceChart) {
        isChartUpdating = false;
        return; // Data hasn't changed, skip redraw
    }
    lastChartDataHash = newHash;
    
    console.log(`Chart data for period ${period}:`, chartData.labels.length, 'points, history:', state.balanceHistory[state.currentKey]?.length || 0);
    
    if (chartData.labels.length < 2) {
        // Not enough data
        console.log('Not enough chart data, showing empty state');
        chartContainer.style.display = 'none';
        if (chartEmpty) chartEmpty.style.display = 'flex';
        if (chartStats) chartStats.innerHTML = '';
        isChartUpdating = false;
        return;
    }
    
    chartContainer.style.display = 'block';
    if (chartEmpty) chartEmpty.style.display = 'none';
    
    // Calculate period change
    const firstValue = chartData.values[0];
    const lastValue = chartData.values[chartData.values.length - 1];
    const change = lastValue - firstValue;
    const changePercent = firstValue > 0 ? ((change / firstValue) * 100).toFixed(2) : 0;
    const isPositive = change >= 0;
    
    // Update chart stats
    if (chartStats) {
        const periodName = period === PERIODS.realtime ? '5 минут' :
                          period === PERIODS.hour ? 'час' : 
                          period === PERIODS.day ? 'день' : 
                          period === PERIODS.week ? 'неделю' : 'месяц';
        chartStats.innerHTML = `
            <div class="chart-stat">
                <span class="chart-stat-label">Изменение за ${periodName}:</span>
                <span class="chart-stat-value ${isPositive ? 'change-positive' : 'change-negative'}">
                    ${isPositive ? '+' : ''}$${Math.abs(change).toFixed(2)} (${isPositive ? '+' : ''}${changePercent}%)
                </span>
            </div>
        `;
    }
    
    const ctx = chartContainer.getContext('2d');
    
    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, isPositive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    const chartColor = isPositive ? '#22c55e' : '#ef4444';
    
    if (balanceChart) {
        balanceChart.destroy();
    }
    
    balanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Balance',
                data: chartData.values,
                borderColor: chartColor,
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: chartData.values.length > 20 ? 0 : 3,
                pointHoverRadius: 5,
                pointBackgroundColor: chartColor,
                pointBorderColor: '#fff',
                pointBorderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Disable animation to prevent jumping
            resizeDelay: 100, // Delay resize recalculation
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 30, 30, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return '$' + context.raw.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        font: {
                            size: 10
                        },
                        maxRotation: 0,
                        maxTicksLimit: 6
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        font: {
                            size: 10
                        },
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    
    isChartUpdating = false;
}

// Initialize period tab listeners
document.addEventListener('DOMContentLoaded', function() {
    // Load saved chart period
    loadChartPeriod();
    
    document.querySelectorAll('.period-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const period = parseInt(this.dataset.period);
            if (period) {
                updateBalanceChart(period);
            }
        });
    });
});