// ---- Internet Archive API ----

const IA_SEARCH = 'https://archive.org/advancedsearch.php';
const IA_META = 'https://archive.org/metadata';
const IA_DOWNLOAD = 'https://archive.org/download';
const IA_THUMB = 'https://archive.org/services/img';
const IA_EMBED = 'https://archive.org/embed';
const IA_DETAILS = 'https://archive.org/details';

const ITEMS_PER_PAGE = 20;

const MEDIA_LABELS = {
    texts: 'Book',
    movies: 'Video',
    image: 'Image',
    software: 'Software',
    audio: 'Audio'
};

// Search the Internet Archive
async function searchArchiveItems(query, mediaType, sortOrder, page) {
    let searchQuery = '';
    if (query) {
        const quoted = query.includes(' ') ? '"' + query + '"' : query;
        searchQuery = '(title:(' + quoted + ') OR creator:(' + quoted + ') OR subject:(' + quoted + ') OR description:(' + quoted + '))';
    }
    if (mediaType && mediaType !== 'all') {
        const typeFilter = 'mediatype:' + mediaType;
        searchQuery = searchQuery ? searchQuery + ' AND ' + typeFilter : typeFilter;
    } else {
        // Exclude collections and web captures for "all" search
        searchQuery = searchQuery ? searchQuery + ' AND NOT mediatype:(collection OR web)' : 'NOT mediatype:(collection OR web)';
    }
    const start = (page - 1) * ITEMS_PER_PAGE;
    const fields = 'identifier,title,creator,mediatype,date,downloads,description,subject';
    const url = IA_SEARCH
        + '?q=' + encodeURIComponent(searchQuery)
        + '&fl[]=' + fields.split(',').join('&fl[]=')
        + '&sort[]=' + sortOrder
        + '&rows=' + ITEMS_PER_PAGE
        + '&start=' + start
        + '&output=json';
    const response = await fetch(url);
    const data = await response.json();
    const totalFound = data.response?.numFound || 0;
    const hasMore = (start + ITEMS_PER_PAGE) < totalFound;
    const docs = data.response?.docs || [];
    const items = docs.map(doc => normalizeItem(doc));
    return { items, totalFound, hasMore };
}

// Normalize a search result doc into a consistent item shape
function normalizeItem(doc) {
    const creator = Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || '');
    const description = Array.isArray(doc.description) ? doc.description[0] : (doc.description || '');
    const subject = Array.isArray(doc.subject) ? doc.subject : (doc.subject ? [doc.subject] : []);
    return {
        identifier: doc.identifier,
        title: doc.title || doc.identifier,
        creator: creator,
        mediatype: doc.mediatype || 'unknown',
        date: doc.date || '',
        downloads: doc.downloads || 0,
        description: stripHtml(description).substring(0, 500),
        subject: subject,
        thumbnail: IA_THUMB + '/' + doc.identifier,
        detailUrl: IA_DETAILS + '/' + doc.identifier,
        embedUrl: IA_EMBED + '/' + doc.identifier
    };
}

// Fetch full metadata for an item
async function fetchItemMetadata(identifier) {
    const response = await fetch(IA_META + '/' + identifier);
    const meta = await response.json();
    if (!meta.metadata) return null;
    const m = meta.metadata;
    const creator = Array.isArray(m.creator) ? m.creator[0] : (m.creator || '');
    const description = Array.isArray(m.description) ? m.description.join('\n') : (m.description || '');
    const subject = Array.isArray(m.subject) ? m.subject : (m.subject ? [m.subject] : []);
    return {
        identifier: identifier,
        title: m.title || identifier,
        creator: creator,
        mediatype: m.mediatype || 'unknown',
        date: m.date || m.publicdate || '',
        downloads: parseInt(m.downloads) || 0,
        description: stripHtml(description),
        subject: subject,
        thumbnail: IA_THUMB + '/' + identifier,
        detailUrl: IA_DETAILS + '/' + identifier,
        embedUrl: IA_EMBED + '/' + identifier,
        files: (meta.files || []).map(f => ({
            name: f.name,
            format: f.format || '',
            size: parseInt(f.size) || 0,
            source: f.source || '',
            length: f.length ? parseFloat(f.length) : 0,
            url: IA_DOWNLOAD + '/' + identifier + '/' + encodeURIComponent(f.name)
        })),
        collection: Array.isArray(m.collection) ? m.collection : (m.collection ? [m.collection] : []),
        licenseurl: m.licenseurl || '',
        language: Array.isArray(m.language) ? m.language[0] : (m.language || '')
    };
}

// Get viewable/playable files for an item based on media type
function getViewableFiles(meta) {
    if (!meta || !meta.files) return [];
    const type = meta.mediatype;
    if (type === 'movies') {
        return meta.files.filter(f => {
            const name = f.name.toLowerCase();
            return (name.endsWith('.mp4') || name.endsWith('.ogv') || name.endsWith('.webm'))
                && f.source !== 'metadata';
        }).sort((a, b) => b.size - a.size); // largest (best quality) first
    }
    if (type === 'image') {
        return meta.files.filter(f => {
            const name = f.name.toLowerCase();
            return (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png')
                || name.endsWith('.gif') || name.endsWith('.webp'))
                && f.source !== 'metadata' && !name.includes('_thumb');
        });
    }
    if (type === 'audio') {
        return meta.files.filter(f => {
            const name = f.name.toLowerCase();
            return (name.endsWith('.mp3') || name.endsWith('.ogg') || name.endsWith('.m4a') || name.endsWith('.flac'))
                && f.source !== 'metadata';
        });
    }
    if (type === 'texts') {
        // For texts, prefer PDF, then EPUB, then DJVU
        return meta.files.filter(f => {
            const name = f.name.toLowerCase();
            return (name.endsWith('.pdf') || name.endsWith('.epub') || name.endsWith('.djvu'))
                && f.source !== 'metadata';
        }).sort((a, b) => {
            const order = { '.pdf': 0, '.epub': 1, '.djvu': 2 };
            const extA = a.name.substring(a.name.lastIndexOf('.')).toLowerCase();
            const extB = b.name.substring(b.name.lastIndexOf('.')).toLowerCase();
            return (order[extA] || 9) - (order[extB] || 9);
        });
    }
    // Software -- return all files (viewer will use embed)
    return meta.files.filter(f => f.source !== 'metadata');
}

// Strip HTML tags from a string
function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

// Format a date string for display
function formatArchiveDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr.substring(0, 10);
        return d.getFullYear().toString();
    } catch {
        return dateStr.substring(0, 10);
    }
}

// Format download count
function formatDownloads(n) {
    if (!n) return '';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}
