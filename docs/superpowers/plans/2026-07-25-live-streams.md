# Live Streams View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a curated Live Streams discovery view that plays internet livestream URLs through mpv + yt-dlp via existing `PLAY_STREAM`.

**Architecture:** New `VIEW.LIVE_STREAMS` parallel to Radio Streams. Static catalog maps to `RadioStation` with `source: 'live-catalog'`. Ink list + immersive overlay.

**Tech Stack:** Ink, immersive overlays, PlayerService, AVA, Bun.

## Global Constraints

- Reuse `playStream` / `PLAY_STREAM`; do not invent a second player path
- Catalog is static data for v1; enhance iteratively
- Shortcut: Ink `Shift+V`, immersive `v`
- Radio Streams (`Shift+I` / `i`) stays Radio Browser + regional builtins

---

### Task 1: Data + play mapping

**Files:**

- Create: `source/types/live-stream.types.ts`
- Create: `source/data/builtin-live-streams.ts`
- Create: `source/services/live-streams/live-streams.service.ts`
- Modify: `source/types/radio-station.types.ts`
- Test: `tests/live-streams.test.js`

- [x] Types, catalog, `toRadioStation`, AVA tests

### Task 2: Ink Live Streams view

**Files:**

- Modify: `source/utils/constants.ts`
- Modify: `source/components/layouts/MainLayout.tsx`
- Create: `source/components/layouts/LiveStreamsLayout.tsx`
- Create: `source/components/live-streams/LiveStreamsList.tsx`
- Modify: `source/components/layouts/HomeLayout.tsx`
- Modify: `source/components/common/Help.tsx`

- [x] Wire view, shortcut, list UI, Home + Help

### Task 3: Immersive overlay

**Files:**

- Create: `source/immersive/ui/live-streams-overlay.ts`
- Modify: `source/immersive/immersive-engine.ts`
- Modify: `source/immersive/ui/layout.ts`

- [x] Overlay + key `v` + footer shortcuts

### Task 4: Verify

- [x] Smoke-check yt-dlp URLs; fix broken entries; format/lint/typecheck/test/build
