---
layout: default
title: Roadmap
---

# Roadmap

How ideas in `SUGGESTIONS.md` become concrete work, and what to pick up next.

## Source of truth

- `SUGGESTIONS.md` — proposed features, enhancements, and fixes (priority tags).
- This roadmap — current focus and recently shipped initiatives.
- README + AGENTS.md link here for contributors.

## Shipped (through 0.1.0)

- Crossfade & gapless playback (settings + mpv)
- Equalizer presets
- Volume fade in/out
- AI Chat (Gemini)
- Imports & exports (Spotify / YouTube / JSON / M3U8)
- Stats dashboard
- Plugin system
- **Web companion** — bundled Phosphor Console UI (`--web` / `--web-only`)
- Immersive Windows mode (`--win32`)
- Favorites, shell completions, radio streams, live streams catalog
- Download pipeline (yt-dlp → youtubei → Invidious) + mpv IPC hardening
- History/Favorites save hardening (#23) + clearer error formatting
- Prefer local downloads (`preferLocalPlayback`, downloads index, Local badge)

## Active focus (post-0.1.0)

1. **Discovery** — Smart recommendations beyond YouTube’s built-in related tracks; playlist radio mode.
2. **Offline** — Prefer cached downloads when the network fails; deepen offline-only playback UX.
3. **Web v1.1** — Media Session API, favorites/live in the web nav, mini-player route.

## Toward 1.0.0

Reserve a major `1.0.0` for a documented support/install matrix and a stability signal—not for the next feature drop. Until then, ship `0.1.x` patches and `0.2.x` feature minors.

## How to contribute

1. Pick a high-priority item from `SUGGESTIONS.md`.
2. Update this roadmap with the files you expect to touch.
3. Implement, keep README/AGENTS pointers alive, and mark the initiative shipped when it lands.
