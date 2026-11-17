// ---- Built-in Viewers ----

// Open the appropriate viewer for an item
async function openViewer(item) {
    const area = document.getElementById('viewerArea');
    const content = document.getElementById('viewerContent');
    const emptyEl = document.querySelector('.viewer-empty');
    area.innerHTML = '';

    // Show viewer, hide empty state
    content.classList.remove('hidden');
    if (emptyEl) emptyEl.style.display = 'none';

    // Activate mobile overlay if on small screen
    if (typeof activateMobileViewer === 'function') activateMobileViewer();

    // Update metadata
    document.getElementById('viewerTitle').textContent = item.title;
    document.getElementById('viewerCreator').textContent = item.creator || '';
    document.getElementById('openOnArchiveBtn').href = item.detailUrl;

    // Show loading
    area.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';

    try {
        const meta = await fetchItemMetadata(item.identifier);
        if (!meta) {
            area.innerHTML = '<div class="empty-state"><p>Could not load item metadata</p></div>';
            return;
        }

        // Update details with full metadata
        renderViewerDetails(meta);

        // Render the appropriate viewer
        const type = meta.mediatype;
        if (type === 'movies') renderVideoViewer(area, meta);
        else if (type === 'image') renderImageViewer(area, meta);
        else if (type === 'texts') renderTextViewer(area, meta);
        else if (type === 'software') renderSoftwareViewer(area, meta);
        else if (type === 'audio') renderAudioViewer(area, meta);
        else renderFallbackViewer(area, meta);
    } catch (err) {
        area.innerHTML = '<div class="empty-state"><p>Failed to load viewer</p></div>';
    }
}

// Close the viewer
function closeViewer() {
    const content = document.getElementById('viewerContent');
    const emptyEl = document.querySelector('.viewer-empty');
    const area = document.getElementById('viewerArea');
    const panel = document.getElementById('viewerPanel');

    // Stop any playing media
    const video = area.querySelector('video');
    if (video) { video.pause(); video.src = ''; }
    const audioEl = area.querySelector('audio');
    if (audioEl) { audioEl.pause(); audioEl.src = ''; }

    area.innerHTML = '';
    content.classList.add('hidden');
    if (emptyEl) emptyEl.style.display = '';

    // Exit full page mode if active
    if (typeof isFullPage !== 'undefined' && isFullPage) {
        isFullPage = false;
        panel.classList.remove('viewer-fullpage');
    }

    // Deactivate mobile overlay
    if (typeof deactivateMobileViewer === 'function') deactivateMobileViewer();

    // Deselect result items
    document.querySelectorAll('.result-item.selected').forEach(el => el.classList.remove('selected'));
}

// Render metadata details below the viewer
function renderViewerDetails(meta) {
    const detailsEl = document.getElementById('viewerDetails');
    const descEl = document.getElementById('viewerDescription');
    const titleEl = document.getElementById('viewerTitle');
    const creatorEl = document.getElementById('viewerCreator');

    titleEl.textContent = meta.title;
    creatorEl.textContent = meta.creator || '';

    let details = '';
    const badge = '<span class="media-badge media-badge-' + meta.mediatype + '">' + (MEDIA_LABELS[meta.mediatype] || meta.mediatype) + '</span>';
    details += '<span class="viewer-detail-item">' + badge + '</span>';
    if (meta.date) details += '<span class="viewer-detail-item">' + formatArchiveDate(meta.date) + '</span>';
    if (meta.downloads) details += '<span class="viewer-detail-item">' + formatDownloads(meta.downloads) + ' downloads</span>';
    if (meta.language) details += '<span class="viewer-detail-item">' + escapeHtml(meta.language) + '</span>';
    if (meta.subject && meta.subject.length > 0) {
        const tags = meta.subject.slice(0, 5).map(s => escapeHtml(s)).join(', ');
        details += '<span class="viewer-detail-item">' + tags + '</span>';
    }
    detailsEl.innerHTML = details;

    descEl.textContent = meta.description || 'No description available.';
}

// ---- Video Viewer ----
function renderVideoViewer(area, meta) {
    const files = getViewableFiles(meta);
    if (files.length === 0) {
        // Fall back to archive.org embed
        area.innerHTML = '<iframe src="' + meta.embedUrl + '" allowfullscreen></iframe>';
        return;
    }
    area.innerHTML = '';
    const video = document.createElement('video');
    video.controls = true;
    video.autoplay = false;
    video.preload = 'metadata';
    // Add sources -- prefer MP4
    const mp4 = files.find(f => f.name.toLowerCase().endsWith('.mp4'));
    const primary = mp4 || files[0];
    video.src = primary.url;
    area.appendChild(video);
    // Add quality dropdown if multiple formats
    if (files.length > 1) {
        const selector = createQualityDropdown(files, primary, (file) => {
            const currentTime = video.currentTime;
            const wasPlaying = !video.paused;
            video.src = file.url;
            video.load();
            video.addEventListener('loadedmetadata', () => {
                video.currentTime = currentTime;
                if (wasPlaying) video.play();
            }, { once: true });
        });
        area.appendChild(selector);
    }
}

// ---- Image Viewer ----
function renderImageViewer(area, meta) {
    const files = getViewableFiles(meta);
    area.innerHTML = '';
    if (files.length === 0) {
        // Use thumbnail as fallback
        const img = document.createElement('img');
        img.className = 'viewer-image';
        img.src = meta.thumbnail;
        img.alt = meta.title;
        img.addEventListener('click', () => img.classList.toggle('zoomed'));
        area.appendChild(img);
        return;
    }
    // Gallery mode
    let currentIdx = 0;
    const container = document.createElement('div');
    container.className = 'image-gallery';
    const img = document.createElement('img');
    img.className = 'viewer-image';
    img.src = files[0].url;
    img.alt = meta.title;
    img.addEventListener('click', () => img.classList.toggle('zoomed'));
    container.appendChild(img);
    area.appendChild(container);
    if (files.length > 1) {
        const nav = document.createElement('div');
        nav.className = 'image-nav';
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn btn-small';
        prevBtn.textContent = '\u2039 Prev';
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-small';
        nextBtn.textContent = 'Next \u203A';
        const counter = document.createElement('span');
        counter.className = 'image-counter';
        counter.textContent = '1 / ' + files.length;
        function updateImage() {
            img.classList.remove('zoomed');
            img.src = files[currentIdx].url;
            counter.textContent = (currentIdx + 1) + ' / ' + files.length;
        }
        prevBtn.addEventListener('click', () => { currentIdx = (currentIdx - 1 + files.length) % files.length; updateImage(); });
        nextBtn.addEventListener('click', () => { currentIdx = (currentIdx + 1) % files.length; updateImage(); });
        nav.appendChild(prevBtn);
        nav.appendChild(counter);
        nav.appendChild(nextBtn);
        area.appendChild(nav);
    }
}

// ---- Text/Book Viewer ----
function renderTextViewer(area, meta) {
    area.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = meta.embedUrl;
    iframe.allowFullscreen = true;
    iframe.id = 'bookReaderFrame';
    area.appendChild(iframe);
}

// ---- Software Viewer ----
function renderSoftwareViewer(area, meta) {
    // Use archive.org's built-in emulator (DOSBox, MAME, etc.)
    area.innerHTML = '<iframe src="' + meta.embedUrl + '" allowfullscreen></iframe>';
}

// ---- Audio Viewer ----
function renderAudioViewer(area, meta) {
    const files = getViewableFiles(meta);
    area.innerHTML = '';
    if (files.length === 0) {
        area.innerHTML = '<iframe src="' + meta.embedUrl + '" allowfullscreen></iframe>';
        return;
    }
    const audioEl = document.createElement('audio');
    audioEl.controls = true;
    audioEl.preload = 'metadata';
    const mp3 = files.find(f => f.name.toLowerCase().endsWith('.mp3'));
    audioEl.src = (mp3 || files[0]).url;
    area.appendChild(audioEl);
    if (files.length > 1) {
        const list = document.createElement('div');
        list.className = 'audio-track-list';
        files.forEach((f, idx) => {
            const item = document.createElement('div');
            item.className = 'audio-track-item';
            const name = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            const duration = f.length ? formatAudioTime(f.length) : '';
            item.innerHTML = '<span class="audio-track-name">' + escapeHtml(name) + '</span>'
                + (duration ? '<span class="audio-track-duration">' + duration + '</span>' : '');
            item.addEventListener('click', () => {
                audioEl.src = f.url;
                audioEl.play().catch(() => {});
                list.querySelectorAll('.audio-track-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
            });
            if (idx === 0 || (mp3 && f === mp3)) item.classList.add('active');
            list.appendChild(item);
        });
        area.appendChild(list);
    }
}

// ---- Fallback Viewer ----
function renderFallbackViewer(area, meta) {
    area.innerHTML = '<div class="empty-state">'
        + '<span class="empty-icon">&#x25A1;</span>'
        + '<p>This media type cannot be previewed directly.</p>'
        + '<a href="' + meta.detailUrl + '" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Open on Internet Archive</a>'
        + '</div>';
}

// ---- Helpers ----

// Create a file format selector with buttons (for small file lists)
function createFileSelector(files, onSelect) {
    const wrap = document.createElement('div');
    wrap.className = 'file-selector';
    const label = document.createElement('span');
    label.className = 'file-selector-label';
    label.textContent = 'Quality:';
    wrap.appendChild(label);
    files.forEach((f, idx) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-small' + (idx === 0 ? ' active' : '');
        const ext = f.name.substring(f.name.lastIndexOf('.') + 1).toUpperCase();
        const size = formatFileSize(f.size);
        btn.textContent = ext + (size ? ' (' + size + ')' : '');
        btn.addEventListener('click', () => {
            wrap.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onSelect(f);
        });
        wrap.appendChild(btn);
    });
    return wrap;
}

// Create a compact quality dropdown (for video with many formats)
function createQualityDropdown(files, selected, onSelect) {
    const wrap = document.createElement('div');
    wrap.className = 'quality-dropdown';
    const label = document.createElement('span');
    label.className = 'file-selector-label';
    label.textContent = 'Quality:';
    wrap.appendChild(label);
    const select = document.createElement('select');
    select.className = 'quality-select';
    files.forEach((f, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        const ext = f.name.substring(f.name.lastIndexOf('.') + 1).toUpperCase();
        const size = formatFileSize(f.size);
        opt.textContent = ext + (size ? ' (' + size + ')' : '');
        if (f === selected) opt.selected = true;
        select.appendChild(opt);
    });
    select.addEventListener('change', () => {
        onSelect(files[parseInt(select.value)]);
    });
    wrap.appendChild(select);
    return wrap;
}

function formatAudioTime(seconds) {
    if (!seconds || isNaN(seconds)) return '';
    seconds = Math.floor(seconds);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ':' + s.toString().padStart(2, '0');
}
