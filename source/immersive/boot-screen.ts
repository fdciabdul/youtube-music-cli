import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parse} from 'yaml';

const YMC_ART = [
	' __      __  __       __   ______',
	'/  \\    /  |/  \\     /  | /      \\',
	'$$  \\  /$$/ $$  \\   /$$ |/$$$$$$  |',
	' $$  \\/$$/  $$$  \\ /$$$ |$$ |  $$/',
	'  $$  $$/   $$$$  /$$$$ |$$ |',
	'   $$$$/    $$ $$ $$/$$ |$$ |   __',
	'    $$ |    $$ |$$$/ $$ |$$ \\__/  |',
	'    $$ |    $$ | $/  $$ |$$    $$/',
	'    $$/     $$/      $$/  $$$$$$/',
];

const BOOT_TIMEOUT_MS = 1500;
const ANSI_RESET = '\x1B[0m';
const ANSI_GREEN = '\x1B[32m';
const ANSI_DIM = '\x1B[2m';
const ANSI_HIDE_CURSOR = '\x1B[?25l';
const ANSI_SHOW_CURSOR = '\x1B[?25h';
const ANSI_CLEAR = '\x1B[2J\x1B[H';
const ANSI_ALT_BUFFER_IN = '\x1B[?1049h';
const ANSI_ALT_BUFFER_OUT = '\x1B[?1049l';

function getSponsorLine(): string {
	const root = process.cwd();
	const fundingPath = join(root, '.github', 'FUNDING.yml');
	const githubUrl = 'https://github.com/sponsors/involvex';

	try {
		const content = readFileSync(fundingPath, 'utf8');
		const doc = parse(content) as Record<string, unknown>;

		const github = doc.github;
		if (Array.isArray(github) && github.length > 0) {
			return `Sponsor: https://github.com/sponsors/${github[0]}`;
		}
	} catch {
		// fall through
	}

	return `Sponsor: ${githubUrl}`;
}

export async function showImmersiveBootScreen(): Promise<void> {
	if (process.platform !== 'win32') {
		return;
	}

	if (!process.stdin.isTTY) {
		return;
	}

	const width = process.stdout.columns || 120;
	const artLines = width < 30 ? ['YMC'] : YMC_ART;
	const sponsor = getSponsorLine();
	const contentHeight = artLines.length + 2;
	const height = process.stdout.rows || 30;
	const verticalPad = Math.max(0, Math.floor((height - contentHeight) / 2) - 1);

	let stdinRawMode = false;
	let stdinListener: ((data: string) => void) | null = null;
	let resolved = false;

	const resolve = () => {
		if (resolved) return;
		resolved = true;

		process.stdout.write(ANSI_SHOW_CURSOR);
		if (stdinRawMode) {
			process.stdin.setRawMode(false);
		}
		if (stdinListener) {
			process.stdin.off('data', stdinListener);
		}
		process.stdout.write(ANSI_ALT_BUFFER_OUT);
	};

	try {
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.setEncoding('utf8');
		stdinRawMode = true;

		process.stdout.write(ANSI_ALT_BUFFER_IN);
		process.stdout.write(ANSI_HIDE_CURSOR);
		process.stdout.write(ANSI_CLEAR);

		for (let i = 0; i < verticalPad; i++) {
			process.stdout.write('\r\n');
		}

		for (const line of artLines) {
			process.stdout.write(`${ANSI_GREEN}${line}${ANSI_RESET}\r\n`);
		}

		process.stdout.write(`${ANSI_DIM}${sponsor}${ANSI_RESET}\r\n`);

		await new Promise<void>(res => {
			resolved = false;
			const timeout = setTimeout(() => {
				resolve();
				res();
			}, BOOT_TIMEOUT_MS);

			stdinListener = () => {
				clearTimeout(timeout);
				resolve();
				res();
			};

			process.stdin.on('data', stdinListener);
		});
	} catch {
		resolve();
	}
}
