import {existsSync, readFileSync} from 'node:fs';
import {logger} from '../logger/logger.service.ts';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import type {CookiesFromBrowser} from '../player/ytdl-cookies.ts';

const execFileAsync = promisify(execFile);

/**
 * Parse a Netscape cookies.txt file into a cookie header string.
 * Format: domain, flag, path, secure, expiry, name, value
 */
function parseNetscapeCookies(content: string): string {
	const cookies: string[] = [];
	const lines = content.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		const parts = trimmed.split('\t');
		if (parts.length < 7) {
			continue;
		}

		const name = parts[5];
		const value = parts[6];

		cookies.push(`${name}=${value}`);
	}

	return cookies.join('; ');
}

/**
 * Parse a browser cookie file into a cookie header string.
 */
export function parseCookiesFile(filePath: string): string | null {
	try {
		if (!existsSync(filePath)) {
			logger.warn('CookieUtils', `Cookie file not found: ${filePath}`);
			return null;
		}

		const content = readFileSync(filePath, 'utf8');

		// Check if this is a Netscape cookies.txt format
		const lines = content.split('\n');
		for (const line of lines.slice(0, 5)) {
			if (
				line.includes('# Netscape HTTP Cookie File') ||
				line.includes('#HttpOnly_')
			) {
				return parseNetscapeCookies(content);
			}
		}

		// If it's JSON or some other format, try to parse it as a cookie header directly
		if (content.includes('=')) {
			return content.trim();
		}

		logger.warn('CookieUtils', 'Unrecognized cookie file format');
		return null;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.warn('CookieUtils', `Failed to read cookie file: ${message}`);
		return null;
	}
}

/**
 * Use yt-dlp to extract cookies from a browser.
 * yt-dlp supports: chrome, firefox, edge, brave, opera, vivaldi, safari, chromium
 * Returns a Netscape cookies.txt content or null.
 */
async function extractBrowserCookiesViaYtdlp(
	browser: CookiesFromBrowser,
): Promise<string | null> {
	try {
		// Use yt-dlp to extract cookies from browser to a temp file
		// yt-dlp supports: chrome, firefox, edge, brave, opera, vivaldi, safari, chromium
		const tmpFile = `/tmp/ymc-yt-cookies-${Date.now()}.txt`;

		// Try with --cookies-from-browser first
		const {stderr} = await execFileAsync(
			'yt-dlp',
			[
				'--cookies-from-browser',
				browser,
				'--cookies',
				tmpFile,
				'--skip-download',
				'--no-warnings',
				'https://www.youtube.com', // Dummy URL to just extract cookies
			],
			{timeout: 15000},
		);

		// If yt-dlp succeeded, read the cookie file
		if (existsSync(tmpFile)) {
			const content = readFileSync(tmpFile, 'utf8');
			// Clean up
			try {
				const {unlinkSync} = await import('node:fs');
				unlinkSync(tmpFile);
			} catch {
				// Ignore cleanup errors
			}
			return content;
		}

		// If yt-dlp failed, try to parse stderr for useful info
		if (stderr && !stderr.includes('WARNING')) {
			logger.warn('CookieUtils', `yt-dlp stderr: ${stderr.slice(0, 200)}`);
		}

		return null;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.warn(
			'CookieUtils',
			`yt-dlp cookie extraction failed for ${browser}: ${message}`,
		);
		return null;
	}
}

/**
 * Parse browser cookies from a browser's cookie storage.
 * Uses yt-dlp for cross-browser cookie extraction.
 */
export async function parseBrowserCookies(
	browser: CookiesFromBrowser,
): Promise<string | null> {
	// Supported browsers for yt-dlp
	const supportedBrowsers: CookiesFromBrowser[] = [
		'chrome',
		'firefox',
		'edge',
		'brave',
	];

	if (!supportedBrowsers.includes(browser)) {
		logger.warn(
			'CookieUtils',
			`Browser '${browser}' not supported for cookie extraction`,
		);
		return null;
	}

	// Use yt-dlp to extract cookies from the browser
	const cookieContent = await extractBrowserCookiesViaYtdlp(browser);
	if (cookieContent) {
		const result = parseNetscapeCookies(cookieContent);
		if (result) {
			return result;
		}
	}

	logger.warn(
		'CookieUtils',
		`Failed to extract cookies from ${browser} via yt-dlp`,
	);
	return null;
}
