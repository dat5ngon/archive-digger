// Archive Digger -- explore the Internet Archive
// No API key needed. All content is public domain / Creative Commons.

// ---- State ----
let collections = loadCollections();
let currentCollectionId = null;
let currentMediaType = 'all';
let currentSortOrder = 'downloads+desc';
let lastSearchQuery = '';
let searchPage = 1;
let hasMoreResults = false;
let isLoadingMore = false;
let currentViewItem = null;
let pendingItemForNewCollection = null;
let collectionsExpanded = false;
let isFullPage = false;

// ---- DOM Elements ----
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const resultCount = document.getElementById('resultCount');
const loadingIndicator = document.getElementById('loadingIndicator');
const collectionList = document.getElementById('collectionList');
const collectionItems = document.getElementById('collectionItems');
const collectionItemList = document.getElementById('collectionItemList');
const currentCollectionName = document.getElementById('currentCollectionName');
const collectionCount = document.getElementById('collectionCount');
const collectionsBody = document.getElementById('collectionsBody');
const collectionsBar = document.getElementById('collectionsBar');
const collectionModal = document.getElementById('collectionModal');
const collectionNameInput = document.getElementById('collectionNameInput');
const addToCollectionModal = document.getElementById('addToCollectionModal');
const collectionSelectList = document.getElementById('collectionSelectList');
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');

// ---- Initialization ----
function init() {
    renderCollections();
    setupEventListeners();
    updateCollectionCount();
}

function setupEventListeners() {
    // Search
    searchBtn.addEventListener('click', () => { const q = searchInput.value.trim(); if (q) doSearch(q); });
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const q = searchInput.value.trim(); if (q) doSearch(q); } });

    // Media type tabs
    document.querySelectorAll('.media-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.media-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMediaType = tab.dataset.type;
            if (lastSearchQuery) doSearch(lastSearchQuery);
        });
    });

    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSortOrder = btn.dataset.sort;
            if (lastSearchQuery) doSearch(lastSearchQuery);
        });
    });

    // Viewer
    document.getElementById('closeViewerBtn').addEventListener('click', closeViewer);
    document.getElementById('fullPageBtn').addEventListener('click', toggleFullPage);
    document.getElementById('viewerMetaToggle').addEventListener('click', toggleViewerMeta);
    document.getElementById('metaCollapseBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleViewerMeta(); });
    document.getElementById('addToCollectionBtn').addEventListener('click', () => {
        if (currentViewItem) showAddToCollectionModal(currentViewItem);
    });

    // Collections bar toggle
    document.getElementById('collectionsToggle').addEventListener('click', (e) => {
        // Don't toggle if clicking buttons inside the header
        if (e.target.closest('.btn') || e.target.closest('.dropdown-wrap')) return;
        toggleCollections();
    });
    document.getElementById('collectionsExpandBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCollections();
    });

    // Collections CRUD
    document.getElementById('newCollectionBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        pendingItemForNewCollection = null;
        showModal(collectionModal);
    });
    document.getElementById('cancelCollectionBtn').addEventListener('click', () => {
        pendingItemForNewCollection = null;
        hideModal(collectionModal);
    });
    document.getElementById('createCollectionBtn').addEventListener('click', createCollection);
    collectionNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') createCollection(); });
    document.getElementById('cancelAddBtn').addEventListener('click', () => hideModal(addToCollectionModal));
    document.getElementById('backToCollections').addEventListener('click', showCollectionList);
    document.getElementById('deleteCollectionBtn').addEventListener('click', deleteCurrentCollection);
    currentCollectionName.addEventListener('click', startEditCollectionName);

    // Sync
    document.getElementById('exportBtn').addEventListener('click', (e) => { e.stopPropagation(); syncExportCollections(); });
    const importDropdown = document.getElementById('importDropdown');
    document.getElementById('importBtn').addEventListener('click', (e) => { e.stopPropagation(); importDropdown.classList.toggle('hidden'); });
    document.getElementById('importFromDriveBtn').addEventListener('click', () => { importDropdown.classList.add('hidden'); syncImportCollections(); });
    document.addEventListener('click', () => importDropdown.classList.add('hidden'));

    // Confirm modal
    document.getElementById('confirmCancelBtn').addEventListener('click', () => hideModal(confirmModal));

    // Close modals on backdrop click
    [collectionModal, addToCollectionModal, confirmModal].forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(modal); });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === '/' || e.key === 's') { e.preventDefault(); searchInput.focus(); }
        if (e.key === 'Escape') {
            if (isFullPage) toggleFullPage();
            else closeViewer();
        }
        if (e.key === 'f' && currentViewItem) toggleFullPage();
    });
}

// ---- Search ----
async function doSearch(query) {
    lastSearchQuery = query;
    searchPage = 1;
    showLoading(true);
    searchResults.innerHTML = '';
    resultCount.textContent = '';
    try {
        const result = await searchArchiveItems(query, currentMediaType, currentSortOrder, 1);
        showLoading(false);
        hasMoreResults = result.hasMore;
        if (result.items.length > 0) {
            renderResults(result.items);
            resultCount.textContent = result.totalFound.toLocaleString() + ' results';
            if (hasMoreResults) addLoadMoreButton();
        } else {
            searchResults.innerHTML = '<div class="empty-state"><span class="empty-icon">--</span><p>No results found. Try different keywords or media type.</p></div>';
        }
    } catch (err) {
        showLoading(false);
        searchResults.innerHTML = '<div class="empty-state"><span class="empty-icon">!</span><p>Search failed. Check your connection.</p></div>';
    }
}

async function loadMoreResults() {
    if (isLoadingMore || !lastSearchQuery) return;
    isLoadingMore = true;
    const oldBtn = searchResults.querySelector('.load-more-btn');
    if (oldBtn) oldBtn.textContent = 'Loading...';
    try {
        searchPage++;
        const result = await searchArchiveItems(lastSearchQuery, currentMediaType, currentSortOrder, searchPage);
        hasMoreResults = result.hasMore;
        if (oldBtn) oldBtn.remove();
        if (result.items.length > 0) {
            result.items.forEach(item => searchResults.appendChild(createResultElement(item)));
            if (hasMoreResults) addLoadMoreButton();
        }
    } catch {
        showToast('Failed to load more results');
        if (oldBtn) oldBtn.textContent = 'Load More';
    }
    isLoadingMore = false;
}

function addLoadMoreButton() {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary load-more-btn';
    btn.textContent = 'Load More';
    btn.addEventListener('click', loadMoreResults);
    searchResults.appendChild(btn);
}

// ---- Rendering ----
function renderResults(items) {
    searchResults.innerHTML = '';
    items.forEach(item => searchResults.appendChild(createResultElement(item)));
}

function createResultElement(item) {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.dataset.identifier = item.identifier;
    if (currentViewItem && currentViewItem.identifier === item.identifier) div.classList.add('selected');

    const badgeClass = 'media-badge-' + item.mediatype;
    const badgeLabel = MEDIA_LABELS[item.mediatype] || item.mediatype;
    const dateStr = formatArchiveDate(item.date);
    const dlStr = item.downloads ? formatDownloads(item.downloads) + ' dl' : '';
    const metaParts = [dateStr, dlStr].filter(Boolean).join(' \u00B7 ');

    div.innerHTML = '<img class="result-thumb" src="' + item.thumbnail + '" alt="' + escapeHtml(item.title) + '" loading="lazy" onerror="this.src=\'' + placeholderImage() + '\'">'
        + '<div class="result-info">'
        + '<div class="result-title" title="' + escapeHtml(item.title) + '">' + escapeHtml(item.title) + '</div>'
        + '<div class="result-creator" title="' + escapeHtml(item.creator) + '">' + escapeHtml(item.creator) + '</div>'
        + '<div class="result-meta"><span class="media-badge ' + badgeClass + '">' + badgeLabel + '</span>' + (metaParts ? '<span>' + metaParts + '</span>' : '') + '</div>'
        + '</div>'
        + '<div class="result-actions">'
        + '<button class="result-action-btn save-btn" title="Save to collection">&#x2606;</button>'
        + '</div>';

    // Click to open viewer
    div.addEventListener('click', () => {
        document.querySelectorAll('.result-item.selected').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        currentViewItem = item;
        openViewer(item);
    });

    // Save button
    div.querySelector('.save-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showAddToCollectionModal(item);
    });

    return div;
}

function placeholderImage() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%2316161a' width='64' height='64'/%3E%3Ctext x='32' y='40' text-anchor='middle' fill='%2355556a' font-size='24'%3E%E2%97%87%3C/text%3E%3C/svg%3E";
}

// ---- Collections ----
function loadCollections() {
    try { return JSON.parse(localStorage.getItem('archive_collections') || '[]'); } catch { return []; }
}

function saveCollections(data) {
    if (data) collections = data;
    localStorage.setItem('archive_collections', JSON.stringify(collections));
}

function updateCollectionCount() {
    collectionCount.textContent = collections.length > 0 ? '(' + collections.length + ')' : '';
}

function renderCollections() {
    collectionList.innerHTML = '';
    updateCollectionCount();
    if (collections.length === 0) {
        collectionList.innerHTML = '<div class="empty-state" style="padding:20px"><p>No collections yet. Save items to organize them.</p></div>';
        return;
    }
    collections.forEach(col => {
        const div = document.createElement('div');
        div.className = 'collection-item';
        div.innerHTML = '<span class="collection-item-icon">&#x2606;</span>'
            + '<div class="collection-item-text">'
            + '<div class="collection-item-name">' + escapeHtml(col.name) + '</div>'
            + '<div class="collection-item-count">' + col.items.length + ' item' + (col.items.length !== 1 ? 's' : '') + '</div>'
            + '</div>';
        div.addEventListener('click', () => openCollection(col.id));
        collectionList.appendChild(div);
    });
}

function toggleCollections() {
    collectionsExpanded = !collectionsExpanded;
    collectionsBody.classList.toggle('hidden', !collectionsExpanded);
    collectionsBar.classList.toggle('expanded', collectionsExpanded);
}

function createCollection() {
    const name = collectionNameInput.value.trim();
    if (!name) { showToast('Enter a collection name'); return; }
    const newCol = { id: 'col_' + Date.now(), name, items: [], createdAt: new Date().toISOString() };
    if (pendingItemForNewCollection) {
        newCol.items.push(itemToCollectionEntry(pendingItemForNewCollection));
        pendingItemForNewCollection = null;
    }
    collections.push(newCol);
    saveCollections();
    renderCollections();
    hideModal(collectionModal);
    collectionNameInput.value = '';
    showToast(newCol.items.length > 0 ? 'Created "' + name + '" with 1 item' : 'Collection "' + name + '" created');
    if (!collectionsExpanded) toggleCollections();
}

function openCollection(id) {
    currentCollectionId = id;
    const col = collections.find(c => c.id === id);
    if (!col) return;
    currentCollectionName.textContent = col.name;
    collectionList.classList.add('hidden');
    collectionItems.classList.remove('hidden');
    renderCollectionItems(col);
}

function renderCollectionItems(col) {
    collectionItemList.innerHTML = '';
    if (col.items.length === 0) {
        collectionItemList.innerHTML = '<div class="empty-state" style="padding:20px"><p>No items yet. Browse and save items here.</p></div>';
        return;
    }
    col.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'collection-saved-item';
        div.innerHTML = '<img class="collection-saved-thumb" src="' + (item.thumbnail || placeholderImage()) + '" alt="" loading="lazy" onerror="this.src=\'' + placeholderImage() + '\'">'
            + '<div class="collection-saved-info"><div class="collection-saved-title" title="' + escapeHtml(item.title) + '">' + escapeHtml(item.title) + '</div></div>'
            + '<button class="collection-saved-remove" title="Remove">&#x2715;</button>';
        div.addEventListener('click', (e) => {
            if (e.target.closest('.collection-saved-remove')) return;
            // Open this item in the viewer
            currentViewItem = item;
            openViewer(item);
        });
        div.querySelector('.collection-saved-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeItemFromCollection(col.id, item.identifier);
        });
        collectionItemList.appendChild(div);
    });
}

function showCollectionList() {
    currentCollectionId = null;
    collectionItems.classList.add('hidden');
    collectionList.classList.remove('hidden');
    renderCollections();
}

function showAddToCollectionModal(item) {
    collectionSelectList.innerHTML = '';
    // Create new option
    const createDiv = document.createElement('div');
    createDiv.className = 'collection-select-item collection-select-create';
    createDiv.innerHTML = '<span>+</span><span>Create new collection</span>';
    createDiv.addEventListener('click', () => {
        hideModal(addToCollectionModal);
        pendingItemForNewCollection = item;
        showModal(collectionModal);
    });
    collectionSelectList.appendChild(createDiv);
    // Existing collections
    collections.forEach(col => {
        const div = document.createElement('div');
        div.className = 'collection-select-item';
        const exists = col.items.some(i => i.identifier === item.identifier);
        div.innerHTML = '<span>&#x2606;</span><span>' + escapeHtml(col.name) + ' (' + col.items.length + ')' + (exists ? ' \u2713' : '') + '</span>';
        if (!exists) {
            div.addEventListener('click', () => {
                addItemToCollection(col.id, item);
                hideModal(addToCollectionModal);
            });
        } else {
            div.style.opacity = '0.5';
            div.style.cursor = 'default';
        }
        collectionSelectList.appendChild(div);
    });
    showModal(addToCollectionModal);
}

function addItemToCollection(colId, item) {
    const col = collections.find(c => c.id === colId);
    if (!col) return;
    if (col.items.some(i => i.identifier === item.identifier)) {
        showToast('Already in collection');
        return;
    }
    col.items.push(itemToCollectionEntry(item));
    saveCollections();
    showToast('Added to "' + col.name + '"');
    renderCollections();
    if (currentCollectionId === colId) renderCollectionItems(col);
}

function removeItemFromCollection(colId, identifier) {
    const col = collections.find(c => c.id === colId);
    if (!col) return;
    col.items = col.items.filter(i => i.identifier !== identifier);
    saveCollections();
    renderCollectionItems(col);
    showToast('Item removed');
}

function deleteCurrentCollection() {
    if (!currentCollectionId) return;
    const col = collections.find(c => c.id === currentCollectionId);
    if (!col) return;
    showConfirmDialog('Delete Collection', 'Delete "' + col.name + '"? This cannot be undone.', () => {
        collections = collections.filter(c => c.id !== currentCollectionId);
        saveCollections();
        showCollectionList();
        showToast('Collection deleted');
    });
}

function startEditCollectionName() {
    if (!currentCollectionId) return;
    const col = collections.find(c => c.id === currentCollectionId);
    if (!col) return;
    const h3 = currentCollectionName;
    const oldName = col.name;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    input.maxLength = 50;
    input.style.cssText = 'background:var(--bg-input);border:1px solid var(--accent);color:var(--text);padding:4px 8px;font-size:14px;font-family:inherit;border-radius:4px;width:200px;';
    h3.textContent = '';
    h3.appendChild(input);
    input.focus();
    input.select();
    function commitEdit() {
        const newName = input.value.trim();
        if (newName && newName !== oldName) {
            col.name = newName;
            saveCollections();
            showToast('Collection renamed');
        }
        h3.textContent = col.name;
    }
    input.addEventListener('blur', commitEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = oldName; input.blur(); }
    });
}

// Convert a search result item to a collection entry (smaller footprint)
function itemToCollectionEntry(item) {
    return {
        identifier: item.identifier,
        title: item.title,
        creator: item.creator || '',
        mediatype: item.mediatype,
        thumbnail: item.thumbnail || '',
        description: (item.description || '').substring(0, 200),
        date: item.date || '',
        detailUrl: item.detailUrl || IA_DETAILS + '/' + item.identifier,
        embedUrl: item.embedUrl || IA_EMBED + '/' + item.identifier
    };
}

// ---- UI Helpers ----
function showLoading(show) {
    loadingIndicator.classList.toggle('hidden', !show);
    searchResults.classList.toggle('hidden', show);
}

function showModal(m) {
    m.classList.remove('hidden');
    const i = m.querySelector('input');
    if (i) setTimeout(() => i.focus(), 100);
}

function hideModal(m) { m.classList.add('hidden'); }

function showConfirmDialog(title, message, onConfirm, okLabel) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    showModal(confirmModal);
    const currentOkBtn = document.getElementById('confirmOkBtn');
    const newOkBtn = currentOkBtn.cloneNode(true);
    currentOkBtn.parentNode.replaceChild(newOkBtn, currentOkBtn);
    newOkBtn.textContent = okLabel || 'Delete';
    newOkBtn.className = (okLabel && okLabel !== 'Delete') ? 'btn btn-primary' : 'btn btn-danger';
    newOkBtn.addEventListener('click', () => { hideModal(confirmModal); onConfirm(); });
}

function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

let toastTimeout;
function showToast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => t.classList.remove('show'), 2500);
}

// ---- Full Page Viewer ----
function toggleFullPage() {
    const panel = document.getElementById('viewerPanel');
    isFullPage = !isFullPage;
    panel.classList.toggle('viewer-fullpage', isFullPage);
}

// ---- Viewer Meta Toggle ----
function toggleViewerMeta() {
    const meta = document.getElementById('viewerMeta');
    meta.classList.toggle('collapsed');
}

function activateMobileViewer() {
    const panel = document.getElementById('viewerPanel');
    if (window.innerWidth <= 600) {
        panel.classList.add('mobile-active');
    }
}

function deactivateMobileViewer() {
    const panel = document.getElementById('viewerPanel');
    panel.classList.remove('mobile-active');
}

// ---- Start ----
init();
