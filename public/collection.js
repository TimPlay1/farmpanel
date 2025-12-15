// ==========================================
// COLLECTION VIEW - All Brainrots from all accounts
// ==========================================

// Supa Generator Configuration
const SUPA_GENERATOR_URL = 'http://localhost:3002';

// Additional DOM Elements for Collection
const brainrotSearchEl = document.getElementById('brainrotSearch');
const sortFilterEl = document.getElementById('sortFilter');
const accountFilterEl = document.getElementById('accountFilter');
const brainrotsGridEl = document.getElementById('brainrotsGrid');
const collectionStatsEl = document.getElementById('collectionStats');

// Collection state
let collectionState = {
    allBrainrots: [],
    filteredBrainrots: [],
    searchQuery: '',
    sortBy: 'income-desc',
    accountFilter: 'all',
    generations: {},  // Stores which brainrots have been generated
    accountColors: {} // Stores unique colors per account
};

// ==========================================
// GENERATIONS TRACKING
// ==========================================

// Load generations data for current user
async function loadGenerationsData() {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return;
        
        const response = await fetch(`/api/generations/${encodeURIComponent(farmKey)}`);
        const data = await response.json();
        collectionState.generations = data.generations || {};
        console.log('Loaded generations:', Object.keys(collectionState.generations).length);
    } catch (err) {
        console.error('Error loading generations:', err);
        collectionState.generations = {};
    }
}

// Load account colors
async function loadAccountColors() {
    try {
        const response = await fetch('/api/account-colors');
        const data = await response.json();
        collectionState.accountColors = data.colors || {};
        console.log('Loaded account colors:', collectionState.accountColors);
    } catch (err) {
        console.error('Error loading account colors:', err);
        collectionState.accountColors = {};
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
            // Update local state
            const brainrotKey = brainrotName.toLowerCase().trim();
            collectionState.generations[brainrotKey] = data.generation;
            // Re-render to show the new badge
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

// ==========================================
// SUPA GENERATOR INTEGRATION
// ==========================================

// Current brainrot data for generation
let currentSupaBrainrot = null;

// Open Supa Generator modal for a brainrot
async function openSupaGenerator(brainrotData) {
    console.log('Opening Supa Generator for:', brainrotData);
    
    // Store current brainrot data
    currentSupaBrainrot = brainrotData;
    
    // Create modal if not exists
    let modal = document.getElementById('supaGeneratorModal');
    if (!modal) {
        modal = createSupaGeneratorModal();
        document.body.appendChild(modal);
    }
    
    // Populate data
    document.getElementById('supaName').value = brainrotData.name || '';
    document.getElementById('supaIncome').value = brainrotData.incomeText || formatIncome(brainrotData.income);
    document.getElementById('supaPrice').value = brainrotData.price || '';
    document.getElementById('supaImageUrl').value = brainrotData.imageUrl || '';
    
    // Show account info and color
    const accountColor = collectionState.accountColors[brainrotData.accountId] || '#4ade80';
    const accountInfoEl = document.getElementById('supaAccountInfo');
    if (accountInfoEl) {
        accountInfoEl.innerHTML = `
            <span style="display: inline-flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 12px; border-radius: 3px; background: ${accountColor};"></span>
                ${brainrotData.accountName}
            </span>
        `;
    }
    
    // Update preview
    updateSupaImagePreview(brainrotData.imageUrl);
    
    // Reset state
    document.getElementById('supaGenerateBtn').disabled = false;
    document.getElementById('supaStatus').classList.add('hidden');
    document.getElementById('supaError').classList.add('hidden');
    document.getElementById('supaDownloadSection').classList.add('hidden');
    document.getElementById('supaResultImage').classList.add('hidden');
    document.getElementById('supaPreviewPlaceholder').classList.remove('hidden');
    
    // Show modal
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
                        <label><i class="fas fa-dollar-sign"></i> Цена</label>
                        <input type="text" id="supaPrice" placeholder="$12.50">
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

// Close Supa Modal
function closeSupaModal() {
    const modal = document.getElementById('supaGeneratorModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Update Supa Image Preview
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

// Current Supa result for download
let currentSupaResult = null;

// Generate Supa Image
async function generateSupaImage() {
    const name = document.getElementById('supaName').value.trim();
    const income = document.getElementById('supaIncome').value.trim();
    const price = document.getElementById('supaPrice').value.trim();
    const imageUrl = document.getElementById('supaImageUrl').value.trim();
    
    if (!name || !income) {
        showSupaError('Заполните название и доходность');
        return;
    }
    
    // Get account info and color
    const accountId = currentSupaBrainrot?.accountId;
    const accountName = currentSupaBrainrot?.accountName;
    const borderColor = collectionState.accountColors[accountId] || '#4ade80';
    
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
        const response = await fetch(`${SUPA_GENERATOR_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name, 
                income, 
                price, 
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
        
        if (result.success && result.resultUrl) {
            currentSupaResult = result;
            
            resultImg.onload = async () => {
                resultImg.classList.remove('hidden');
                previewImg.classList.add('hidden');
                placeholder.classList.add('hidden');
                downloadSection.classList.remove('hidden');
                statusEl.classList.add('hidden');
                
                // Save generation record
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

// Download Supa Image
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
        const downloadUrl = `${SUPA_GENERATOR_URL}/api/download?url=${encodeURIComponent(currentSupaResult.resultUrl)}&filename=${encodeURIComponent(filename)}`;
        
        const response = await fetch(downloadUrl);
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
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Скачать (1920x1920)';
    }
}

// Show Supa Error
function showSupaError(message) {
    const errorEl = document.getElementById('supaError');
    const errorText = document.getElementById('supaErrorText');
    errorText.textContent = message;
    errorEl.classList.remove('hidden');
}

// Setup Collection event listeners
function setupCollectionListeners() {
    if (brainrotSearchEl) {
        brainrotSearchEl.addEventListener('input', (e) => {
            collectionState.searchQuery = e.target.value.toLowerCase().trim();
            filterAndRenderCollection();
        });
    }

    if (sortFilterEl) {
        sortFilterEl.addEventListener('change', (e) => {
            collectionState.sortBy = e.target.value;
            filterAndRenderCollection();
        });
    }

    if (accountFilterEl) {
        accountFilterEl.addEventListener('change', (e) => {
            collectionState.accountFilter = e.target.value;
            filterAndRenderCollection();
        });
    }
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
    updateAccountFilter(accounts);
}

// Update account filter dropdown
function updateAccountFilter(accounts) {
    if (!accountFilterEl) return;

    const currentValue = accountFilterEl.value;
    
    accountFilterEl.innerHTML = '<option value="all">All Accounts</option>';
    
    const uniqueAccounts = [...new Set(accounts.map(a => a.playerName))].sort();
    
    for (const name of uniqueAccounts) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        accountFilterEl.appendChild(option);
    }

    // Restore previous selection if still valid
    if (uniqueAccounts.includes(currentValue) || currentValue === 'all') {
        accountFilterEl.value = currentValue;
    }
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
function renderCollection() {
    if (!brainrotsGridEl) return;

    const brainrots = collectionState.filteredBrainrots;
    
    // Update stats
    if (collectionStatsEl) {
        const uniqueNames = new Set(collectionState.allBrainrots.map(b => b.name.toLowerCase()));
        const generatedCount = Object.keys(collectionState.generations).length;
        collectionStatsEl.innerHTML = `
            <span><i class="fas fa-layer-group"></i> ${collectionState.allBrainrots.length} total</span>
            <span><i class="fas fa-fingerprint"></i> ${uniqueNames.size} unique</span>
            <span><i class="fas fa-wand-magic-sparkles"></i> ${generatedCount} generated</span>
            ${collectionState.searchQuery || collectionState.accountFilter !== 'all' 
                ? `<span><i class="fas fa-filter"></i> ${brainrots.length} shown</span>` 
                : ''}
        `;
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

    brainrotsGridEl.innerHTML = brainrots.map((b, index) => {
        const generated = isGenerated(b.name);
        const genInfo = getGenerationInfo(b.name);
        const accountColor = collectionState.accountColors[b.accountId] || '#4ade80';
        
        return `
        <div class="brainrot-card ${generated ? 'brainrot-generated' : ''}" data-brainrot-index="${index}">
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
                <div class="brainrot-account">
                    <span class="account-color-dot" style="background: ${accountColor};"></span>
                    ${b.accountName}
                </div>
            </div>
        </div>
    `}).join('');
}

// Handle generate button click
function handleGenerateClick(index) {
    const brainrot = collectionState.filteredBrainrots[index];
    if (brainrot) {
        openSupaGenerator(brainrot);
    }
}

// Update collection when data changes
async function updateCollection() {
    // Load generations and colors first
    await Promise.all([
        loadGenerationsData(),
        loadAccountColors()
    ]);
    
    collectAllBrainrots();
    filterAndRenderCollection();
}

// Initialize collection listeners
setupCollectionListeners();
