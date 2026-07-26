# YMC Downloads

Download pipeline and on-disk playback index for youtube-music-cli.

## Pipeline

1. Destination: `{downloadDirectory}/{Artist}/{Album}/{Title} [{videoId}].{mp3|m4a}` via `getTrackDestinationPath` (legacy title-only paths still resolve).
2. Source: yt-dlp → youtubei.js stream → mpv `--stream-record`.
3. ffmpeg convert + metadata/cover.
4. Upsert `downloads-index.json` on success and on skip-if-exists.

## Key files

- `source/services/download/download.service.ts`
- `source/utils/local-track.ts` — index + path helpers + `resolveLocalTrackPath`
- `source/utils/download-path.ts` — normalize/ensure directory
- Config: `downloadsEnabled`, `downloadDirectory`, `downloadFormat`, `preferLocalPlayback` (Settings toggle)

## UI

- Ink / immersive: Shift+D download; progress via `formatDownloadProgress`.
- Settings: Prefer Local Playback ON/OFF.
- Playing a downloaded track prefers disk when `preferLocalPlayback` is true.
