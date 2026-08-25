// Radio service - manages radio mode playback
// Generates endless queues of related tracks from a seed
import {getMusicService} from '../youtube-music/api.ts';
import {getConfigService} from '../config/config.service.ts';
import {logger} from '../logger/logger.service.ts';
import {formatError} from '../../utils/error.ts';
import type {Track} from '../../types/youtube-music.types.ts';
import type {RadioSeed, RadioSeedType} from '../../types/radio.types.ts';
import {BUILTIN_MOODS} from '../../data/builtin-moods.ts';
import {findLocalPlaylistTracks} from './local-playlist-seed.ts';

class RadioService {
	private playedVideoIds: Set<string> = new Set();

	reset(): void {
		this.playedVideoIds.clear();
	}

	async fetchTracksForSeed(seed: RadioSeed): Promise<Track[]> {
		logger.debug('RadioService', 'fetchTracksForSeed called', {
			type: seed.type,
			id: seed.id,
			name: seed.name,
		});
		this.playedVideoIds.clear();
		const tracks = await this.fetchBySeedType(seed.type, seed.id);
		logger.debug('RadioService', 'fetchTracksForSeed result', {
			type: seed.type,
			id: seed.id,
			trackCount: tracks.length,
		});
		return this.deduplicate(tracks);
	}

	async fetchMoreTracks(seed: RadioSeed): Promise<Track[]> {
		let tracks: Track[];
		if (seed.type === 'track') {
			const musicService = getMusicService();
			const suggestions = await musicService.getSuggestions(seed.id);
			tracks = suggestions;
		} else if (seed.type === 'local-playlist') {
			// The playlist's own tracks are already queued/deduped by the time
			// extension kicks in; continue endlessly with related tracks
			// anchored on one of the playlist's songs.
			const stored = findLocalPlaylistTracks(
				getConfigService().get('playlists'),
				seed.id,
			);
			const anchor = stored?.find(track => track.videoId);
			tracks = anchor?.videoId
				? await getMusicService().getSuggestions(anchor.videoId)
				: [];
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
					logger.debug('RadioService', 'Searching for artist', {
						artistName: id,
					});
					const artistResults = await musicService.search(id, {type: 'songs'});
					logger.debug('RadioService', 'Artist search raw results', {
						artistName: id,
						totalResults: artistResults.results.length,
						resultTypes: artistResults.results.map(r => r.type),
					});
					const tracks = artistResults.results
						.filter(r => r.type === 'song')
						.map(r => r.data as Track);
					logger.debug('RadioService', 'Artist search filtered tracks', {
						artistName: id,
						filteredCount: tracks.length,
						firstTrackTitle: tracks[0]?.title,
					});
					return tracks.slice(0, 30);
				}

				case 'playlist': {
					const playlist = await musicService.getPlaylist(id);
					return playlist.tracks ?? [];
				}

				case 'local-playlist': {
					// Saved playlists live in the config store; shuffle them so
					// each radio start feels fresh. Endless continuation beyond
					// the playlist tracks comes from autoplay suggestions.
					const tracks = findLocalPlaylistTracks(
						getConfigService().get('playlists'),
						id,
					);
					if (!tracks) {
						logger.warn('RadioService', 'Local playlist not found', {id});
						return [];
					}
					return tracks;
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
					if (!mood) {
						logger.warn('RadioService', 'Mood not found', {id});
						return [];
					}
					logger.debug('RadioService', 'Mood seeds', {
						moodId: mood.id,
						seedCount: mood.seeds.length,
						seeds: mood.seeds.map(s => ({type: s.type, id: s.id})),
					});
					const allTracks: Track[] = [];
					for (const seed of mood.seeds) {
						const seedTracks = await this.fetchBySeedType(seed.type, seed.id);
						logger.debug('RadioService', 'Mood seed result', {
							seedType: seed.type,
							seedId: seed.id,
							trackCount: seedTracks.length,
						});
						allTracks.push(...seedTracks);
					}
					logger.debug('RadioService', 'Mood total tracks', {
						total: allTracks.length,
					});
					// Don't deduplicate here — fetchTracksForSeed/fetchMoreTracks already
					// call deduplicate on the returned array. Deduplicating here would
					// populate playedVideoIds, causing the outer dedup to return 0 tracks.
					return allTracks.slice(0, 50);
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
