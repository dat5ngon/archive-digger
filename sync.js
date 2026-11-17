// ---- Google Drive Sync via SafePlace ----

const SP_FRAME_ID = 'safePlaceFrame';
const SP_APP_NAME = 'archive-digger';
const SP_FILENAME = 'collections.json';
const SP_TIMEOUT = 15000;

let spPendingRequests = {};

// Listen for SafePlace responses
window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'safeplace-response') return;
    const pending = spPendingRequests[e.data.id];
    if (pending) {
        delete spPendingRequests[e.data.id];
        pending.resolve(e.data);
    }
});

// Send a request to SafePlace iframe
function spRequest(action, params) {
    return new Promise((resolve, reject) => {
        const frame = document.getElementById(SP_FRAME_ID);
        if (!frame || !frame.contentWindow) {
            reject(new Error('SafePlace iframe not available'));
            return;
        }
        const id = 'sp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        const msg = { type: 'safeplace-request', id, action, ...params };
        spPendingRequests[id] = { resolve, reject };
        setTimeout(() => {
            if (spPendingRequests[id]) {
                delete spPendingRequests[id];
                reject(new Error('SafePlace request timed out'));
            }
        }, SP_TIMEOUT);
        frame.contentWindow.postMessage(msg, '*');
    });
}

// Check if SafePlace is authenticated
async function spPing() {
    try {
        const res = await spRequest('ping', {});
        return res.ok === true;
    } catch {
        return false;
    }
}

// Export collections to Google Drive
async function syncExportCollections() {
    const syncStatus = document.getElementById('syncStatus');
    syncStatus.textContent = 'Syncing...';
    try {
        const authenticated = await spPing();
        if (!authenticated) {
            showToast('Sign into SafePlace first to sync');
            syncStatus.textContent = '';
            return;
        }
        const data = loadCollections();
        const res = await spRequest('save', { app: SP_APP_NAME, filename: SP_FILENAME, data });
        if (res.ok) {
            showToast('Collections backed up to Google Drive');
            syncStatus.textContent = 'Synced';
            setTimeout(() => { syncStatus.textContent = ''; }, 3000);
        } else {
            showToast('Backup failed');
            syncStatus.textContent = '';
        }
    } catch {
        showToast('Sync failed -- check SafePlace connection');
        syncStatus.textContent = '';
    }
}

// Import collections from Google Drive
async function syncImportCollections() {
    const syncStatus = document.getElementById('syncStatus');
    syncStatus.textContent = 'Loading...';
    try {
        const authenticated = await spPing();
        if (!authenticated) {
            showToast('Sign into SafePlace first to sync');
            syncStatus.textContent = '';
            return;
        }
        const res = await spRequest('load', { app: SP_APP_NAME, filename: SP_FILENAME });
        if (res.ok && res.data) {
            const imported = Array.isArray(res.data) ? res.data : [];
            if (imported.length === 0) {
                showToast('No collections found on Google Drive');
                syncStatus.textContent = '';
                return;
            }
            // Merge: add new collections, update existing by ID
            const current = loadCollections();
            let added = 0, updated = 0;
            for (const imp of imported) {
                const existing = current.find(c => c.id === imp.id);
                if (existing) {
                    // Merge items
                    for (const item of (imp.items || [])) {
                        if (!existing.items.some(i => i.identifier === item.identifier)) {
                            existing.items.push(item);
                            updated++;
                        }
                    }
                } else {
                    current.push(imp);
                    added++;
                }
            }
            saveCollections(current);
            collections = current;
            renderCollections();
            showToast('Imported: ' + added + ' new, ' + updated + ' items merged');
            syncStatus.textContent = '';
        } else {
            showToast('No backup found on Google Drive');
            syncStatus.textContent = '';
        }
    } catch {
        showToast('Import failed -- check SafePlace connection');
        syncStatus.textContent = '';
    }
}
