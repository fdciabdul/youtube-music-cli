# YMC Playback

Prefer local files when available, then YouTube URLs via mpv IPC.

## Local vs remote

- `resolveTrackPlayUrl()` in `source/utils/local-track.ts` returns `{ url, source: 'local' | 'youtube' }`.
- Index: `~/.youtube-music-cli/downloads-index.json` keyed by `videoId`.
- Config: `preferLocalPlayback` (default `true`).
- `PlayerService.play` uses `classifyPlayMedia()` — absolute paths and `file:` URLs pass through; bare ids become watch URLs.

## Call sites

- Ink: `source/stores/player.store.tsx`
- Immersive: `resolveImmersiveTrackPlayUrl` in `source/immersive/state/queue-state.ts`
- CLI: `source/cli.tsx`
- Web: `WebServerManager.playTrackMedia`

## mpv notes

- Idle spawn + IPC `loadfile` (no URL on CLI args).
- Shared stall/EOF policy: `source/services/player/mpv-event-policy.ts`.
- mpv 0.41+: `--slang=en` not `--sub-lang=en`.
