// Pure helpers for karaoke-style lyric rendering: word timeline construction
// and per-character color interpolation. No React/Ink dependencies.
import type {ColorName, KaraokeColors} from '../types/theme.types.ts';
import type {LyricLine} from '../services/lyrics/lyrics.service.ts';

export const KARAOKE_TICK_MS = 60;
const CHARS_PER_SECOND = 15;
const MAX_LINE_DURATION_S = 6;
const MIN_LINE_DURATION_S = 0.4;
const WORD_MIN_DURATION_S = 0.05;
const GLOW_CHARS = 2.5;

export interface CharCell {
	char: string;
	color: string;
}

interface WordSpan {
	text: string;
	start: number;
	end: number;
}

// Approximate hex values for named ANSI theme colors, used to interpolate a
// smooth per-character gradient when a theme has no explicit karaoke colors.
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

export function lerpHexColor(from: string, to: string, t: number): string {
	const clampedT = Math.max(0, Math.min(1, t));
	const parse = (hex: string): number => Number.parseInt(hex.slice(1), 16);
	const a = parse(from);
	const b = parse(to);
	const ar = (a >> 16) & 0xff;
	const ag = (a >> 8) & 0xff;
	const ab = a & 0xff;
	const br = (b >> 16) & 0xff;
	const bg = (b >> 8) & 0xff;
	const bb = b & 0xff;
	const r = Math.round(ar + (br - ar) * clampedT);
	const g = Math.round(ag + (bg - ag) * clampedT);
	const bl = Math.round(ab + (bb - ab) * clampedT);
	return `#${[r, g, bl].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function pickHexColor(value: string | undefined, fallback: string): string {
	return value && HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

export function resolveKaraokeColors(theme: {
	karaoke?: KaraokeColors;
	colors: {primary: ColorName; accent: ColorName; text: ColorName};
}): KaraokeColors {
	const derived = {
		sung: HEX_BY_NAME[theme.colors.primary],
		peak: HEX_BY_NAME[theme.colors.accent],
		upcoming: HEX_BY_NAME[theme.colors.text],
	};
	if (!theme.karaoke) return derived;
	// Custom themes come from user config; malformed hex must not reach
	// chalk (NaN channels would produce broken ANSI or a render crash).
	return {
		sung: pickHexColor(theme.karaoke.sung, derived.sung),
		peak: pickHexColor(theme.karaoke.peak, derived.peak),
		upcoming: pickHexColor(theme.karaoke.upcoming, derived.upcoming),
	};
}

export function buildWordSpans(
	line: LyricLine,
	nextLineTime?: number,
): WordSpan[] {
	if (line.words && line.words.length > 0) {
		const words = line.words;
		const lineEnd =
			line.endTime ?? nextLineTime ?? line.time + MAX_LINE_DURATION_S;
		return words.map((word, index) => ({
			text: word.text,
			start: word.time,
			end: words[index + 1]?.time ?? lineEnd,
		}));
	}

	const text = line.text || '♪';
	const gapToNext =
		nextLineTime === undefined ? MAX_LINE_DURATION_S : nextLineTime - line.time;
	const naturalDuration = text.length / CHARS_PER_SECOND;
	const lineDuration = Math.max(
		MIN_LINE_DURATION_S,
		Math.min(
			naturalDuration,
			Math.max(gapToNext, MIN_LINE_DURATION_S),
			MAX_LINE_DURATION_S,
		),
	);

	const tokens = text.split(/(\s+)/).filter(token => token.length > 0);
	const totalChars = tokens.reduce((sum, token) => sum + token.length, 0) || 1;
	let consumedChars = 0;
	return tokens.map(token => {
		const start = line.time + (consumedChars / totalChars) * lineDuration;
		consumedChars += token.length;
		const end = line.time + (consumedChars / totalChars) * lineDuration;
		return {text: token, start, end};
	});
}

export function buildKaraokeCells(
	spans: WordSpan[],
	progress: number,
	colors: KaraokeColors,
): CharCell[] {
	const cells: CharCell[] = [];
	for (const span of spans) {
		const chars = [...span.text];
		const wordDuration = Math.max(WORD_MIN_DURATION_S, span.end - span.start);
		chars.forEach((char, index) => {
			const charTime = span.start + (index / chars.length) * wordDuration;
			const charStep = wordDuration / chars.length || 1;
			const delta = (progress - charTime) / charStep;

			let color: string;
			if (delta >= GLOW_CHARS) {
				color = colors.sung;
			} else if (delta <= -GLOW_CHARS) {
				color = colors.upcoming;
			} else if (delta >= 0) {
				color = lerpHexColor(colors.peak, colors.sung, delta / GLOW_CHARS);
			} else {
				color = lerpHexColor(colors.peak, colors.upcoming, -delta / GLOW_CHARS);
			}

			cells.push({char, color});
		});
	}
	return cells;
}
