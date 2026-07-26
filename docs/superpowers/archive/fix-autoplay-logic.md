# Fix Autoplay Not Working

## Root Cause Analysis

Based on the code analysis and user report, the autoplay mechanism fails because of a race condition and logic gap between the "track completion" handler, the "EOF" handler, and the "Autoplay fetcher".

1.  **Race Condition in `NEXT` Dispatch**:
    - When `event.eof` fires, it calls `next()`, which dispatches `NEXT`.
    - If the queue is at the end (`queuePosition === queue.length - 1`), `NEXT` **does nothing** (returns state unchanged).
    - The player remains on the current track, but `mpv` has finished playing (idle state).

2.  **State Mismatch**:
    - `event.paused` (idle) from mpv is suppressed for 2 seconds after EOF to prevent overwriting `isPlaying: true` (which assumed `NEXT` would start a new track).
    - However, since `NEXT` failed (queue empty), the state remains `isPlaying: true` but the player is actually stopped.
    - The `TICK` loop continues until `progress >= duration`.
    - When `progress >= duration`, the `TICK` reducer sets `isPlaying: false`.

3.  **Autoplay Fetcher Logic Gap**:
    - The Autoplay fetcher runs when `tracksAhead <= 5`. It fetches suggestions and adds them to the queue.
    - It has a specific check to resume playback:
      ```typescript
      if (
          state.queuePosition >= state.queue.length - 1 &&
          state.progress >= state.duration - 2 &&
          !state.isPlaying // <--- THIS CHECK IS PROBLEMATIC
      )
      ```
    - If the fetch finishes **before** `progress >= duration` sets `isPlaying: false`, this check fails because `state.isPlaying` is still true (due to the suppression logic).
    - If the fetch finishes **after**, it might work, but timing is unreliable.

4.  **Track Completion Handler Gap**:
    - The `handle track completion` effect runs when `state.duration` or `state.queue.length` changes.
    - It checks `hasNextTrack`.
    - If tracks are added _after_ the song ends, `hasNextTrack` becomes true.
    - It _should_ dispatch `NEXT`.
    - However, it also checks `autoAdvanceRef.current`. If it was already set to `true` (e.g., by the first failed attempt at EOF), it might skip?
    - Actually, `autoAdvanceRef` is reset if `duration <= 0`.
    - But the main issue is likely that `event.eof` fired `next()`, which failed, and then nothing retries `next()` when the queue actually grows.

## Proposed Fix

1.  **Force `NEXT` when Queue Grows**:
    - Modify the "Smart autoplay" effect to trigger `NEXT` if we are at the end of the queue and playback has stopped (or is about to stop), **regardless of `isPlaying` state** if we know we are stuck at the end.
    - Actually, simpler: If `queue.length` increases and we were stuck at the last track with `progress` near end, we should auto-advance.

2.  **Improve `NEXT` reducer**:
    - If `NEXT` is called at the end of the queue, it currently does nothing.
    - This is fine, but the caller needs to know or retry.

3.  **Refine Autoplay Resume Logic**:
    - In the `musicService.getSuggestions(...).then(...)` block:
    - Remove `!state.isPlaying` check or make it more robust.
    - Check if `currentTrack.videoId` matches the one we fetched for.
    - Check if `queuePosition` is still the last one (before the new adds).

    Updated logic for Autoplay callback:

    ```typescript
    // If we were at the end of the queue and the track finished (or is nearly finished),
    // and we just added new tracks, we should advance immediately.
    const isAtEndOfQueue =
    	state.queuePosition >= state.queue.length - suggestions.length - 1;
    const isTrackFinished = state.progress >= state.duration - 5; // 5s buffer

    if (isAtEndOfQueue && isTrackFinished) {
    	dispatch({category: 'NEXT'});
    }
    ```

4.  **Fix "Track Completion" Effect**:
    - Ensure it re-evaluates when `queue.length` changes.
    - The current effect has `state.queue.length` in dependencies.
    - It checks `hasNextTrack`.
    - It checks `autoAdvanceRef.current`.
    - We need to ensure `autoAdvanceRef.current` doesn't block valid re-tries when queue grows.
    - We should reset `autoAdvanceRef.current` if `queue.length` changes?
    - Or just rely on the Autoplay fetcher to trigger the `NEXT` explicitly.

## Plan

1.  Modify `source/stores/player.store.tsx`:
    - Update the "Smart autoplay" `then` block to be more aggressive about triggering `NEXT`.
    - Specifically, remove `!state.isPlaying` constraint if we are at the end of the queue and the track is effectively done.
    - Add a fallback: If `queue.length` changes and we are effectively "stuck" at the end of the previous list, trigger `NEXT`.
