import type {Artist, Track} from '../../types';

interface NowPlayingProps {
	track: Track | null;
	isPlaying: boolean;
	autoplay: boolean;
}

export default function NowPlaying({
	track,
	isPlaying,
	autoplay,
}: NowPlayingProps) {
	if (!track) {
		return (
			<div className="now-playing">
				<div className="now-playing__art now-playing__art--empty">
					no signal
				</div>
				<p className="now-playing__artists">Nothing playing</p>
			</div>
		);
	}

	const thumbnailUrl = `https://img.youtube.com/vi/${track.videoId}/hqdefault.jpg`;
	const artists = track.artists.map((a: Artist) => a.name).join(', ');

	return (
		<div key={track.videoId} className="now-playing track-fade-in">
			<img
				className="now-playing__art"
				src={thumbnailUrl}
				alt=""
				onError={e => {
					(e.currentTarget as HTMLImageElement).style.display = 'none';
				}}
			/>
			<div className="now-playing__status">
				{isPlaying ? 'Now Playing' : 'Paused'}
				{autoplay ? ' · Radio' : ''}
			</div>
			<h2 className="now-playing__title">{track.title}</h2>
			<p className="now-playing__artists">{artists}</p>
			{track.album && <p className="now-playing__album">{track.album.name}</p>}
		</div>
	);
}
