// Lyrics service — line-synced lyrics via LRCLIB, with word-level
// ("richsync") karaoke timing via Musixmatch when available, using the
// @stef-0012/synclyrics library (https://github.com/Stef-00012/SyncLyrics-npm).
import {SyncLyrics, type TokenData} from '@stef-0012/synclyrics';
import {logger} from '../logger/logger.service.ts';

export interface LyricWord {
	text: string;
	time: number; // seconds, absolute (relative to track start)
}

export interface LyricLine {
	time: number; // seconds
	endTime?: number; // seconds — only set for word-synced lines
	text: string;
	words?: LyricWord[]; // present only when word-level ("richsync") data is available
}

export interface Lyrics {
	synced: LyricLine[] | null; // null if only plain lyrics
	plain: string | null;
}

let musixmatchToken: TokenData | null = null;

class LyricsService {
	private static instance: LyricsService;
	private cache = new Map<string, Lyrics | null>();
	private manager = new SyncLyrics({
		logLevel: 'none',
		sources: ['musixmatch', 'lrclib'],
		saveMusixmatchToken: tokenData => {
			musixmatchToken = tokenData;
		},
		getMusixmatchToken: () => musixmatchToken,
	});

	private constructor() {}

	static getInstance(): LyricsService {
		if (!LyricsService.instance) {
			LyricsService.instance = new LyricsService();
		}
		return LyricsService.instance;
	}

	async getLyrics(
		trackName: string,
		artistName: string,
		duration?: number,
	): Promise<Lyrics | null> {
		const cacheKey = `${trackName}::${artistName}`;
		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey) ?? null;
		}

		try {
			const result = await this.manager.getLyrics({
				track: trackName,
				artist: artistName,
				length: duration ? Math.round(duration * 1000) : undefined,
			});

			if (!result) {
				this.cache.set(cacheKey, null);
				return null;
			}

			const {wordSynced, lineSynced, plain} = result.lyrics;

			let synced: LyricLine[] | null = null;

			if (wordSynced?.lyrics && wordSynced.lyrics.length > 0) {
				synced = wordSynced.lyrics
					.map(line => ({
						time: line.start,
						endTime: line.end,
						text: line.lyric,
						words: line.syncedLyric.map(w => ({
							text: w.character,
							time: line.start + w.time,
						})),
					}))
					.sort((a, b) => a.time - b.time);
			} else if (lineSynced?.lyrics) {
				const parsed = lineSynced.parse(lineSynced.lyrics);
				synced = parsed
					? parsed
							.map(line => ({time: line.time, text: line.text}))
							.sort((a, b) => a.time - b.time)
					: null;
			}

			const lyrics: Lyrics = {
				synced,
				plain: plain?.lyrics ?? null,
			};

			this.cache.set(cacheKey, lyrics);
			logger.info('LyricsService', 'Lyrics loaded', {
				trackName,
				hasSynced: !!lyrics.synced,
				hasWordSync: !!wordSynced?.lyrics?.length,
				hasPlain: !!lyrics.plain,
			});
			return lyrics;
		} catch (error) {
			logger.warn('LyricsService', 'Failed to fetch lyrics', {
				error: error instanceof Error ? error.message : String(error),
			});
			this.cache.set(cacheKey, null);
			return null;
		}
	}

	/** Get the current lyric line index based on playback position */
	getCurrentLineIndex(lines: LyricLine[], currentTime: number): number {
		let index = 0;
		for (let i = 0; i < lines.length; i++) {
			if (lines[i]!.time <= currentTime) {
				index = i;
			} else {
				break;
			}
		}
		return index;
	}

	clearCache(): void {
		this.cache.clear();
	}
}

export const getLyricsService = (): LyricsService =>
	LyricsService.getInstance();
