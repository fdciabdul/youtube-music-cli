---
goal: Live Streams curated discovery view for yt-dlp/mpv livestreams
version: 1.0
date_created: 2026-07-25
last_updated: 2026-07-25
owner: involvex
status: 'Completed'
tags: [feature, live-streams, immersive, ink]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Add a **Live Streams** view (Ink + immersive) for discovering coder/vibe livestreams playable via the existing mpv + yt-dlp `PLAY_STREAM` path.

## 1. Requirements & Constraints

- **REQ-001**: New `VIEW.LIVE_STREAMS` separate from Radio Streams
- **REQ-002**: Curated static catalog; list can grow over time
- **REQ-003**: Play via `toRadioStation` → `playStream` / `PLAY_STREAM`
- **REQ-004**: Ink shortcut `Shift+V`; immersive `v`
- **CON-001**: Do not replace Radio Browser radio view
- **PAT-001**: Mirror RadioStreamsLayout / radio-overlay patterns

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Data + mapping + tests

| Task     | Description                                       | Completed | Date       |
| -------- | ------------------------------------------------- | --------- | ---------- |
| TASK-001 | LiveStreamEntry types + builtin catalog + service | ✅        | 2026-07-25 |
| TASK-002 | AVA tests for catalog and overlay                 | ✅        | 2026-07-25 |

### Implementation Phase 2

- GOAL-002: Ink UI

| Task     | Description                                   | Completed | Date       |
| -------- | --------------------------------------------- | --------- | ---------- |
| TASK-003 | Constants, MainLayout, LiveStreamsLayout/List | ✅        | 2026-07-25 |
| TASK-004 | Home quick link + Help                        | ✅        | 2026-07-25 |

### Implementation Phase 3

- GOAL-003: Immersive + verify

| Task     | Description                                   | Completed | Date       |
| -------- | --------------------------------------------- | --------- | ---------- |
| TASK-005 | live-streams-overlay + engine wiring          | ✅        | 2026-07-25 |
| TASK-006 | Smoke URLs + format/lint/typecheck/test/build | ✅        | 2026-07-25 |

## 3. Alternatives

- **ALT-001**: Extend Radio Streams with a Coder category — rejected in favor of a dedicated Live Streams page
- **ALT-002**: Resolve `@channel/live` via youtubei.js first — deferred; pass URLs to yt-dlp/mpv directly

## 4. Dependencies

- **DEP-001**: Existing `PlayerService.play` + stream playback mode
- **DEP-002**: yt-dlp + mpv installed on user machine

## 5. Files

- **FILE-001**: `source/data/builtin-live-streams.ts`
- **FILE-002**: `source/services/live-streams/live-streams.service.ts`
- **FILE-003**: `source/components/live-streams/LiveStreamsList.tsx`
- **FILE-004**: `source/immersive/ui/live-streams-overlay.ts`

## 6. Testing

- **TEST-001**: Catalog unique ids and http(s) URLs
- **TEST-002**: `toRadioStation` sets `source: 'live-catalog'`
- **TEST-003**: Overlay open/close/selection/play action

## 7. Risks & Assumptions

- **RISK-001**: Some page URLs (e.g. anomaly.fm) may need direct stream mounts if yt-dlp cannot extract
- **ASSUMPTION-001**: YouTube `@handle/live` URLs resolve via yt-dlp when the channel is live

## 8. Related Specifications / Further Reading

- [docs/superpowers/plans/2026-07-25-live-streams.md](../docs/superpowers/plans/2026-07-25-live-streams.md)
- Existing Radio Streams: `source/components/layouts/RadioStreamsLayout.tsx`
