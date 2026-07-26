import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {CONFIG_DIR} from './constants.ts';
import type {DownloadFormat} from '../types/config.types.ts';
import type {Track} from '../types/youtube-music.types.ts';

export const DOWNLOADS_INDEX_FILE = path.join(
	CONFIG_DIR,
	'downloads-index.json',
);

export type DownloadsIndexEntry = {
	path: string;
	format: DownloadFormat;
	updatedAt: string;
};

export type DownloadsIndex = {
	schemaVersion: 1;
	tracks: Record<string, DownloadsIndexEntry>;
};

export type TrackPlaySource = 'local' | 'youtube';

export type ResolvedTrackPlay = {
	url: string;
	source: TrackPlaySource;
};

/** Classify media for PlayerService.play — absolute/file paths pass through. */
export function classifyPlayMedia(url: string): string {
	if (url.startsWith('http://') || url.startsWith('https://')) {
		return url;
	}
	if (url.startsWith('file:')) {
		return url;
	}
	if (path.isAbsolute(url)) {
		return url;
	}
	return `https://www.youtube.com/watch?v=${url}`;
}

export function sanitizeDownloadFilename(value: string): string {
	return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim();
}

export function getTrackDestinationPath(
	track: Track,
	directory: string,
	format: DownloadFormat,
): string {
	const artist = track.artists[0]?.name ?? 'Unknown Artist';
	const album = track.album?.name ?? 'Singles';
	const artistDir = sanitizeDownloadFilename(artist) || 'Unknown Artist';
	const albumDir = sanitizeDownloadFilename(album) || 'Singles';
	const fileName = sanitizeDownloadFilename(track.title) || track.videoId;
	return path.join(directory, artistDir, albumDir, `${fileName}.${format}`);
}

export function loadDownloadsIndex(
	indexPath: string = DOWNLOADS_INDEX_FILE,
): DownloadsIndex {
	try {
		if (!existsSync(indexPath)) {
			return {schemaVersion: 1, tracks: {}};
		}
		const raw = JSON.parse(
			readFileSync(indexPath, 'utf8'),
		) as Partial<DownloadsIndex>;
		if (
			raw.schemaVersion !== 1 ||
			typeof raw.tracks !== 'object' ||
			!raw.tracks
		) {
			return {schemaVersion: 1, tracks: {}};
		}
		return {schemaVersion: 1, tracks: raw.tracks};
	} catch {
		return {schemaVersion: 1, tracks: {}};
	}
}

export function saveDownloadsIndex(
	index: DownloadsIndex,
	indexPath: string = DOWNLOADS_INDEX_FILE,
): void {
	const dir = path.dirname(indexPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, {recursive: true});
	}
	writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
}

export function upsertDownloadsIndexEntry(
	videoId: string,
	filePath: string,
	format: DownloadFormat,
	indexPath: string = DOWNLOADS_INDEX_FILE,
): void {
	const index = loadDownloadsIndex(indexPath);
	index.tracks[videoId] = {
		path: path.resolve(filePath),
		format,
		updatedAt: new Date().toISOString(),
	};
	saveDownloadsIndex(index, indexPath);
}

/**
 * Resolve a local file for a track: index hit first, then legacy path reconstruct.
 */
export function resolveLocalTrackPath(
	track: Track,
	options: {
		downloadDirectory?: string;
		downloadFormat?: DownloadFormat;
		indexPath?: string;
	} = {},
): string | null {
	const indexPath = options.indexPath ?? DOWNLOADS_INDEX_FILE;
	const index = loadDownloadsIndex(indexPath);
	const entry = index.tracks[track.videoId];
	if (entry?.path && existsSync(entry.path)) {
		return entry.path;
	}

	const directory = options.downloadDirectory?.trim();
	if (!directory) {
		return null;
	}

	const format = options.downloadFormat ?? 'mp3';
	const legacyPath = getTrackDestinationPath(track, directory, format);
	if (existsSync(legacyPath)) {
		return legacyPath;
	}

	// Try the other format if the configured one is missing
	const otherFormat: DownloadFormat = format === 'mp3' ? 'm4a' : 'mp3';
	const altPath = getTrackDestinationPath(track, directory, otherFormat);
	if (existsSync(altPath)) {
		return altPath;
	}

	return null;
}

export function resolveTrackPlayUrl(
	track: Track,
	options: {
		preferLocal?: boolean;
		downloadDirectory?: string;
		downloadFormat?: DownloadFormat;
		indexPath?: string;
	} = {},
): ResolvedTrackPlay {
	const preferLocal = options.preferLocal ?? true;
	if (preferLocal) {
		const localPath = resolveLocalTrackPath(track, options);
		if (localPath) {
			return {url: localPath, source: 'local'};
		}
	}
	return {
		url: `https://www.youtube.com/watch?v=${track.videoId}`,
		source: 'youtube',
	};
}
