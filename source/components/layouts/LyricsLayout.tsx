// Lyrics view layout - displays synced or plain lyrics with karaoke-style
// word-level highlighting and a smooth color gradient sweep.
import {useState, useEffect} from 'react';
import {Box, Text} from 'ink';
import {useTheme} from '../../hooks/useTheme.ts';
import {usePlayer} from '../../hooks/usePlayer.ts';
import {
	getLyricsService,
	type LyricLine,
} from '../../services/lyrics/lyrics.service.ts';
import {useTerminalSize} from '../../hooks/useTerminalSize.ts';
import type {ColorName} from '../../types/theme.types.ts';

const CONTEXT_LINES = 2; // Lines shown before/after current line
const KARAOKE_TICK_MS = 60; // Smooth word-highlight refresh rate
const CHARS_PER_SECOND = 15; // Assumed singing/speech pace for word timing
const MAX_LINE_DURATION = 6; // Cap so long gaps don't stretch the sweep
const GLOW_CHARS = 2.5; // Width (in characters) of the gradient sweep
// Fixed chrome around the lyric list: header(3) + status(1) + gaps(2) +
// footer(2) + outer border/shortcuts bar(~4) + safety margin(2)
const RESERVED_ROWS = 14;

// Approximate hex values for the named ANSI colors used by themes, so we can
// interpolate a smooth per-character gradient (Ink/chalk accept hex colors
// even though the theme type only exposes named ones).
const HEX_BY_NAME: Record<ColorName, string> = {
	black: '#0b0b0d',
	red: '#e06c75',
	green: '#98c379',
	yellow: '#e5c07b',
	blue: '#61afef',
	magenta: '#c678dd',
	purple: '#a855f7',
	cyan: '#56b6c2',
	white: '#dcdfe4',
	blackBright: '#5c6370',
	redBright: '#f87171',
	greenBright: '#4ade80',
	yellowBright: '#fbbf24',
	blueBright: '#60a5fa',
	magentaBright: '#e879f9',
	cyanBright: '#67e8f9',
	whiteBright: '#f9fafb',
	gray: '#6b7280',
};

function lerpColor(from: string, to: string, t: number): string {
	const clampedT = Math.max(0, Math.min(1, t));
	const a = Number.parseInt(from.slice(1), 16);
	const b = Number.parseInt(to.slice(1), 16);
	const ar = (a >> 16) & 0xff;
	const ag = (a >> 8) & 0xff;
	const ab = a & 0xff;
	const br = (b >> 16) & 0xff;
	const bg = (b >> 8) & 0xff;
	const bb = b & 0xff;
	const r = Math.round(ar + (br - ar) * clampedT);
	const g = Math.round(ag + (bg - ag) * clampedT);
	const bl = Math.round(ab + (bb - ab) * clampedT);
	return `#${[r, g, bl].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

type CharCell = {char: string; color: string};

export default function LyricsLayout() {
	const {theme} = useTheme();
	const {state} = usePlayer();
	const {rows} = useTerminalSize();
	const [lyrics, setLyrics] = useState<{
		synced: LyricLine[] | null;
		plain: string | null;
	} | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const lyricsService = getLyricsService();

	// Interpolate a smooth clock between the once-a-second progress ticks so
	// the karaoke sweep doesn't visibly stair-step.
	const [smoothProgress, setSmoothProgress] = useState(state.progress);
	useEffect(() => {
		const anchorProgress = state.progress;
		const anchorTime = Date.now();

		const tick = () => {
			const elapsed = state.isPlaying ? (Date.now() - anchorTime) / 1000 : 0;
			setSmoothProgress(
				Math.min(anchorProgress + elapsed, state.duration || Infinity),
			);
		};

		queueMicrotask(tick);
		if (!state.isPlaying) {
			return;
		}

		const interval = setInterval(tick, KARAOKE_TICK_MS);
		return () => {
			clearInterval(interval);
		};
	}, [state.progress, state.isPlaying, state.duration]);

	// Fetch lyrics when track changes
	useEffect(() => {
		const track = state.currentTrack;
		let cancelled = false;
		if (!track) {
			queueMicrotask(() => {
				if (!cancelled) {
					setLyrics(null);
					setLoading(false);
					setError(null);
				}
			});
			return;
		}

		const artist = track.artists?.[0]?.name ?? '';
		queueMicrotask(() => {
			if (!cancelled) {
				setLoading(true);
				setError(null);
			}
		});

		void lyricsService
			.getLyrics(track.title, artist, state.duration || undefined)
			.then(result => {
				if (cancelled) {
					return;
				}

				setLyrics(result);
				setLoading(false);
				if (!result) {
					setError('No lyrics found');
				}
			})
			.catch(() => {
				if (cancelled) {
					return;
				}

				setLoading(false);
				setError('Failed to load lyrics');
			});

		return () => {
			cancelled = true;
		};
	}, [lyricsService, state.currentTrack, state.duration]);

	const track = state.currentTrack;
	const title = track?.title ?? 'No track playing';
	const artist = track?.artists?.map(a => a.name).join(', ') ?? '';

	// Determine current line
	const currentLineIndex = lyrics?.synced
		? lyricsService.getCurrentLineIndex(lyrics.synced, smoothProgress)
		: -1;

	// Karaoke gradient for the active line: walk character-by-character and
	// blend colors within a small window around the exact (fractional)
	// playhead position, so the sweep looks continuous instead of stepping
	// word-to-word. Timing is estimated at a natural reading pace capped by
	// the gap to the next line, since our lyric sources only give per-line
	// sync (no per-word timestamps).
	const karaokeChars: CharCell[] | null = (() => {
		if (!lyrics?.synced || currentLineIndex < 0) return null;
		const currentLine = lyrics.synced[currentLineIndex]!;
		const text = currentLine.text;
		if (!text) return null;

		const nextLine = lyrics.synced[currentLineIndex + 1];

		// Word timeline: real per-word timestamps when Musixmatch richsync data
		// is available, otherwise a natural-pace estimate from line-level sync.
		type WordSpan = {text: string; start: number; end: number};
		let wordSpans: WordSpan[];

		if (currentLine.words && currentLine.words.length > 0) {
			const words = currentLine.words;
			const lineEnd =
				currentLine.endTime ??
				nextLine?.time ??
				currentLine.time + MAX_LINE_DURATION;
			wordSpans = words.map((w, i) => ({
				text: w.text,
				start: w.time,
				end: words[i + 1]?.time ?? lineEnd,
			}));
		} else {
			const gapToNext = nextLine
				? nextLine.time - currentLine.time
				: MAX_LINE_DURATION;
			const naturalDuration = text.length / CHARS_PER_SECOND;
			const lineDuration = Math.max(
				0.4,
				Math.min(naturalDuration, gapToNext, MAX_LINE_DURATION),
			);
			const tokens = text.split(/(\s+)/).filter(t => t.length > 0);
			const totalChars = tokens.reduce((sum, t) => sum + t.length, 0) || 1;
			let chars = 0;
			wordSpans = tokens.map(token => {
				const start = currentLine.time + (chars / totalChars) * lineDuration;
				chars += token.length;
				const end = currentLine.time + (chars / totalChars) * lineDuration;
				return {text: token, start, end};
			});
		}

		const sungColor = HEX_BY_NAME[theme.colors.primary];
		const peakColor = HEX_BY_NAME[theme.colors.accent];
		const upcomingColor = HEX_BY_NAME[theme.colors.text];

		const cells: CharCell[] = [];
		for (const span of wordSpans) {
			const wordChars = [...span.text];
			const wordDuration = Math.max(0.05, span.end - span.start);
			wordChars.forEach((char, i) => {
				// Sub-word position estimate purely for the glow gradient — word
				// boundaries themselves are the real (or estimated) sync points.
				const charTime = span.start + (i / wordChars.length) * wordDuration;
				const delta =
					(smoothProgress - charTime) / (wordDuration / wordChars.length || 1);

				let color: string;
				if (delta >= GLOW_CHARS) {
					color = sungColor;
				} else if (delta <= -GLOW_CHARS) {
					color = upcomingColor;
				} else if (delta >= 0) {
					color = lerpColor(peakColor, sungColor, delta / GLOW_CHARS);
				} else {
					color = lerpColor(peakColor, upcomingColor, -delta / GLOW_CHARS);
				}

				cells.push({char, color});
			});
		}

		return cells;
	})();

	// Calculate visible lines window, sized to fit the terminal without
	// overflowing (Ink doesn't clip or scroll overflowing content).
	const maxLines = Math.max(3, rows - RESERVED_ROWS);
	const visibleLines = (() => {
		if (!lyrics?.synced) return null;
		const start = Math.max(0, currentLineIndex - CONTEXT_LINES);
		const end = Math.min(lyrics.synced.length, start + maxLines);
		return lyrics.synced.slice(start, end).map((line, i) => ({
			line,
			globalIndex: start + i,
		}));
	})();

	return (
		<Box flexDirection="column">
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor={theme.colors.secondary}
				paddingX={1}
			>
				<Text bold color={theme.colors.primary}>
					{title}
				</Text>
				{artist && <Text color={theme.colors.secondary}> — {artist}</Text>}
			</Box>

			{loading && <Text color={theme.colors.accent}>Loading lyrics...</Text>}

			{error && !loading && <Text color={theme.colors.dim}>{error}</Text>}

			{/* Synced lyrics */}
			{!loading && visibleLines && (
				<Box flexDirection="column" paddingX={1}>
					{visibleLines.map(({line, globalIndex}) => {
						const isCurrent = globalIndex === currentLineIndex;

						if (isCurrent && karaokeChars) {
							return (
								<Text key={globalIndex} bold>
									{'▶ '}
									{karaokeChars.map((cell, i) => (
										<Text key={i} color={cell.color}>
											{cell.char}
										</Text>
									))}
								</Text>
							);
						}

						return (
							<Text
								key={globalIndex}
								color={
									globalIndex < currentLineIndex
										? theme.colors.dim
										: theme.colors.text
								}
							>
								{'  '}
								{line.text || '♪'}
							</Text>
						);
					})}
				</Box>
			)}

			{/* Plain lyrics fallback */}
			{!loading && !lyrics?.synced && lyrics?.plain && (
				<Box flexDirection="column" paddingX={1}>
					{lyrics.plain
						.split('\n')
						.slice(0, maxLines)
						.map((line, i) => (
							<Text key={i} color={theme.colors.text}>
								{line || ' '}
							</Text>
						))}
				</Box>
			)}

			<Box>
				<Text color={theme.colors.dim}>
					Press <Text color={theme.colors.text}>l</Text> or{' '}
					<Text color={theme.colors.text}>Esc</Text> to go back
				</Text>
			</Box>
		</Box>
	);
}
