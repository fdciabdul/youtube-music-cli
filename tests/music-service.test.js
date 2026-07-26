import {expect, test} from 'bun:test';

test('getTrack accepts raw video id', async () => {
	const {getMusicService} =
		await import('../source/services/youtube-music/api.ts');
	const service = getMusicService();

	const track = await service.getTrack('dQw4w9WgXcQ');
	expect(track).toBeTruthy();
	expect(track?.videoId).toBe('dQw4w9WgXcQ');
});

test('getTrack normalizes YouTube watch URL to video id', async () => {
	const {getMusicService} =
		await import('../source/services/youtube-music/api.ts');
	const service = getMusicService();

	const track = await service.getTrack(
		'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=abc123',
	);
	expect(track).toBeTruthy();
	expect(track?.videoId).toBe('dQw4w9WgXcQ');
});

test('getTrack rejects invalid URL input', async () => {
	const {getMusicService} =
		await import('../source/services/youtube-music/api.ts');
	const service = getMusicService();

	const track = await service.getTrack('https://example.com/video.mp4');
	expect(track).toBe(null);
});
