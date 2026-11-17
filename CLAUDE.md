# Archive Digger -- Project Instructions

## Overview

Archive Digger is a static web app (HTML/CSS/JS) that explores the Internet Archive across all media types -- texts, videos, images, audio, and software. Built-in viewers for each media type, collections stored in `localStorage` with Google Drive backup via SafePlace iframe + postMessage API.

## Architecture

```
index.html    -- layout: header, search panel, viewer panel, collections panel, modals
style.css     -- dark theme with archive-orange accent (Outfit + Oswald fonts)
archive.js    -- Internet Archive API: search, metadata, file URLs, media type detection
viewer.js     -- built-in viewers: video player, image viewer, book/PDF reader, software embed
sync.js       -- Google Drive sync via SafePlace iframe + postMessage
app.js        -- state, DOM, init, search UI, rendering, collections, UI helpers
sw.js         -- Service Worker for app shell caching (offline support)
```

Scripts load in order: `archive.js` -> `viewer.js` -> `sync.js` -> `app.js`. All cross-file references are inside functions (resolved at runtime), so no circular dependency issues.

### Key concepts

- **Internet Archive API** -- searches `archive.org` for items by media type, fetches metadata, streams files directly. No API key needed.
- **Media types** -- texts, movies, image, software, audio. Each has a dedicated viewer.
- **Built-in viewers** -- HTML5 video for movies, image viewer with zoom for images, archive.org embed iframe for books and software emulators, HTML5 audio for audio.
- **Collections** -- stored in `localStorage` under key `archive_collections`. Each collection has `id`, `name`, `items[]`, `createdAt`.
- **Google Drive sync** -- uses a hidden iframe embedding `https://dat5ngon.github.io/safe-place/`. Communication via `postMessage` (request/response with unique IDs). No OAuth in archive-digger itself.
- **No build tools** -- vanilla HTML/CSS/JS. No npm, no bundlers.

### SafePlace postMessage protocol

```js
// Request:  { type: 'safeplace-request', id, action, ...params }
// Response: { type: 'safeplace-response', id, ok, ...data }

// Actions:
//   save  -- { app: 'archive-digger', filename: 'collections.json', data: [...] }
//   load  -- { app: 'archive-digger', filename: 'collections.json' }
//   ping  -- check if user is authenticated
```

Data is stored on Google Drive at `SafePlace/archive-digger/collections.json`.

## Development

### Local server

```bash
cd archive-digger
python -m http.server 3003 --bind 127.0.0.1
```

Open `http://localhost:3003`.

**Note**: Google Drive sync only works when both apps are on the same origin (`https://dat5ngon.github.io`).

### Deployment

Hosted on GitHub Pages from the `main` branch root.

```bash
git add -A && git commit -m "description" && git push
```

GitHub Pages URL: `https://dat5ngon.github.io/archive-digger/`

### Repository

- **Personal GitHub**: `dat5ngon/archive-digger`
- **Branch**: `main`
- **Related project**: `dat5ngon/safe-place` (provides Google Drive storage API)

## Coding guidelines

1. **No build tools** -- keep it vanilla HTML/CSS/JS.
2. **No frameworks** -- DOM manipulation only.
3. **No OAuth in archive-digger** -- all Google Drive operations go through SafePlace iframe via postMessage.
4. **SafePlace dependency** -- relies on SafePlace's postMessage API. If SafePlace's API changes, update `spRequest()` and sync functions.
5. **Theme**: dark background (`#0a0a0a`), archive-orange accent (`#e8a435`), Outfit body font, Oswald display font.
