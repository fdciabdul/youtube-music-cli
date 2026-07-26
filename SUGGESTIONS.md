# Feature Suggestions & Improvements

This document tracks potential features, enhancements, and improvements for youtube-music-cli.

## 🎵 Playback Features

### High Priority

- Implemented **Gapless Playback** - Seamless transitions between tracks without audio gaps
- Implemented **Crossfade Support** - Smooth audio crossfading between songs (configurable duration)
- Implemented **Equalizer** - Built-in audio equalizer with preset profiles (Bass Boost, Vocal, Bright, Warm, Flat)
- Implemented **Listening Stats Dashboard** - Stats view showing top tracks, top artists, listening time, streaks, and 14-day timeline (`Shift+S`)
- Implemented **Volume Fade In/Out** - Gradually fade volume at track start and end for smooth transitions
- Implemented **A/B Loop** - Mark two points in a track and loop between them (practice/review mode)
- Implemented **Audio Normalization** - Optional ffmpeg `dynaudnorm` loudness normalization filter
- Implemented **Playback Speed Control** - Adjustable speed from 0.25x to 4.0x
- Implemented **Background Playback / Detach** - Continue audio playback after CLI exit; restore with `--continue`

### Medium Priority

- Implemented **Mini Player Mode** - Compact single-line player for use alongside other terminal work
- Planned **Multiple Audio Backends** - Support VLC and ffplay as alternatives to mpv
- Planned **Configurable Audio Output Device** - Select audio output device (useful for DACs, multi-monitor setups)
- Planned **Track Seek Bar** - Interactive seek via progress bar (not just +/-10s keystrokes)
- Planned **Offline Mode** - Cache downloaded tracks for playback without network access
  - Partial: downloads + `preferLocalPlayback` / local index already prefer on-disk files when available
- Planned **YouTube Video Support** - Play regular YouTube videos (not just music content)

### Low Priority

- Planned **Podcast Support** - Play YouTube podcasts with chapter markers and bookmarking
- Planned **Pipe/Audio Output Routing** - Route audio to specific output devices per-track or per-playlist

## 🔍 Discovery & Search

### High Priority

- Implemented **Advanced Search Filters** - Filter by artist, album, year, and duration
- Implemented **Search History** - Recent search queries with selection
- Implemented **Suggestions** - Related track suggestions based on currently playing track
- Planned **Smart Recommendations** - AI/ML-based track suggestions beyond YouTube's built-in algorithm

### Medium Priority

- Implemented **Genre Browsing** - Browse music by genre or mood
- Implemented **New Releases** - Dedicated view for newly released music
- Planned **Similar Artists** - Discover artists similar to the currently playing one
- Planned **Mood-Based Radio** - Start a radio station seeded by a mood or energy level selection
- Planned **AI Playlist Generation** - Generate a playlist from a natural-language prompt (e.g., "relaxing morning jazz")
- Planned **Playlist Radio Mode** - Endless radio-like playback generated from a playlist or track

## 📋 Playlist Management

### High Priority

- Implemented **Favorites** - Persistence for favorite tracks, toggle with `f`, view with `Shift+F`
- Implemented **Playlist Creation & Management** - Create, edit, and delete playlists within the TUI
- Implemented **Playlist Import** - Import playlists from Spotify and YouTube
- Implemented **Playlist Export** - Export playlists to JSON and M3U8 formats
- Planned **Playlist Sync** - Two-way sync with YouTube Music account playlists
- Planned **Smart Playlists** - Auto-generated playlists based on listening history and habits

### Medium Priority

- Planned **Collaborative Playlists** - Share playlists with others via a shareable link or file
- Planned **Playlist Folders** - Organize playlists into named folders/groups
- Planned **Duplicate Detection** - Warn when adding a track that already exists in a playlist
- Planned **Queue Snapshots** - Save and restore the current queue as a named snapshot
- Planned **Playlist Statistics** - Show stats per playlist (total duration, top artists, play counts)
- Planned **Track Bookmarks** - Bookmark a timestamp within a track to return to it later
- Planned **Queue Drag-Reorder** - Reorder queue items using keyboard navigation

## 🎨 User Interface

### High Priority

- Planned **Visualizer** - ASCII/ANSI audio visualizer rendered in the terminal
- Planned **Album Art** - Display album artwork using terminal graphics protocols (sixel, kitty)
- Planned **Split View** - Side-by-side panels for queue and search results

### Medium Priority

- Implemented **More Themes** - 8 built-in themes (Dark, Light, Midnight, Matrix, Dracula, Nord, Solarized, Catppuccin) plus custom theme support
- Implemented **Responsive Terminal Layout** - Adapts to terminal width with reduced padding on narrow terminals
- Implemented **Visual Shortcuts Bar** - Context-sensitive shortcut hints at bottom of screen
- Planned **Mouse Support** - Click and scroll interactions for modern terminal emulators
- Planned **Waveform Progress Bar** - Replace the plain progress bar with an ASCII waveform representation
- Planned **Configurable Layout** - User-adjustable panel sizes and component arrangement
- Planned **Terminal Title Integration** - Set terminal window title to currently playing track

### Low Priority

- Planned **Startup Screen** - Branded splash / first-run tips when launching the TUI

## 🔌 Integration & Plugins

### High Priority

- Implemented **Plugin System** - Full plugin lifecycle (install, enable, disable, update, remove)
- Planned **YouTube Music Account Login** - OAuth login for library access, premium streams, personal playlists (#18)
- Planned **Custom mpv Config Passthrough** - Allow extra mpv flags to be specified in config or via CLI

### Medium Priority

- Implemented **Discord Rich Presence** - Show current track on Discord status (built-in service + plugin)
- Implemented **Last.fm & ListenBrainz Scrobbling** - Scrobble tracks to Last.fm and/or ListenBrainz
- Implemented **Desktop Notifications** - Track change notifications via `node-notifier`
- Implemented **MPRIS (Linux Media Keys)** - D-Bus media control integration for Linux
- Implemented **AI Chat (Gemini)** - Natural language music discovery and playback control via LLM
- Implemented **Synchronized Lyrics** - LRCLIB integration with timed lyric display
- Implemented **Adblock Plugin** - Block ads and sponsored content via audio URL transformation
- Planned **OS Credential Manager Integration** - Store secrets in macOS Keychain, Windows Credential Manager, or libsecret
- Planned **Token Refresh** - Automatically refresh expired YouTube session tokens without requiring re-login
- Planned **Global Keyboard Shortcuts** - System-wide media key bindings (beyond MPRIS on Linux)
- Planned **tmux Status Line** - Show currently playing track in the tmux status bar
- Planned **Alfred/Raycast Extension** - macOS launcher integration for quick search and playback

## 🔧 Technical Improvements

### High Priority

- Implemented **Shell Completions** - Tab-completion scripts for Bash, Zsh, PowerShell, and Fish
- Implemented **Dependency Checker** - Auto-detect and offer to install mpv/yt-dlp via brew/scoop/choco
- Implemented **Version Check** - Auto-check npm registry for updates once per 24 hours
- Implemented **Streaming Quality** - Configurable audio quality (low/medium/high)
- Planned **Auto-Update Mechanism** - Built-in self-update command (`youtube-music-cli update`)

### Medium Priority

- Implemented **Web Server Mode** - HTTP+WebSocket server for remote control (`--web`, `--web-only`)
- Implemented **Web Server Auth** - Token-based authentication for web server
- Implemented **Config/Settings UI** - Full settings panel in TUI with all configuration options
- Implemented **Custom Keybindings** - Remappable keyboard shortcuts persisted to config
- Implemented **Sleep Timer** - Auto-pause after configurable duration (5/10/15/30/60 min presets)
- Implemented **Subtitle Support** - MPV subtitle rendering with toggle
- Implemented **Proxy Support** - HTTP proxy via mpv `--http-proxy` flag
- Implemented **Search Result Cache** - LRU cache with configurable TTL for API responses
- Planned **Configurable Cache TTL** - Set how long API responses and stream URLs are cached
- Planned **Multi-instance Sync** - Sync playback state across multiple terminal sessions
- Planned **Battery Saver Mode** - Reduce IPC polling frequency when running on battery power
- Planned **CLI Pipe Mode** - Accept track URLs or IDs via stdin for scripting use cases
- Planned **Better Error Messages** - Replace `[object Object]` errors with meaningful, actionable messages (#23)

### Low Priority

- Planned **Telemetry (Opt-in)** - Anonymous usage statistics to guide future development
- Planned **Performance Profiling** - Built-in performance monitoring and timing tools

## 📥 Downloads & Media

### High Priority

- Implemented **Track Downloads** - Download tracks as MP3 or M4A via ffmpeg with `Shift+D`
- Implemented **Cover Art Embedding** - Auto-embed album artwork in downloaded files
- Implemented **Metadata Tagging** - Auto-tag title, artist, album in downloaded files
- Implemented **Download Organization** - Organize downloads by artist/album directories

### Medium Priority

- Planned **Batch Downloads** - Download entire playlists or artist discographies in one action
- Planned **Download Queue** - Queue and manage multiple downloads with progress tracking
- Planned **Format Options** - Additional download formats (FLAC, OGG, OPUS)
- Planned **Download Resume** - Resume interrupted downloads

## 📱 Platform & Distribution

### High Priority

- Implemented **Homebrew Formula** - Easy installation on macOS via `brew install`
- Implemented **Windows MSIX Package** - MSIX installer for Windows via `bun run msix`
- Implemented **Standalone Executable** - Single binary distribution with embedded runtime

### Medium Priority

- Planned **AUR Package** - Arch Linux package for `yay`/`paru` users
- Planned **Snap/Flatpak** - Linux universal packages for broader distro support
- Planned **NixOS / Nix Flake** - Reproducible Nix package for NixOS and `nix profile install`
- Planned **GitHub Actions Release Pipeline** - Automated cross-platform binary builds on tag push

### Low Priority

- Planned **Mobile Companion App** - Remote control playback from a mobile device

## 🔐 Security & Privacy

### High Priority

- Planned **TOR Support** - Route all traffic through the TOR network for anonymity
- Planned **No Tracking Mode** - Prevent YouTube from logging listening history via account linkage

### Medium Priority

- Planned **Encrypted Config** - Encrypt stored preferences and session tokens at rest
- Planned **Audit Logging** - Structured log of all outbound network requests

### Low Priority

- Planned **OS Credential Manager Integration** - Store secrets in macOS Keychain, Windows Credential Manager, or libsecret

## 🐛 Known Issues

- Fixed ~~Pause restarts track from beginning instead of resuming~~ (#24)
- Fixed ~~Race condition in HistoryService/FavoritesService saves~~ (#23) — save mutex + unique temp files; clearer error formatting via `formatError`
- Fixed ~~mpv stderr errors on some Linux setups~~ (#22)
- Known **Search results sometimes don't include all available tracks** - YouTube API pagination limitations
- Known **Theme colors may not render correctly on some terminal emulators** - Limited 256-color support in some terminals
- Known **Volume control precision varies by audio backend** - mpv volume step granularity

## 💡 Community Requested

- **YouTube Music Account Login** (#18) - OAuth login for library access, premium streams, and personal playlists
- **Additional Lyrics Sources** (#9) - Pull lyrics from LRCLIB (implemented) and other sources like Musixmatch

---

## Contributing

Want to work on any of these? Check our [Contributing Guide](CONTRIBUTING.md) and feel free to:

1. Open an issue to discuss the feature
2. Submit a PR implementing the feature
3. Help with documentation or testing

## Priority Legend

- **High Priority**: Core functionality improvements, frequently requested
- **Medium Priority**: Nice-to-have features, moderate complexity
- **Low Priority**: Future considerations, complex implementations

## Status Legend

- **Implemented**: Feature is built and available in the current version
- **Planned**: Feature is proposed but not yet started
- **Open**: Bug is reported and not yet fixed
- **Fixed**: Bug has been resolved

## 🛠 Implementation Plan

- **[Stable] Crossfade & gapless playback** - Done. Configurable via settings with mpv `--gapless-audio` and `acrossfade` filter.
- **[Stable] Equalizer presets** - Done. Five presets (flat, bass_boost, vocal, bright, warm) applied as mpv audio filters.
- **[Stable] Volume fade in/out** - Done. Configurable fade duration in settings.
- **[Stable] AI Chat** - Done. Gemini-powered natural language music discovery and control.
- **[Stable] Imports & Exports** - Done. Spotify and YouTube playlist import, JSON and M3U8 export.
- **[Stable] Stats Dashboard** - Done. Top tracks/artists, listening time, streaks, 14-day timeline.
- **[Stable] Plugin System** - Done. Full lifecycle management with install, enable, disable, update, remove.
- **[Stable] Web frontend** - Bundled Phosphor Console companion UI (`web/` → `dist/web/`) with WebSocket sync; enabled via `--web` / `--web-only`.
- **[Stable] History/Favorites save hardening** - Done. Save mutex, unique temp files (#23), and `formatError` for user-facing messages.
- **[Next] Smart recommendations** - Extend suggestions with AI-powered or similarity-based discovery beyond YouTube's built-in algorithm.
- **[Next] Playlist radio mode** - Endless radio-like playback from a playlist seed.
- **[Next] Offline mode** - Cache downloaded tracks for playback without network.
