import {expect, test} from 'bun:test';

test('history trimHistoryEntries caps length', async () => {
	const {trimHistoryEntries} =
		await import('../source/services/history/history.service.ts');

	const entries = Array.from({length: 5}, (_, index) => ({
		track: {
			videoId: `id-${index}`,
			title: `Track ${index}`,
			artists: [{name: 'Artist', id: 'a'}],
			duration: 120,
			thumbnails: [],
		},
		playedAt: new Date(2026, 0, index + 1).toISOString(),
	}));

	const trimmed = trimHistoryEntries(entries, 3);
	expect(trimmed.length).toBe(3);
	expect(trimmed[0]?.track.videoId).toBe('id-0');
	expect(trimmed[2]?.track.videoId).toBe('id-2');
});
