# Quick Wins + High Priority Initiatives

> Created 2026-08-26. QW1–QW3 implemented 2026-08-26. Source of truth for priorities: `SUGGESTIONS.md` (Implementation Plan section).

**Goal:** Ship three low-effort polish items (quick wins), then tackle high-priority initiatives in value/effort order.

## Quick Wins (one PR) — ✅ Implemented 2026-08-26

| #   | Item                   | Closes                                     | Status                                                                     |
| --- | ---------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| QW1 | TUI terminal title     | Partial **Terminal Title Integration**     | Done (`source/utils/terminal-title.ts` + `useTerminalTitle` in MainLayout) |
| QW2 | Configurable cache TTL | Partial **Configurable Cache TTL**         | Done (`cacheTtlMinutes`/`cacheMaxEntries`)                                 |
| QW3 | Sleep timer fade-out   | Enhancement to implemented **Sleep Timer** | Done (30s fade via injected hooks, TUI + immersive)                        |

Note: QW1 wired via `source/hooks/useTerminalTitle.ts` called from `MainLayout.tsx`
(headless mode unaffected); sanitizes ANSI/control chars from metadata before
writing the OSC 0 title sequence.

### QW1: TUI Terminal Title

- Files: new `source/hooks/useTerminalTitle.ts`, wired in `source/app.tsx`
- Behavior: on `currentTrack` / playback state change, write
  `\x1b]0;{title} · {artist} {▶|⏸} · ymc\x07` to stdout; restore default title on unmount.
- Reuse the pattern from `source/immersive/native/console.ts` (`\x1B]0;…\x07`).
- Test: bun:test asserting the escape sequence is written on state change.

### QW2: Configurable Cache TTL

- Files: `source/services/cache/cache.service.ts`, `source/services/config/config.service.ts`, settings panels (TUI + immersive).
- Add config keys `cacheTtlMinutes` (default 5) and `cacheMaxEntries` (default 100);
  wire into the shared search/suggestions caches created at the bottom of cache.service.ts.
- Test: extend/add `tests/cache-config.test.js`.

### QW3: Sleep Timer Fade-Out

- Files: `source/services/sleep-timer/sleep-timer.service.ts` (+ call sites that invoke `start()`).
- Behavior: on expiry, ramp volume → 0 over ~30s via `PlayerService.setVolume`,
  pause, then restore prior volume. Keep `onExpire` contract intact.
- Test: bun:test with fake timers verifying fade steps and final pause.

## High Priority Initiatives (ordered by value ÷ effort)

1. **Web v1.1 — Media Session API + mini-player route**
   - `web/src/hooks/use-media-session.ts`: map WebSocket state → `navigator.mediaSession`
     metadata/artwork; action handlers send existing WS play/pause/next/prev/seek messages.
   - Add compact `/mini` route in web shell.
2. **Auto-update mechanism (`ymc update`)**
   - New CLI subcommand reusing `source/services/version-check/version-check.service.ts`;
     detect install channel (standalone/npm/brew/scoop), fetch GitHub Release asset, atomic replace.
3. **Smart Recommendations v2**
   - Score candidates from `history.service` + `stats.service` (frequency/recency, artist diversity cap);
     feed the existing Suggestions view.
4. **YouTube Music Account Login (#18)**
   - youtubei.js OAuth session persisted under `~/.youtube-music-cli/auth.json`;
     library access, token refresh, logout. Unlocks Playlist Sync + Smart Playlists.

## Agent Prompt Scaffold (for delegated build tasks)

> Work in `D:\repos\involvex\youtube-music-cli`. Read `AGENTS.md` first.
> Task: [task spec above]. Follow repo style strictly: ESM imports with `.ts` extensions,
> strict TypeScript, explicit types, all Ink text in `<Text>`, no comments unless necessary,
> SCREAMING_SNAKE_CASE constants. Write/extend bun:test coverage in `tests/*.test.js`.
> Before finishing run: `bun run format`, `bun run lint:fix`, `bun run typecheck`, and the
> relevant `bun test tests/<file>.test.js --timeout=60s`. Do NOT commit.
> Report files changed + test results.

Tester agent prompt:

> Run `bun test --timeout=60s`, `bun run typecheck`, `bun run lint` in the repo root;
> report any failure with file:line and a minimal repro. Read-only.

## Verification Gate

- format + lint + typecheck + full `bun test` green before declaring done.
- SUGGESTIONS.md statuses must stay grep-verifiable against code.
