# Fix Player Stuck at "Loading..." and State Save Failures

## Problem Analysis

1.  **Player Stuck at "Loading..."**:
    - The `PlayerService.play()` method returns a `Promise` that only resolves when the `mpv` process **exits** (i.e., track finishes).
    - `PlayerManager` awaits this promise inside `loadAndPlayTrack`.
    - As a result, `dispatch({category: 'SET_LOADING', loading: false})` is only called when the track finishes, keeping the UI in a "Loading..." state during the entire playback.

2.  **Failed to Save Player State**:
    - `PlayerStateService.savePlayerState` performs a sequence of `write temp` -> `delete original` -> `rename temp to original`.
    - This sequence is not atomic and lacks locking.
    - If `savePlayerState` is called rapidly (e.g., due to progress updates or other state changes), race conditions occur where one operation deletes the file while another tries to rename, leading to `ENOENT` or permission errors.
    - `(node:46348) MaxPerformanceEntryBufferExceededWarning` suggests a tight loop or excessive operations, likely exacerbated by these failures and retries (or just rapid `progress` updates triggering rapid saves if debounce logic is bypassed or ineffective).

3.  **Autoplay Issues**:
    - Likely a side effect of the "Loading..." state or internal state inconsistencies caused by the blocking `play()` call.

## Proposed Changes

### 1. `source/services/player/player.service.ts`

- Modify `play()` method to resolve the Promise as soon as:
  - The `mpv` process is successfully spawned.
  - IPC connection is established (or a short timeout passes).
- Ensure that immediate process exits (errors) still reject the promise.
- This will allow `PlayerManager` to proceed to `SET_LOADING(false)` immediately after playback starts.

### 2. `source/services/player-state/player-state.service.ts`

- Implement a **Mutex/Lock** mechanism in `savePlayerState` to ensure only one save operation is in flight at a time.
- Wait for the previous save to complete before starting a new one.
- This prevents race conditions during the `delete` -> `rename` sequence on Windows.

## Verification Plan

1.  **Test "Loading..." State**:
    - Run the player and play a track.
    - Verify that "Loading..." disappears shortly after playback starts.
2.  **Test State Saving**:
    - Monitor logs for "Failed to save player state".
    - Verify `player-state.json` is updated correctly without errors.
3.  **Test Autoplay**:
    - Play a track with `autoplay: true`.
    - Skip to the end of the track.
    - Verify the next track plays automatically.
