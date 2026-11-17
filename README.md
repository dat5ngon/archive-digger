# Archive Digger

Explore the Internet Archive -- search, browse, and view books, videos, images, software, and audio. Built-in viewers for each media type. Save items to collections and back them up to Google Drive.

## Features

- **Multi-media search** -- search across all Internet Archive media types (texts, movies, images, software, audio)
- **Built-in viewers** -- video player, image viewer with zoom, book reader, software emulator, audio player
- **Collections** -- organize saved items into named collections
- **Google Drive sync** -- backup/restore collections via SafePlace
- **No API key needed** -- all Internet Archive endpoints are public
- **No build tools** -- vanilla HTML/CSS/JS

## Usage

Open `https://dat5ngon.github.io/archive-digger/` or run locally:

```bash
python -m http.server 3003 --bind 127.0.0.1
```

Then open `http://localhost:3003`.

## Keyboard shortcuts

- `/` or `s` -- focus search
- `Escape` -- close viewer

## Tech stack

- Vanilla HTML/CSS/JS
- Internet Archive API (no key)
- SafePlace iframe for Google Drive sync
- GitHub Pages deployment
