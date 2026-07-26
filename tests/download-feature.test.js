import {expect, test} from 'bun:test';

test('download config defaults are present', async () => {
	const {getConfigService} =
		await import('../source/services/config/config.service.ts');
	const config = getConfigService();

	expect(typeof (config.get('downloadsEnabled') ?? false)).toBe('boolean');
	expect(config.get('downloadDirectory')).toBeTruthy();
	expect(config.get('downloadFormat')).toBe('mp3');
	expect(config.get('preferLocalPlayback') ?? true).toBe(true);
});

test('download keybinding is registered as shift+d', async () => {
	const {KEYBINDINGS} = await import('../source/utils/constants.ts');
	expect(KEYBINDINGS.DOWNLOAD).toEqual(['shift+d']);
});

test('download service resolves song selection to one track', async () => {
	const {getDownloadService} =
		await import('../source/services/download/download.service.ts');

	const service = getDownloadService();
	const result = await service.resolveSearchTarget({
		type: 'song',
		data: {
			videoId: 'abc123',
			title: 'Track',
			artists: [{artistId: 'artist1', name: 'Artist'}],
		},
	});

	expect(result.tracks.length).toBe(1);
	expect(result.tracks[0].videoId).toBe('abc123');
});
