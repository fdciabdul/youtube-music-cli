// Radio service - manages radio mode playback
// Generates endless queues of related tracks from a seed
import {getMusicService} from '../youtube-music/api.ts';
import {logger} from '../logger/logger.service.ts';
import {formatError} from '../../utils/error.ts';
import type {Track} from '../../types/youtube-music.types.ts';
import type {RadioSeed, RadioSeedType} from '../../types/radio.types.ts';
import {BUILTIN_MOODS} from '../../data/builtin-moods.ts';

class RadioService {
	private playedVideoIds: Set<string> = new Set();

	reset(): void {
		this.playedVideoIds.clear();
	}

	async fetchTracksForSeed(seed: RadioSeed): Promise<Track[]> {
		this.playedVideoIds.clear();
		const tracks = await this.fetchBySeedType(seed.type, seed.id);
		return this.deduplicate(tracks);
	}

	async fetchMoreTracks(seed: RadioSeed): Promise<Track[]> {
		let tracks: Track[];
		if (seed.type === 'track') {
			const musicService = getMusicService();
			const suggestions = await musicService.getSuggestions(seed.id);
			tracks = suggestions;
		} else {
			tracks = await this.fetchBySeedType(seed.type, seed.id);
		}

		return this.deduplicate(tracks);
	}

	private async fetchBySeedType(
		type: RadioSeedType,
		id: string,
	): Promise<Track[]> {
		const musicService = getMusicService();

		try {
			switch (type) {
				case 'track': {
					const suggestions = await musicService.getSuggestions(id);
					return suggestions;
				}

				case 'artist': {
					const artistResults = await musicService.search(id, {type: 'songs'});
					const tracks = artistResults.results
						.filter(r => r.type === 'song')
						.map(r => r.data as Track);
					return tracks.slice(0, 30);
				}

				case 'playlist': {
					const playlist = await musicService.getPlaylist(id);
					return playlist.tracks ?? [];
				}

				case 'genre': {
					const genrePlaylists = await musicService.getGenrePlaylists(id);
					if (genrePlaylists.length > 0 && genrePlaylists[0]) {
						const playlist = await musicService.getPlaylist(
							genrePlaylists[0].browseId,
						);
						return playlist.tracks ?? [];
					}

					return [];
				}

				case 'mood': {
					const mood = BUILTIN_MOODS.find(m => m.id === id);
					if (!mood) return [];
					const allTracks: Track[] = [];
					for (const seed of mood.seeds) {
						const seedTracks = await this.fetchBySeedType(seed.type, seed.id);
						allTracks.push(...seedTracks);
					}
					return this.deduplicate(allTracks).slice(0, 50);
				}

				default:
					return [];
			}
		} catch (error) {
			logger.error('RadioService', 'Failed to fetch tracks for seed', {
				type,
				id,
				error: formatError(error),
			});
			return [];
		}
	}

	private deduplicate(tracks: Track[]): Track[] {
		const result: Track[] = [];
		for (const track of tracks) {
			if (track.videoId && !this.playedVideoIds.has(track.videoId)) {
				this.playedVideoIds.add(track.videoId);
				result.push(track);
			}
		}

		return result;
	}
}

let instance: RadioService | null = null;

export function getRadioService(): RadioService {
	if (!instance) {
		instance = new RadioService();
	}

	return instance;
}

export function resetRadioService(): void {
	instance = null;
}
