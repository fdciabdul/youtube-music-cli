export type CookiesFromBrowser = 'chrome' | 'firefox' | 'edge' | 'brave';

export type CookieOptions = {
	cookiesFile?: string;
	cookiesFromBrowser?: CookiesFromBrowser;
};

export const COOKIES_BOT_HINT =
	'YouTube blocked playback (bot check). In Settings, set Cookies From Browser (e.g. Edge) or Cookies File, then retry.';

export function resolveCookieOptions(options: CookieOptions): CookieOptions {
	const file = options.cookiesFile?.trim();
	if (file) {
		return {cookiesFile: file};
	}

	if (options.cookiesFromBrowser) {
		return {cookiesFromBrowser: options.cookiesFromBrowser};
	}

	return {};
}

/** Prefer cookiesFile over cookiesFromBrowser when both are set. */
export function appendMpvYtdlCookieArgs(
	mpvArgs: string[],
	options: CookieOptions,
): void {
	const resolved = resolveCookieOptions(options);
	if (resolved.cookiesFile) {
		mpvArgs.push(`--ytdl-raw-options-append=cookies=${resolved.cookiesFile}`);
		return;
	}

	if (resolved.cookiesFromBrowser) {
		mpvArgs.push(
			`--ytdl-raw-options-append=cookies-from-browser=${resolved.cookiesFromBrowser}`,
		);
	}
}

export function appendYtDlpCookieArgs(
	args: string[],
	options: CookieOptions,
): void {
	const resolved = resolveCookieOptions(options);
	if (resolved.cookiesFile) {
		args.push('--cookies', resolved.cookiesFile);
		return;
	}

	if (resolved.cookiesFromBrowser) {
		args.push('--cookies-from-browser', resolved.cookiesFromBrowser);
	}
}

export function isYouTubeBotCheckError(message: string): boolean {
	const lower = message.toLowerCase();
	return (
		lower.includes('sign in to confirm') ||
		lower.includes("you're not a bot") ||
		lower.includes('not a bot') ||
		(lower.includes('confirm you') && lower.includes('bot'))
	);
}

export function formatPlaybackErrorMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	if (isYouTubeBotCheckError(message)) {
		return COOKIES_BOT_HINT;
	}

	return message;
}

/** Cycle Off → Edge (Windows) / Chrome (else) → other browsers → Off. */
export function nextCookiesFromBrowser(
	current: CookiesFromBrowser | undefined,
): CookiesFromBrowser | undefined {
	const order: Array<CookiesFromBrowser | undefined> =
		process.platform === 'win32'
			? [undefined, 'edge', 'chrome', 'firefox', 'brave']
			: [undefined, 'chrome', 'firefox', 'brave', 'edge'];
	const index = order.indexOf(current);
	return order[(index === -1 ? 0 : index + 1) % order.length];
}

export function formatCookiesFromBrowserLabel(
	value: CookiesFromBrowser | undefined,
): string {
	return value ? value.toUpperCase() : 'OFF';
}
