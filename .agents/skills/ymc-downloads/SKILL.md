# YMC Downloads

Download pipeline and on-disk playback index for youtube-music-cli.

## Pipeline

1. Destination: `{downloadDirectory}/{Artist}/{Album}/{Title}.{mp3|m4a}` via `getTrackDestinationPath`.
2. Source: yt-dlp → youtubei.js stream → mpv `--stream-record`.
3. ffmpeg convert + metadata/cover.
4. Upsert `downloads-index.json` on success and on skip-if-exists.

## Key files

- `source/services/download/download.service.ts`
- `source/utils/local-track.ts` — index + path helpers + `resolveLocalTrackPath`
- `source/utils/download-path.ts` — normalize/ensure directory
- Config: `downloadsEnabled`, `downloadDirectory`, `downloadFormat`, `preferLocalPlayback`

## UI

- Ink / immersive: Shift+D download; progress via `formatDownloadProgress`.
- Playing a downloaded track prefers disk when `preferLocalPlayback` is true.
