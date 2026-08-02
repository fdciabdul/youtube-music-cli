# Implementation Plan: Mood-Based Radio & AI Playlist Generation

## Overview

Two related features that extend the discovery/radio surface:

1. **Mood-Based Radio** — predefined mood presets (relaxing, energetic, focus, chill, workout, sleep, party) that seed radio playback via the existing `RadioService` + `getSuggestions` pipeline.
2. **AI Playlist Generation** — a new LLM tool (`generate_playlist`) that takes a natural-language mood/genre/artist description, searches for matching tracks, curates them, and either creates a playlist or queues them for playback.

---

## Feature 1: Mood-Based Radio

### 1.1 Type definitions

**File:** `source/types/radio.types.ts` (modify)

- Add `'mood'` to `RadioSeedType`:
  ```ts
  export type RadioSeedType =
  	'track' | 'artist' | 'playlist' | 'genre' | 'mood';
  ```
- Add a `MoodPreset` type (new file `source/types/mood.types.ts`):
  ```ts
  export interface MoodPreset {
  	id: string;
  	name: string;
  	description: string;
  	seeds: RadioSeed[]; // track/artist/genre seeds that represent this mood
  }
  ```
- Export from `source/types/index.ts` (or wherever types are re-exported).

### 1.2 Mood catalog data

**File:** `source/data/builtin-moods.ts` (new)

- Export `BUILTIN_MOODS: readonly MoodPreset[]` as `as const`.
- Define 8–12 presets, each with 2–4 seeds:
  - `relaxing` → seeds: genre "ambient", artist "Brian Eno", track seed from a known chill track
  - `energetic` → seeds: genre "electronic", artist "Daft Punk", track seed from an upbeat song
  - `focus` → seeds: genre "lo-fi", artist "Nujabes", track seed from a study track
  - `chill` → seeds: genre "chillout", artist "Tycho", track seed from a chill track
  - `workout` → seeds: genre "workout", artist "The Prodigy", track seed from an intense track
  - `sleep` → seeds: genre "ambient", artist "Stars of the Lid", track seed from a sleep track
  - `party` → seeds: genre "dance", artist "Daft Punk", track seed from a party track
  - `sad` → seeds: genre "indie", artist "Radiohead", track seed from a melancholic track
- Each seed uses the existing `RadioSeed` shape (`{type, id, name}`).
- For `type: 'track'` seeds, use a known videoId of a representative track.
- For `type: 'genre'` seeds, use a genre browseId from `getGenrePlaylists`.
- For `type: 'artist'` seeds, use the artist name as the id (matches `RadioService.fetchBySeedType('artist', id)` which calls `musicService.search(id, {type: 'songs'})`).

### 1.3 Extend RadioService

**File:** `source/services/radio/radio.service.ts` (modify)

- Add `case 'mood':` to `fetchBySeedType` switch (line ~73 default).
- Implementation:
  ```ts
  case 'mood': {
      // id is the mood id; look up the preset from BUILTIN_MOODS
      const mood = getMoodById(id);
      if (!mood) return [];
      // Fetch tracks from each seed in parallel, dedupe across all
      const allTracks: Track[] = [];
      for (const seed of mood.seeds) {
          const tracks = await this.fetchBySeedType(seed.type, seed.id);
          allTracks.push(...tracks);
      }
      return this.deduplicate(allTracks).slice(0, 50);
  }
  ```
- Add a helper `getMoodById(id: string): MoodPreset | undefined` that searches `BUILTIN_MOODS`.
- Import `BUILTIN_MOODS` from `../../data/builtin-moods.ts`.

### 1.4 Extend player store radio support

**File:** `source/stores/player.store.tsx` (modify)

- The existing `startRadio` (line ~1255) already accepts `RadioSeed` and calls `musicService.getSuggestions(seed.id)`.
- For mood seeds, `startRadio` should work as-is since `RadioSeed.type = 'mood'` and `RadioService.fetchBySeedType('mood', id)` will handle it.
- Verify that `startRadio` dispatches `START_RADIO` → sets `radioSeed`, `radioIsActive: true`, `playbackMode: 'youtube'`, and seeds the queue via `RadioService.fetchTracksForSeed`.

### 1.5 Mood Radio view

**Option A (simpler): Reuse `RadioStreamsLayout`** — add a mood section to the existing radio streams list.

**Option B (cleaner): New `MoodRadioLayout`** — a dedicated view that shows mood presets as selectable rows, each seeding a radio.

**Chosen approach: Option B** — a new `MoodRadioLayout` component, because mood radio is conceptually different from genre/artist radio and deserves its own UI surface.

**File:** `source/components/layouts/MoodRadioLayout.tsx` (new)

- Model after `RadioStreamsLayout.tsx` (simple: `NowPlaying` + `PlayerControls` + mood list).
- Render a list of `BUILTIN_MOODS` as selectable rows.
- Each row shows: mood name, description, seed count.
- On selection: call `startRadio({type: 'mood', id: mood.id, name: mood.name})` via `usePlayer().startRadio()`.
- Keybinding: `KEYBINDINGS.SELECT` (Enter) to start the selected mood radio.
- Navigation: UP/DOWN keys, ESC to go back.

### 1.6 Wire into MainLayout

**File:** `source/utils/constants.ts` (modify)

- Add to VIEW: `MOOD_RADIO: 'mood_radio'`
- Add to KEYBINDINGS: `MOOD_RADIO: ['shift+m']` (or reuse an available key)

**File:** `source/components/layouts/MainLayout.tsx` (modify)

- Add `goToMoodRadio` callback.
- Register `useKeyBinding(KEYBINDINGS.MOOD_RADIO, goToMoodRadio)`.
- Add `case 'mood_radio': return <MoodRadioLayout key="mood_radio" />` in the switch.

**File:** `source/components/layouts/HomeLayout.tsx` (modify)

- Add "Mood Radio" entry to `homeMenuItems`.

### 1.7 Wire into immersive mode

**File:** `source/immersive/ui/mood-radio-overlay.ts` (new)

- Follow the pattern of `live-streams-overlay.ts` or `radio-overlay.ts`.
- State: `MoodRadioOverlayState` with `active`, `selectedIndex`, `moods`, `status`.
- Render: list of mood presets.
- Input: UP/DOWN to navigate, Enter to start, Esc to close.

**File:** `source/immersive/immersive-engine.ts` (modify)

- Import the new overlay.
- Add `private moodRadioOverlay: MoodRadioOverlayState`.
- Register render, input route, and top-level key case (`m` key or similar).

### 1.8 Immersive settings (if needed)

- No new settings required for mood radio itself. The mood presets are data-driven.

---

## Feature 2: AI Playlist Generation

### 2.1 New LLM tool: `generate_playlist`

**File:** `source/services/llm/tool-definitions.ts` (modify)

- Add a new tool definition after `start_radio`:
  ```ts
  {
      name: 'generate_playlist',
      description: 'Generate a playlist of tracks matching a mood, genre, or description. Searches YouTube Music for tracks and adds them to a new playlist or the play queue.',
      parameters: {
          type: 'object',
          properties: {
              description: {
                  type: 'string',
                  description: 'Natural language description of the desired playlist (e.g., "relaxing morning jazz", "energetic workout tracks", "sad indie songs for raining")',
              },
              trackCount: {
                  type: 'number',
                  description: 'Number of tracks to include (default 20, max 50)',
              },
              mode: {
                  type: 'string',
                  description: 'What to do with the generated playlist',
                  enum: ['queue', 'playlist', 'both'],
              },
          },
          required: ['description'],
      },
  },
  ```

### 2.2 Implement the tool executor

**File:** `source/services/llm/tool-executor.ts` (modify)

- Add `case 'generate_playlist':` to the switch.
- Implementation:
  ```ts
  case 'generate_playlist': {
      const description = String(args['description'] || '');
      const trackCount = Math.min(50, Math.max(1, Number(args['trackCount']) || 20));
      const mode = String(args['mode'] || 'queue') as 'queue' | 'playlist' | 'both';

      // Step 1: Search for tracks matching the description
      const searchResults = await musicService.search(description, {type: 'songs', limit: trackCount * 2});
      const tracks = searchResults.results
          .filter(r => r.type === 'song')
          .map(r => r.data as Track)
          .slice(0, trackCount);

      if (tracks.length === 0) {
          return {success: false, error: 'No tracks found matching that description'};
      }

      // Step 2: If mode is 'playlist' or 'both', create a playlist
      let playlistName = `AI: ${description}`;
      let playlistId: string | null = null;

      if (mode === 'playlist' || mode === 'both') {
          const playlists = configService.get('playlists') || [];
          playlistId = `ai-${Date.now()}`;
          playlists.push({
              playlistId,
              name: playlistName,
              tracks: tracks.map(t => ({videoId: t.videoId, title: t.title, artists: t.artists})),
              createdAt: new Date().toISOString(),
          });
          configService.set('playlists', playlists);
      }

      // Step 3: If mode is 'queue' or 'both', add tracks to queue
      if (mode === 'queue' || mode === 'both') {
          // Return track IDs so the chat store can dispatch to the player
          // (see section 2.3 below for the bridge)
      }

      return {
          success: true,
          data: {
              playlistName,
              trackCount: tracks.length,
              tracks: tracks.map(t => ({id: t.videoId, title: t.title, artist: t.artists[0]?.name})),
              playlistId,
          },
      };
  }
  ```

### 2.3 Bridge LLM tools → player store dispatch

**Problem:** The tool executor is a service-layer singleton and cannot call `usePlayer()` hooks directly. The `add_to_queue` tool is currently a no-op stub.

**Solution:** Pass a `dispatchAction` callback into the tool executor from the chat store, where `usePlayer()` is available.

**File:** `source/services/llm/tool-executor.ts` (modify)

- Refactor `executeTool` to accept an optional `context` parameter:
  ```ts
  export interface ToolExecutorContext {
  	addToQueue?: (tracks: Track[]) => void;
  	playTracks?: (tracks: Track[]) => void;
  	createPlaylist?: (name: string, tracks: Track[]) => void;
  	getQueue?: () => Track[];
  }
  ```
- Update `executeTool(toolName, args, context?)` to use these callbacks where available.
- In `add_to_queue` case: if `context.addToQueue` is provided, call it with the resolved `Track[]` objects (fetch full track info via `musicService.getTrack(videoId)` for each ID).
- In `start_radio` case: if `context.playTracks` is provided, use it instead of returning a stub message.

**File:** `source/stores/chat.store.tsx` (modify)

- In `sendMessage`, pass a context object to `executeTool`:
  ```ts
  const context: ToolExecutorContext = {
  	addToQueue: tracks => {
  		tracks.forEach(t => playerDispatch({category: 'ADD_TO_QUEUE', track: t}));
  	},
  	playTracks: tracks => {
  		if (tracks.length > 0) {
  			playerDispatch({category: 'SET_QUEUE', queue: tracks});
  			playerDispatch({category: 'PLAY', track: tracks[0]});
  		}
  	},
  	createPlaylist: (name, tracks) => {
  		// Use the existing createPlaylist utility from usePlaylist
  	},
  	getQueue: () => {
  		// Read from player store state
  	},
  };
  ```
- The chat store has access to `playerDispatch` via `usePlayer()` (it's a React component).

### 2.4 Improve `create_playlist` tool

**File:** `source/services/llm/tool-executor.ts` (modify)

- The existing `create_playlist` tool stores stub tracks (`title: 'Unknown'`). Fix it to fetch full track metadata:
  ```ts
  case 'create_playlist': {
      const name = String(args['name'] || 'My Playlist');
      const trackIds = (args['trackIds'] as string[]) || [];
      // Fetch full track info for each ID
      const tracks: Track[] = [];
      for (const id of trackIds) {
          const track = await musicService.getTrack(id);
          if (track) tracks.push(track);
      }
      // Persist to config
      const playlists = configService.get('playlists') || [];
      playlists.push({
          playlistId: `local-${Date.now()}`,
          name,
          tracks: tracks.map(t => ({videoId: t.videoId, title: t.title, artists: t.artists})),
      });
      configService.set('playlists', playlists);
      return {success: true, data: {playlistId: playlists[playlists.length - 1].playlistId, name, trackCount: tracks.length}};
  }
  ```

### 2.5 Improve `get_queue` tool

**File:** `source/services/llm/tool-executor.ts` (modify)

- Make `get_queue` return real queue data by accepting a `getQueue` callback in the context (see 2.3).

### 2.6 Update system prompt

**File:** `source/services/llm/llm.service.ts` (modify)

- Update the system prompt to mention the new `generate_playlist` tool:
  ```
  When user asks to create a playlist from a mood or description, use generate_playlist.
  When user wants to add tracks to the queue, use add_to_queue (now functional).
  ```

### 2.7 Wire `generate_playlist` into the chat UI

**File:** `source/components/ai/AIChatView.tsx` (modify, minimal)

- The chat UI already renders tool call results as part of the message list (via `toolCalls` on `ChatMessage`).
- Add display of `generate_playlist` results showing the playlist name and track count.
- The existing `sendMessage` flow already handles tool calls — the `generate_playlist` tool will return data that gets logged and the text response will describe the result.

### 2.8 Use `VIEW.AI_RECOMMENDATIONS` for playlist generation

**File:** `source/components/layouts/MainLayout.tsx` (modify)

- The `VIEW.AI_RECOMMENDATIONS` view is already defined but has no component (falls through to `PlayerLayout`).
- Create a new `AIPlaylistView` component (or reuse `AIChatView` with a different system prompt).
- Add `case 'ai_recommendations': return <AIPlaylistView key="ai_recommendations" />` to the MainLayout switch.
- Register `KEYBINDINGS.AI_RECOMMENDATIONS` (`Shift+A`) in `main.tsx` (currently unbound).

**File:** `source/components/ai/AIPlaylistView.tsx` (new)

- Simple component: similar to `AIChatView` but with a preset system prompt focused on playlist generation.
- Or: a tabbed view that switches between "Chat" (existing AIChatView) and "Playlist Generator" (new view).

### 2.9 Update chat store context

**File:** `source/stores/chat.store.tsx` (modify)

- Wire real `currentTrack`, `queueLength`, and `playlists` into the `ChatContext` passed to the LLM (currently hardcoded to zeros at lines 108–112).
- Use `usePlayer()` to get `state.currentTrack` and `state.queue.length`.
- Use `configService.get('playlists')` for playlist list.

---

## Files to Create

| File                                            | Purpose                             |
| ----------------------------------------------- | ----------------------------------- |
| `source/types/mood.types.ts`                    | `MoodPreset` interface              |
| `source/data/builtin-moods.ts`                  | Curated mood → seed mappings        |
| `source/components/layouts/MoodRadioLayout.tsx` | Ink TUI mood radio view             |
| `source/components/ai/AIPlaylistView.tsx`       | Ink TUI AI playlist generation view |
| `source/immersive/ui/mood-radio-overlay.ts`     | Immersive mood radio overlay        |

## Files to Modify

| File                                          | Change                                                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `source/types/radio.types.ts`                 | Add `'mood'` to `RadioSeedType`                                                                                               |
| `source/services/radio/radio.service.ts`      | Add `case 'mood':` to `fetchBySeedType`                                                                                       |
| `source/utils/constants.ts`                   | Add `MOOD_RADIO` to VIEW and KEYBINDINGS                                                                                      |
| `source/components/layouts/MainLayout.tsx`    | Add mood radio view routing + keybinding                                                                                      |
| `source/components/layouts/HomeLayout.tsx`    | Add Mood Radio entry to home menu                                                                                             |
| `source/components/settings/Settings.tsx`     | (Optional) Add mood radio settings if user-customizable moods are added later                                                 |
| `source/services/llm/tool-definitions.ts`     | Add `generate_playlist` tool                                                                                                  |
| `source/services/llm/tool-executor.ts`        | Implement `generate_playlist`, fix `add_to_queue`, improve `create_playlist`, improve `get_queue`, accept `context` parameter |
| `source/services/llm/llm.service.ts`          | Update system prompt to mention `generate_playlist`                                                                           |
| `source/stores/chat.store.tsx`                | Pass `ToolExecutorContext` to `executeTool`, wire real player state into chat context                                         |
| `source/components/ai/AIChatView.tsx`         | Minor: display tool results better                                                                                            |
| `source/components/layouts/MainLayout.tsx`    | Add `AI_RECOMMENDATIONS` view routing                                                                                         |
| `source/main.tsx`                             | Register `KEYBINDINGS.AI_RECOMMENDATIONS` keybinding                                                                          |
| `source/immersive/immersive-engine.ts`        | Wire mood radio overlay                                                                                                       |
| `source/immersive/settings/settings-items.ts` | (Optional) Add mood radio settings row                                                                                        |

## Key Architecture Decisions

1. **Mood seeds use existing `RadioService`** — no new radio infrastructure needed. Moods are just a curated mapping from mood → existing seed types (track/artist/genre).

2. **Tool executor gets a context bridge** — the `ToolExecutorContext` pattern avoids tight coupling between the service-layer executor and the React player store. The chat store (a React component) provides the callbacks.

3. **`generate_playlist` is a single tool** — it handles search + curation + queue/playlist creation in one call, avoiding the need for a multi-turn tool loop (which Gemini doesn't support well in the current architecture).

4. **AI Playlist Generation uses `VIEW.AI_RECOMMENDATIONS`** — reuses the reserved but unused view slot instead of creating a new VIEW constant.

5. **Mood radio is data-driven** — new moods can be added by editing `builtin-moods.ts` without code changes.

## Testing Considerations

- **Mood radio**: Test that `RadioService.fetchBySeedType('mood', id)` returns deduplicated tracks from all the mood's seeds. Test that `startRadio({type: 'mood', ...})` dispatches correctly in the player store.
- **AI playlist generation**: Test the `generate_playlist` tool executor in isolation with mock `musicService`. Test that `ToolExecutorContext` callbacks correctly dispatch to the player store.
- **Integration**: Test the full flow from LLM chat → `generate_playlist` tool → queue/playlist creation → playback.

## Dependencies

- Mood-Based Radio depends on: existing `RadioService`, `RadioSeed` type, `startRadio` action, `RadioStreamsLayout` pattern.
- AI Playlist Generation depends on: existing LLM tool system, `Gemini API` configured, `chat.store.tsx` React context, player store dispatch.

## Risks

- **Gemini API cost**: `generate_playlist` makes a search call + potentially multiple `getTrack` calls per track. The `trackCount` parameter (default 20, max 50) limits this.
- **Mood taxonomy quality**: The predefined moods may not cover all user preferences. Consider allowing users to define custom moods in Settings (future enhancement).
- **Tool executor context wiring**: The `ToolExecutorContext` bridge is a new pattern. Care must be taken to handle cases where the context is not provided (e.g., testing the executor in isolation).
