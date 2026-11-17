// ---- Google Drive Sync via SafePlace ----

const SP_ORIGIN = 'https://dat5ngon.github.io';
const SP_FRAME_ID = 'safePlaceFrame';
const SP_APP_NAME = 'archive-digger';
const SP_FILENAME = 'collections.json';
const SP_TIMEOUT = 10000;

// Send a request to SafePlace iframe (per-request handler, origin-checked)
function spRequest(action, params) {
    params = params || {};
    return new Promise((resolve, reject) => {
        const frame = document.getElementById(SP_FRAME_ID);
        if (!frame || !frame.contentWindow) {
            reject(new Error('SafePlace iframe not available'));
            return;
        }
        const id = 'sp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        const timeout = setTimeout(() => {
            window.removeEventListener('message', handler);
            reject(new Error('SafePlace not responding'));
        }, SP_TIMEOUT);
        function handler(event) {
            if (event.origin !== SP_ORIGIN) return;
            const msg = event.data;
            if (!msg || msg.type !== 'safeplace-response' || msg.id !== id) return;
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            if (msg.ok) resolve(msg); else reject(new Error(msg.error || 'Unknown error'));
        }
        window.addEventListener('message', handler);
        frame.contentWindow.postMessage(
            Object.assign({ type: 'safeplace-request', id: id, action: action }, params),
            SP_ORIGIN
        );
    });
}

// Check if SafePlace is authenticated
async function spPing() {
    try {
        await spRequest('ping');
        return true;
    } catch {
        return false;
    }
}

// Prompt user to sign into SafePlace
function promptSafePlaceSignIn() {
    showConfirmDialog(
        'Sign in Required',
        'Sign in to Safe Place first, then try syncing again.',
        () => {
            window.open('https://dat5ngon.github.io/safe-place/', '_blank');
            // Reload the hidden iframe when user returns so it picks up the new auth
            const onFocus = () => {
                window.removeEventListener('focus', onFocus);
                const frame = document.getElementById(SP_FRAME_ID);
                if (frame) {
                    frame.src = frame.src;
                }
            };
            window.addEventListener('focus', onFocus);
        },
        'Open Safe Place'
    );
}

// Handle sync errors
function handleSyncError(err) {
    const msg = err.message || '';
    if (msg.includes('not authenticated') || msg.includes('Not authenticated')) {
        promptSafePlaceSignIn();
    } else if (msg.includes('not responding')) {
        showConfirmDialog('Connection Issue', 'Could not connect to Safe Place.', () => window.open('https://dat5ngon.github.io/safe-place/', '_blank'), 'Open Safe Place');
    } else {
        showToast('Sync failed: ' + (msg || 'unknown error'));
    }
}

// Export collections to Google Drive
async function syncExportCollections() {
    showToast('Syncing...');
    try {
        if (!(await spPing())) { promptSafePlaceSignIn(); return; }
        const data = loadCollections();
        await spRequest('save', { app: SP_APP_NAME, filename: SP_FILENAME, data: data });
        showToast('Collections backed up to Google Drive');
    } catch (err) {
        handleSyncError(err);
    }
}

// Import collections from Google Drive
async function syncImportCollections() {
    showToast('Loading from Google Drive...');
    try {
        if (!(await spPing())) { promptSafePlaceSignIn(); return; }
        const result = await spRequest('load', { app: SP_APP_NAME, filename: SP_FILENAME });
        if (!result.data) { showToast('No collections found on Google Drive'); return; }
        const imported = Array.isArray(result.data) ? result.data : [];
        if (imported.length === 0) { showToast('No collections found on Google Drive'); return; }
        // Merge: add new collections, update existing by ID
        const current = loadCollections();
        let added = 0, updated = 0;
        for (const imp of imported) {
            const existing = current.find(c => c.id === imp.id);
            if (existing) {
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
        const parts = [];
        if (added > 0) parts.push(added + ' new');
        if (updated > 0) parts.push(updated + ' items merged');
        showToast('Imported: ' + (parts.length > 0 ? parts.join(', ') : 'no changes'));
    } catch (err) {
        handleSyncError(err);
    }
}
