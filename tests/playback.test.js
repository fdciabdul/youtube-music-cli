import {expect, test} from 'bun:test';

test('player service exposes singleton without starting mpv', async () => {
	const {getPlayerService} =
		await import('../source/services/player/player.service.ts');

	const a = getPlayerService();
	const b = getPlayerService();

	expect(a).toBe(b);

	// Should allow pause/resume/stop without crashing when mpv is not running
	expect(() => {
		a.pause();
		a.resume();
		a.stop();
	}).not.toThrow();
});

// ── Shuffle reducer tests ─────────────────────────────────────────────────────

/** Build a minimal PlayerState for reducer tests */
function makeState(overrides = {}) {
	return {
		currentTrack: null,
		isPlaying: false,
		volume: 70,
		speed: 1.0,
		progress: 0,
		duration: 0,
		queue: [],
		queuePosition: 0,
		repeat: 'off',
		shuffle: false,
		isLoading: false,
		error: null,
		...overrides,
	};
}

/** Build a minimal Track object */
function makeTrack(id) {
	return {videoId: id, title: `Track ${id}`, artists: [], duration: 200};
}

test('TOGGLE_SHUFFLE flips shuffle from false to true', async () => {
	const {playerReducer} = await import('../source/stores/player.store.tsx');
	const state = makeState({shuffle: false});
	const next = playerReducer(state, {category: 'TOGGLE_SHUFFLE'});
	expect(next.shuffle).toBe(true);
});

test('TOGGLE_SHUFFLE flips shuffle from true to false', async () => {
	const {playerReducer} = await import('../source/stores/player.store.tsx');
	const state = makeState({shuffle: true});
	const next = playerReducer(state, {category: 'TOGGLE_SHUFFLE'});
	expect(next.shuffle).toBe(false);
});

test('PLAY_NEXT inserts track after current queue position', async () => {
	const {playerReducer} = await import('../source/stores/player.store.tsx');
	const a = makeTrack('a');
	const b = makeTrack('b');
	const c = makeTrack('c');
	const state = makeState({
		queue: [a, b],
		queuePosition: 0,
		currentTrack: a,
		explicitQueueLength: 2,
	});
	const next = playerReducer(state, {category: 'PLAY_NEXT', track: c});
	expect(next.queue.map(track => track.videoId)).toEqual(['a', 'c', 'b']);
	expect(next.queuePosition).toBe(0);
	expect(next.explicitQueueLength).toBe(3);
});

test('ADD_TO_QUEUE appends and bumps explicitQueueLength', async () => {
	const {playerReducer} = await import('../source/stores/player.store.tsx');
	const a = makeTrack('a');
	const b = makeTrack('b');
	const state = makeState({
		queue: [a],
		queuePosition: 0,
		explicitQueueLength: 1,
	});
	const next = playerReducer(state, {category: 'ADD_TO_QUEUE', track: b});
	expect(next.queue.map(track => track.videoId)).toEqual(['a', 'b']);
	expect(next.explicitQueueLength).toBe(2);
});

test('NEXT with shuffle=true and single-track queue falls through sequentially (no-op)', async () => {
	const {playerReducer} = await import('../source/stores/player.store.tsx');
	const track = makeTrack('a');
	const state = makeState({
		shuffle: true,
		queue: [track],
		queuePosition: 0,
		currentTrack: track,
		repeat: 'off',
	});
	// Only 1 track — sequential logic applies, nextPosition (1) >= queue.length (1) → return state
	const next = playerReducer(state, {category: 'NEXT'});
	expect(next.queuePosition).toBe(0); // position unchanged
});

test('NEXT with shuffle=true and multi-track queue returns a different position', async () => {
	const {playerReducer} = await import('../source/stores/player.store.tsx');
	const tracks = ['a', 'b', 'c', 'd', 'e'].map(makeTrack);
	const state = makeState({
		shuffle: true,
		queue: tracks,
		queuePosition: 2,
		currentTrack: tracks[2],
	});

	// Run many times to verify we never stay at position 2
	for (let i = 0; i < 20; i++) {
		const next = playerReducer(state, {category: 'NEXT'});
		expect(next.queuePosition).not.toBe(2);
		expect(
			next.queuePosition >= 0 && next.queuePosition < tracks.length,
			'new position must be in valid range',
		).toBe(true);
		expect(next.progress).toBe(0);
	}
});

test('NEXT with shuffle=false uses sequential order', async () => {
	const {playerReducer} = await import('../source/stores/player.store.tsx');
	const tracks = ['a', 'b', 'c'].map(makeTrack);
	const state = makeState({
		shuffle: false,
		queue: tracks,
		queuePosition: 1,
		currentTrack: tracks[1],
	});
	const next = playerReducer(state, {category: 'NEXT'});
	expect(next.queuePosition).toBe(2);
	expect(next.currentTrack?.videoId).toBe('c');
});

test('PREVIOUS is unaffected by shuffle state', async () => {
	const {playerReducer} = await import('../source/stores/player.store.tsx');
	const tracks = ['a', 'b', 'c'].map(makeTrack);
	const state = makeState({
		shuffle: true,
		queue: tracks,
		queuePosition: 2,
		currentTrack: tracks[2],
		progress: 0,
	});
	const next = playerReducer(state, {category: 'PREVIOUS'});
	expect(next.queuePosition).toBe(1); // always goes to sequential previous
	expect(next.currentTrack?.videoId).toBe('b');
});

test('NEXT with shuffle=true wraps with repeat=all using random pick', async () => {
	const {playerReducer} = await import('../source/stores/player.store.tsx');
	const tracks = ['a', 'b', 'c'].map(makeTrack);
	const state = makeState({
		shuffle: true,
		queue: tracks,
		queuePosition: 0,
		currentTrack: tracks[0],
		repeat: 'all',
	});
	// Shuffle is active and queue has 3 tracks — should always return a position != 0
	for (let i = 0; i < 10; i++) {
		const next = playerReducer(state, {category: 'NEXT'});
		expect(next.queuePosition).not.toBe(0);
	}
});

test('discord rpc service no-ops when disabled', async () => {
	const {getDiscordRpcService} =
		await import('../source/services/discord/discord-rpc.service.ts');
	const rpc = getDiscordRpcService();

	rpc.setEnabled(false);
	await rpc.connect();
	await rpc.updateActivity({
		title: 'Song',
		artist: 'Artist',
		startTimestamp: Date.now(),
	});
	await rpc.clearActivity();

	expect(true).toBe(true);
});
