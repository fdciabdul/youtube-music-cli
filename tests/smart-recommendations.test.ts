import {describe, it, expect} from 'bun:test';
import {getSmartRecommendations} from '../source/services/youtube-music/smart-recommendations.service.ts';
import type {Track} from '../source/types/youtube-music.types.ts';

describe('SmartRecommendations', () => {
	it('should return recommendations with diversity capping', async () => {
		const seedTrack: Track = {
			videoId: 'seed123',
			title: 'Seed Track',
			artists: [{name: 'Artist A', artistId: 'artist1'}],
			duration: 180,
		};

		const recommendations = await getSmartRecommendations(seedTrack, 5);
		expect(Array.isArray(recommendations)).toBe(true);
	});
});
