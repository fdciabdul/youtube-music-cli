# Fix Music Not Starting on Play (Issue #39) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the bug where `ymc play <url>` loads the track in the UI but audio never starts and the timer stays at 00:00 on Linux with mpv 0.37.0.

**Architecture:** Two-part fix: (1) Remove redundant `--idle=yes` flag from mpv args and (2) add a loading grace period to the `shouldApplyMpvPauseSync` function to suppress spurious pause events during the initial URL resolution window, preventing a feedback loop where the store dispatches PAUSE during buffering and calls `playerService.pause()` which sends a redundant `set_property pause true` to mpv.

**Tech Stack:** TypeScript, Bun, mpv IPC, React/Ink TUI

---

## Root Cause (Summary)

When mpv loads a YouTube URL via IPC `loadfile`, it briefly fires a `pause=true` property change during URL resolution/buffering. The store's event handler dispatches `PAUSE` (setting `isPlaying=false`), which triggers the play/pause effect to call `playerService.pause()`, sending a redundant `set_property pause true` to mpv. When mpv finishes loading and sends `pause=false`, the `RESUME` dispatch may not fully recover playback on older mpv versions (0.37.0). The existing `set_property pause false` fix (line 419) fires too early — before mpv has begun processing the file — and is effectively a no-op.

---

## Task 1: Add Loading Grace Period to `shouldApplyMpvPauseSync`

**Files:**

- Modify: `source/services/player/mpv-event-policy.ts:1-65`
- Test: `tests/mpv-event-policy.test.js`

**Step 1: Write the failing test**

Add a new test to `tests/mpv-event-policy.test.js` that verifies pause events are suppressed during the initial loading grace period:

```javascript
test('mpv-event-policy: suppresses pause during initial loading grace period', async () => {
	const {shouldApplyMpvPauseSync} =
		await import('../source/services/player/mpv-event-policy.ts');

	const now = 10_000;

	// Pause events within the loading grace period should be suppressed
	expect(
		shouldApplyMpvPauseSync({
			paused: true,
			eofTimestamp: 0,
			loadingStartedAt: now - 500, // 500ms into loading
			now,
		}),
	).toBe(false);

	// Pause events after the grace period should be applied
	expect(
		shouldApplyMpvPauseSync({
			paused: true,
			eofTimestamp: 0,
			loadingStartedAt: now - 5000, // 5s into loading (grace = 3s)
			now,
		}),
	).toBe(true);

	// Unpause events should always be applied regardless of grace period
	expect(
		shouldApplyMpvPauseSync({
			paused: false,
			eofTimestamp: 0,
			loadingStartedAt: now - 500,
			now,
		}),
	).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/mpv-event-policy.test.js -t "suppresses pause during initial loading"`
Expected: FAIL — `loadingStartedAt` property not recognized in `MpvPauseSyncInput`

**Step 3: Implement the loading grace period**

In `source/services/player/mpv-event-policy.ts`:

1. Add a new constant for the loading grace period (3 seconds):

```typescript
/** Suppress pause events during this window after play starts. */
export const LOADING_GRACE_MS = 3000;
```

2. Add `loadingStartedAt` to the `MpvPauseSyncInput` type:

```typescript
export type MpvPauseSyncInput = {
	paused: boolean;
	isAdvancing?: boolean;
	eofTimestamp: number;
	advanceGraceUntil?: number;
	isFetchingAutoplay?: boolean;
	waitingForAutoplayAtQueueEnd?: boolean;
	now?: number;
	loadingStartedAt?: number; // <-- NEW
};
```

3. Add the grace period check in `shouldApplyMpvPauseSync`, AFTER the `!input.paused` early return and BEFORE the `isAdvancing` check:

```typescript
// Suppress pause events during the initial loading window.
// When mpv resolves a YouTube URL via yt-dlp, it briefly fires pause=true
// during buffering. Suppressing this prevents the store from dispatching
// PAUSE and calling playerService.pause() which sends a redundant
// set_property pause true to mpv.
if (
	input.paused &&
	input.loadingStartedAt !== undefined &&
	input.loadingStartedAt > 0
) {
	const now = input.now ?? Date.now();
	if (now - input.loadingStartedAt < LOADING_GRACE_MS) {
		return false;
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/mpv-event-policy.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add source/services/player/mpv-event-policy.ts tests/mpv-event-policy.test.js
git commit -m "fix(player): suppress spurious pause events during initial loading window"
```

---

## Task 2: Remove Redundant `--idle=yes` from mpv Args

**Files:**

- Modify: `source/services/player/player.service.ts:78`
- Test: `tests/player-service-mpv-args.test.js`

**Step 1: Write the failing test**

Add a new test to `tests/player-service-mpv-args.test.js`:

```javascript
test('player-service-mpv-args: buildMpvArgs does not include --idle=yes (IPC implies idle)', async () => {
	const {buildMpvArgs} =
		await import('../source/services/player/player.service.ts');
	const args = buildMpvArgs(IPC_PATH, {
		volume: 55,
	});

	expect(args.includes('--idle=yes')).toBe(false);
	expect(args.includes('--input-ipc-server')).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/player-service-mpv-args.test.js -t "does not include --idle=yes"`
Expected: FAIL — `args.includes('--idle=yes')` returns `true`

**Step 3: Remove `--idle=yes` from `buildMpvArgs`**

In `source/services/player/player.service.ts`, line 78, remove the `'--idle=yes'` entry from the `mpvArgs` array. The `--input-ipc-server` flag already keeps mpv alive listening for IPC connections — the explicit `--idle=yes` is redundant and may cause mpv to enter a different idle state that doesn't properly handle IPC `loadfile` on older mpv versions.

**Step 4: Run tests to verify they pass**

Run: `bun test tests/player-service-mpv-args.test.js`
Expected: All tests PASS (existing tests don't assert `--idle=yes`)

**Step 5: Commit**

```bash
git add source/services/player/player.service.ts tests/player-service-mpv-args.test.js
git commit -m "fix(player): remove redundant --idle=yes flag (IPC implies idle)"
```

---

## Task 3: Wire `loadingStartedAt` Through the Player Store

**Files:**

- Modify: `source/stores/player.store.tsx:505-510, 612-632`

**Step 1: Add a `loadingStartedAt` ref to PlayerManager**

In `source/stores/player.store.tsx`, inside the `PlayerManager` component, add a ref to track when loading began:

```typescript
const loadingStartedAtRef = useRef<number>(0);
```

Place it near the other refs (around line 495-500, alongside `isPlayingRef`, `playbackModeRef`, etc.).

**Step 2: Set `loadingStartedAtRef` when loading starts**

In the track-change effect (around line 800, where `SET_LOADING` is dispatched with `loading: true`), set the ref:

```typescript
dispatch({category: 'SET_LOADING', loading: true});
loadingStartedAtRef.current = Date.now();
```

**Step 3: Reset `loadingStartedAtRef` when playback succeeds or on error**

After successful playback (line 872, `SET_LOADING: false`):

```typescript
dispatch({category: 'SET_LOADING', loading: false});
loadingStartedAtRef.current = 0; // <-- RESET
```

And in the error catch block (around line 940, after max retries):

```typescript
loadingStartedAtRef.current = 0; // <-- RESET
```

**Step 4: Pass `loadingStartedAt` to `shouldApplyMpvPauseSync`**

In the event handler's pause sync check (around line 614), update the call:

```typescript
if (
    !shouldApplyMpvPauseSync({
        paused: event.paused,
        eofTimestamp: eofTimestampRef.current,
        loadingStartedAt: loadingStartedAtRef.current, // <-- NEW
    })
) {
```

**Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (no type errors)

**Step 6: Commit**

```bash
git add source/stores/player.store.tsx
git commit -m "fix(player): wire loading grace period to pause sync in store"
```

---

## Task 4: Update Existing Tests and Verify Full Suite

**Files:**

- Verify: `tests/player-service-mpv-args.test.js`
- Verify: `tests/mpv-event-policy.test.js`

**Step 1: Run all player-related tests**

Run: `bun test tests/player-service-mpv-args.test.js tests/mpv-event-policy.test.js`
Expected: All PASS

**Step 2: Run full test suite**

Run: `bun run test`
Expected: All PASS

**Step 3: Run lint and typecheck**

Run: `bun run lint:fix && bun run typecheck`
Expected: All PASS

**Step 4: Run build**

Run: `bun run build`
Expected: Build succeeds

---

## Task 5: Final Verification and Cleanup

**Step 1: Review the changes**

Verify all changes are minimal and focused:

- `mpv-event-policy.ts`: Added `LOADING_GRACE_MS` constant, `loadingStartedAt` field, grace period check
- `player.service.ts`: Removed `'--idle=yes'` from mpv args array
- `player.store.tsx`: Added `loadingStartedAtRef`, wired it to loading state and pause sync
- `mpv-event-policy.test.js`: Added test for loading grace period
- `player-service-mpv-args.test.js`: Added test for no `--idle=yes`

**Step 2: Commit all changes**

```bash
git add -A
git commit -m "fix(player): resolve music not starting on play (issue #39)

- Remove redundant --idle=yes flag (IPC implies idle)
- Add 3s loading grace period to suppress spurious pause events during URL resolution
- Wire loadingStartedAt through store to pause sync logic
- Add tests for new behavior"
```

---

## Risk Assessment

| Change               | Risk                                                 | Mitigation                                                |
| -------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| Remove `--idle=yes`  | Low — `--input-ipc-server` implies idle in mpv 0.35+ | Verify mpv stays alive with IPC connection                |
| Loading grace period | Low — only suppresses pause for 3s after play starts | Unpause events always pass through; grace is conservative |
| Store ref wiring     | Low — purely additive, no existing behavior changed  | Full test suite + typecheck                               |

## Testing Notes

- **Cannot test mpv IPC behavior in unit tests** — the fix is designed around observable timing issues
- **Manual testing required:** Run `ymc play "https://www.youtube.com/watch?v=dQw4w9WgXcQ"` on Linux with mpv 0.37.0
- **Regression check:** Verify gapless playback, pause/resume, volume changes, and track advancement still work
- **Ask issue reporter** to test on their Linux Mint 22.3 / mpv 0.37.0 environment
