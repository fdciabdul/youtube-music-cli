import test from 'ava';
import {BUILTIN_LIVE_STREAMS} from '../source/data/builtin-live-streams.ts';
import {
	getLiveStreamById,
	getLiveStreams,
	toRadioStation,
} from '../source/services/live-streams/live-streams.service.ts';
import {
	closeLiveStreamsOverlay,
	createLiveStreamsOverlayState,
	getSelectedLiveStream,
	handleLiveStreamsOverlayInput,
	openLiveStreamsOverlay,
} from '../source/immersive/ui/live-streams-overlay.ts';

test('builtin live streams have unique ids and http(s) URLs', t => {
	const streams = getLiveStreams();
	const ids = new Set();

	t.true(streams.length > 0);
	t.is(streams.length, BUILTIN_LIVE_STREAMS.length);

	for (const entry of streams) {
		t.false(ids.has(entry.id), `duplicate id: ${entry.id}`);
		ids.add(entry.id);
		t.true(
			entry.url.startsWith('http://') || entry.url.startsWith('https://'),
			`bad url for ${entry.id}`,
		);
		t.true(entry.name.length > 0);
		t.true(entry.tags.length > 0);
	}

	const names = streams.map(entry => entry.name);
	const sorted = [...names].toSorted((a, b) => a.localeCompare(b));
	t.deepEqual(names, sorted);
});

test('getLiveStreamById returns known entries', t => {
	t.is(getLiveStreamById('claude-live')?.name, 'Claude — Live');
	t.is(getLiveStreamById('anomaly-fm')?.url, 'https://anomaly.fm/radio');
	t.is(getLiveStreamById('missing'), undefined);
});

test('toRadioStation maps live catalog entry for PLAY_STREAM', t => {
	const entry = getLiveStreamById('coding-synth');
	t.truthy(entry);
	if (!entry) {
		return;
	}

	const station = toRadioStation(entry);

	t.is(station.id, entry.id);
	t.is(station.name, entry.name);
	t.is(station.streamUrl, entry.url);
	t.is(station.genre, entry.tags[0]);
	t.is(station.source, 'live-catalog');
});

test('live streams overlay open/close and selection', t => {
	const state = createLiveStreamsOverlayState();
	t.false(state.active);

	openLiveStreamsOverlay(state);
	t.true(state.active);
	t.is(state.selectedIndex, 0);
	t.truthy(getSelectedLiveStream(state));

	const down = handleLiveStreamsOverlayInput(state, 'down');
	t.is(down, 'none');
	t.is(state.selectedIndex, 1);

	const play = handleLiveStreamsOverlayInput(state, 'enter');
	t.is(play, 'play');

	closeLiveStreamsOverlay(state);
	t.false(state.active);
	t.is(state.selectedIndex, 0);
});

test('live streams overlay escape closes', t => {
	const state = createLiveStreamsOverlayState();
	openLiveStreamsOverlay(state);
	t.is(handleLiveStreamsOverlayInput(state, 'escape'), 'close');
	t.false(state.active);
});
