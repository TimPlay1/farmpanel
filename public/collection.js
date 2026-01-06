// ==========================================
// COLLECTION VIEW - All Brainrots from all accounts
// ==========================================

// Supa Generator - use relative URL for Vercel
const SUPA_GENERATOR_URL = '';

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
        
        const response = await fetch(`/api/generations?farmKey=${encodeURIComponent(farmKey)}`);
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
        // Get account IDs from current data
        const data = state.farmersData[state.currentKey];
        if (!data || !data.accounts) {
            collectionState.accountColors = {};
            return;
        }
        
        const accountIds = data.accounts.map(a => a.userId).join(',');
        const response = await fetch(`/api/account-colors?accountIds=${accountIds}`);
        const result = await response.json();
        collectionState.accountColors = result.colors || {};
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
        const response = await fetch(`/api/supa-generate`, {
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
        
        // Direct download from Supa URL
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
    let mutationCount = 0;

    for (const account of accounts) {
        if (!account.brainrots) continue;
        
        for (const b of account.brainrots) {
            if (b.mutation) {
                mutationCount++;
                console.log('[Collection] Found mutation:', b.name, '→', b.mutation);
            }
            brainrots.push({
                name: b.name,
                income: b.income || 0,
                incomeText: b.incomeText || '',
                imageUrl: b.imageUrl || getBrainrotImageUrl(b.name),
                accountName: account.playerName || 'Unknown',
                accountId: account.userId,
                mutation: b.mutation || null,
                floor: b.floor || 1,
                podiumIndex: b.podiumIndex
            });
        }
    }
    
    console.log('[Collection] Total brainrots:', brainrots.length, 'with mutations:', mutationCount);

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
    const isSelectionMode = massSelectionState && massSelectionState.isActive;
    
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
            ${isSelectionMode ? `<span style="color: var(--accent-primary);"><i class="fas fa-check-square"></i> Режим выбора</span>` : ''}
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
        const isSelected = isSelectionMode && massSelectionState.selectedItems.includes(index);
        
        // Debug: log brainrots with mutations
        if (b.mutation) {
            console.log('Brainrot with mutation:', b.name, '→', b.mutation);
        }
        
        // Mutation styling
        const mutationColors = {
            'Gold': '#FFD700',
            'Diamond': '#00BFFF',
            'Bloodrot': '#8B0000',
            'Rainbow': 'linear-gradient(90deg, red, orange, yellow, green, blue, violet)',
            'Candy': '#FF69B4',
            'Lava': '#FF4500',
            'Galaxy': '#9400D3',
            'YinYang': 'linear-gradient(90deg, #000, #fff)',
            'Yin Yang': 'linear-gradient(90deg, #000, #fff)',
            'Radioactive': '#32CD32'
        };
        
        // Clean mutation text from HTML tags
        let cleanMutation = b.mutation;
        if (cleanMutation && typeof cleanMutation === 'string') {
            cleanMutation = cleanMutation.replace(/<[^>]+>/g, '').trim();
            // Normalize "Yin Yang" to "YinYang" for color lookup
            if (cleanMutation.toLowerCase().includes('yin') && cleanMutation.toLowerCase().includes('yang')) {
                cleanMutation = 'YinYang';
            }
        }
        
        const mutationBadge = cleanMutation ? `
            <div class="brainrot-mutation-badge" style="background: ${mutationColors[cleanMutation] || '#888'};" title="Мутация: ${cleanMutation}">
                ${cleanMutation}
            </div>
        ` : '';
        
        // Build class list
        const classes = ['brainrot-card'];
        if (generated) classes.push('brainrot-generated');
        if (isSelectionMode) classes.push('selectable');
        if (isSelected) classes.push('selected');
        if (cleanMutation) classes.push('brainrot-mutated');
        
        // Click handler for selection mode
        const clickHandler = isSelectionMode 
            ? `onclick="toggleBrainrotSelection(${index})"` 
            : '';
        
        return `
        <div class="${classes.join(' ')}" data-brainrot-index="${index}" ${clickHandler}>
            <div class="brainrot-generate-btn" onclick="event.stopPropagation(); handleGenerateClick(${index})" title="Генерировать изображение">
                <i class="fas fa-${generated ? 'check' : 'plus'}"></i>
            </div>
            ${generated ? `
            <div class="brainrot-generated-badge" title="Сгенерировано${genInfo?.count > 1 ? ' (' + genInfo.count + 'x)' : ''}">
                <i class="fas fa-check-circle"></i>
            </div>
            ` : ''}
            ${mutationBadge}
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

// ==========================================
// MASS SELECTION MODE
// ==========================================

// Mass selection state
let massSelectionState = {
    isActive: false,
    selectedItems: [], // Array of brainrot indices
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
        massSelectionState.selectedItems = [];
        updateMassSelectionUI();
    } else {
        fab.classList.remove('active');
        fab.innerHTML = '<i class="fas fa-layer-group"></i>';
        fab.title = 'Массовый выбор для генерации';
        indicator.classList.remove('visible');
        massSelectionState.selectedItems = [];
    }
    
    // Re-render collection to show/hide checkboxes
    renderCollection();
}

// Toggle brainrot selection
function toggleBrainrotSelection(index) {
    if (!massSelectionState.isActive) return;
    
    const idx = massSelectionState.selectedItems.indexOf(index);
    if (idx === -1) {
        massSelectionState.selectedItems.push(index);
    } else {
        massSelectionState.selectedItems.splice(idx, 1);
    }
    
    updateMassSelectionUI();
    
    // Update card appearance
    const card = document.querySelector(`[data-brainrot-index="${index}"]`);
    if (card) {
        card.classList.toggle('selected', massSelectionState.selectedItems.includes(index));
    }
}

// Update mass selection UI (counter and button)
function updateMassSelectionUI() {
    const countEl = document.getElementById('massSelectCount');
    const btnEl = document.getElementById('massSelectGenerateBtn');
    const count = massSelectionState.selectedItems.length;
    
    if (countEl) countEl.textContent = count;
    if (btnEl) {
        btnEl.disabled = count === 0;
        btnEl.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> Генерировать${count > 0 ? ` (${count})` : ''}`;
    }
}

// Open mass generation modal
function openMassGenerationModal() {
    if (massSelectionState.selectedItems.length === 0) return;
    
    const modal = document.getElementById('massGenerationModal');
    const list = document.getElementById('massGenList');
    const countEl = document.getElementById('massGenCount');
    const progressEl = document.getElementById('massGenProgress');
    const errorEl = document.getElementById('massGenError');
    const startBtn = document.getElementById('startMassGen');
    
    // Reset state
    progressEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    startBtn.disabled = false;
    startBtn.innerHTML = `<i class="fas fa-play"></i> Начать (<span id="massGenCount">${massSelectionState.selectedItems.length}</span>)`;
    
    // Render list of selected items
    const selectedBrainrots = massSelectionState.selectedItems.map(idx => ({
        ...collectionState.filteredBrainrots[idx],
        originalIndex: idx
    }));
    
    // v9.12.39: Store original filteredBrainrots index to preserve mutation data
    list.innerHTML = selectedBrainrots.map((b, i) => {
        const accountColor = collectionState.accountColors[b.accountId] || '#4ade80';
        return `
            <div class="mass-gen-item" data-item-index="${i}" data-original-index="${b.originalIndex}">
                <img class="mass-gen-item-img" src="${b.imageUrl || ''}" alt="${b.name}" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%231a1a2e%22 width=%2240%22 height=%2240%22/></svg>'">
                <div class="mass-gen-item-info">
                    <div class="mass-gen-item-name">${b.name}</div>
                    <div class="mass-gen-item-details">
                        <span><i class="fas fa-coins"></i> ${b.incomeText || formatIncome(b.income)}</span>
                        <span style="color: ${accountColor}"><i class="fas fa-user"></i> ${b.accountName}</span>
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
    
    countEl.textContent = selectedBrainrots.length;
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
    const createQueue = document.getElementById('massGenCreateQueue')?.checked ?? true;
    
    if (items.length === 0) return;
    
    massSelectionState.isGenerating = true;
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Генерация...';
    progressEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    
    // Disable remove buttons
    list.querySelectorAll('.mass-gen-item-remove').forEach(btn => btn.style.display = 'none');
    
    const total = items.length;
    let completed = 0;
    let errors = 0;
    const results = [];
    
    // Get brainrots data from the list
    // v9.12.39: Use original index to preserve exact brainrot data (including mutation)
    const brainrotsToGenerate = [];
    items.forEach((item, idx) => {
        const originalIndex = parseInt(item.dataset.originalIndex, 10);
        
        // Use exact brainrot by index instead of searching by name
        const brainrot = !isNaN(originalIndex) 
            ? collectionState.filteredBrainrots[originalIndex]
            : null;
            
        if (brainrot) {
            brainrotsToGenerate.push({
                ...brainrot,
                itemIndex: idx
            });
            console.log(`[MassGen] Item ${idx}: ${brainrot.name}, mutation: ${brainrot.mutation || 'None'}`);
        }
    });
    
    // Queue for Eldorado
    const eldoradoQueue = [];
    
    for (const brainrot of brainrotsToGenerate) {
        const idx = brainrot.itemIndex;
        const statusEl = list.querySelector(`[data-status-index="${idx}"]`);
        
        // Update status to processing
        if (statusEl) {
            statusEl.className = 'mass-gen-item-status processing';
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        
        try {
            // Generate image
            const borderColor = collectionState.accountColors[brainrot.accountId] || '#4ade80';
            const priceKey = `${brainrot.name.toLowerCase()}_${Math.floor(brainrot.income / 1000000)}`;
            const price = state.eldoradoPrices?.[priceKey]?.minPrice || 
                         state.brainrotPrices?.[brainrot.name.toLowerCase()] || 0;
            
            const response = await fetch(`/api/supa-generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: brainrot.name, 
                    income: brainrot.incomeText || formatIncome(brainrot.income), 
                    price: price ? `$${price.toFixed(2)}` : '',
                    imageUrl: brainrot.imageUrl,
                    borderColor,
                    accountId: brainrot.accountId,
                    accountName: brainrot.accountName
                })
            });
            
            const result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Generation failed');
            }
            
            // Save generation record
            await saveGeneration(brainrot.name, brainrot.accountId, result.resultUrl);
            
            // Add to Eldorado queue
            // v9.12.38: Include mutation in queue data
            if (createQueue) {
                eldoradoQueue.push({
                    name: brainrot.name,
                    income: brainrot.incomeText || formatIncome(brainrot.income),
                    imageUrl: result.resultUrl,
                    price: price || 0,
                    accountId: brainrot.accountId,
                    accountName: brainrot.accountName,
                    mutation: brainrot.mutation || null  // v9.12.38: Pass mutation to queue
                });
            }
            
            results.push({ success: true, name: brainrot.name, resultUrl: result.resultUrl });
            
            // Update status to done
            if (statusEl) {
                statusEl.className = 'mass-gen-item-status done';
                statusEl.innerHTML = '<i class="fas fa-check"></i>';
            }
            
        } catch (error) {
            console.error('Mass gen error for', brainrot.name, error);
            errors++;
            results.push({ success: false, name: brainrot.name, error: error.message });
            
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
    
    // Save Eldorado queue to localStorage
    if (createQueue && eldoradoQueue.length > 0) {
        localStorage.setItem('eldoradoQueue', JSON.stringify(eldoradoQueue));
        localStorage.setItem('eldoradoQueueIndex', '0');
        localStorage.setItem('eldoradoQueueCompleted', '[]');
        localStorage.setItem('eldoradoQueueTimestamp', Date.now().toString());
        console.log('Eldorado queue saved:', eldoradoQueue.length, 'items');
    }
    
    massSelectionState.isGenerating = false;
    
    // Show results
    const successCount = results.filter(r => r.success).length;
    startBtn.innerHTML = `<i class="fas fa-check"></i> Готово (${successCount}/${total})`;
    
    if (errors > 0) {
        errorEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${errors} ошибок при генерации`;
        errorEl.classList.remove('hidden');
    }
    
    // Update collection to show generated badges
    renderCollection();
    
    // Show notification
    if (typeof showNotification === 'function') {
        if (createQueue && eldoradoQueue.length > 0) {
            showNotification(`✅ Сгенерировано ${successCount}/${total}. Очередь Eldorado: ${eldoradoQueue.length} шт. Откройте Eldorado для создания офферов.`, 'success');
        } else {
            showNotification(`✅ Сгенерировано ${successCount} из ${total}`, successCount === total ? 'success' : 'info');
        }
    }
    
    // Close modal after delay and exit selection mode
    setTimeout(() => {
        closeMassGenerationModal();
        if (massSelectionState.isActive) {
            toggleMassSelectionMode();
        }
    }, 2000);
}

// Setup mass selection event listeners
function setupMassSelectionListeners() {
    const fab = document.getElementById('massSelectFab');
    const generateBtn = document.getElementById('massSelectGenerateBtn');
    const closeModalBtn = document.getElementById('closeMassGenModal');
    const cancelBtn = document.getElementById('cancelMassGen');
    const startBtn = document.getElementById('startMassGen');
    const modalOverlay = document.querySelector('#massGenerationModal .modal-overlay');
    
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

// ==========================================
// EXPORT FUNCTIONS TO GLOBAL SCOPE
// ==========================================
// These functions are used by onclick handlers in HTML
window.handleGenerateClick = handleGenerateClick;
window.toggleBrainrotSelection = toggleBrainrotSelection;
window.removeMassGenItem = removeMassGenItem;
window.openSupaGenerator = openSupaGenerator;
window.closeSupaModal = closeSupaModal;
window.updateSupaImagePreview = updateSupaImagePreview;
window.generateSupaImage = generateSupaImage;
window.downloadSupaImage = downloadSupaImage;

// Initialize collection listeners
setupCollectionListeners();
setupMassSelectionListeners();

