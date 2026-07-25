import {Box} from 'ink';
import PlayerControls from '../player/PlayerControls.tsx';
import NowPlaying from '../player/NowPlaying.tsx';
import LiveStreamsList from '../live-streams/LiveStreamsList.tsx';

export default function LiveStreamsLayout() {
	return (
		<Box flexDirection="column" flexGrow={1}>
			<NowPlaying />
			<PlayerControls />
			<LiveStreamsList />
		</Box>
	);
}
