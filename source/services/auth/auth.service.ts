import type {AuthCredentials, AuthStatus} from '../../types/auth.types.ts';
import {CONFIG_DIR} from '../../utils/constants.ts';
import {formatError} from '../../utils/error.ts';
import {logger} from '../logger/logger.service.ts';
import {
	existsSync,
	readFileSync,
	writeFileSync,
	renameSync,
	unlinkSync,
	mkdirSync,
} from 'node:fs';
import {Innertube, type OAuth2Tokens} from 'youtubei.js';

const CREDENTIALS_FILE = `${CONFIG_DIR}/credentials.json`;
const SCHEMA_VERSION = 1;

export function parseCredentialsFileContent(
	data: unknown,
): AuthCredentials | null {
	if (!data || typeof data !== 'object') {
		return null;
	}

	const obj = data as Record<string, unknown>;

	if (obj['schemaVersion'] !== SCHEMA_VERSION) {
		return null;
	}

	const tokens = obj['tokens'];
	if (!tokens || typeof tokens !== 'object') {
		return null;
	}

	const t = tokens as Record<string, unknown>;
	if (typeof t['access_token'] !== 'string' || !t['access_token']) {
		return null;
	}

	if (typeof t['refresh_token'] !== 'string' || !t['refresh_token']) {
		return null;
	}

	return {
		schemaVersion: SCHEMA_VERSION,
		tokens: tokens as unknown as OAuth2Tokens,
		signedInAt: typeof obj['signedInAt'] === 'string' ? obj['signedInAt'] : '',
		accountName:
			typeof obj['accountName'] === 'string' ? obj['accountName'] : undefined,
	};
}

class AuthService {
	private credentials: AuthCredentials | null = null;
	private loading = false;

	constructor() {
		this.credentials = this.loadCredentials();
	}

	private loadCredentials(): AuthCredentials | null {
		try {
			if (!existsSync(CREDENTIALS_FILE)) {
				return null;
			}

			const data = readFileSync(CREDENTIALS_FILE, 'utf-8');
			const parsed = JSON.parse(data) as unknown;
			return parseCredentialsFileContent(parsed);
		} catch (error) {
			logger.warn('AuthService', 'Failed to load credentials', {
				error: formatError(error),
			});
			return null;
		}
	}

	saveCredentials(credentials: AuthCredentials): void {
		try {
			if (!existsSync(CONFIG_DIR)) {
				mkdirSync(CONFIG_DIR, {recursive: true, mode: 0o700});
			}

			const tempFile = `${CREDENTIALS_FILE}.tmp`;
			writeFileSync(tempFile, JSON.stringify(credentials, null, 2), {
				encoding: 'utf8',
				mode: 0o600,
			});

			let attempts = 0;
			const maxAttempts = 3;
			while (true) {
				try {
					renameSync(tempFile, CREDENTIALS_FILE);
					break;
				} catch (error: unknown) {
					const err = error as NodeJS.ErrnoException;
					attempts++;
					if (
						attempts >= maxAttempts ||
						(err.code !== 'EPERM' && err.code !== 'EBUSY')
					) {
						throw error;
					}
					try {
						if (existsSync(CREDENTIALS_FILE)) {
							unlinkSync(CREDENTIALS_FILE);
						}
					} catch {
						// Ignore
					}
				}
			}

			this.credentials = credentials;
			logger.info('AuthService', 'Credentials saved');
		} catch (error) {
			logger.error('AuthService', 'Failed to save credentials', {
				error: formatError(error),
			});
		}
	}

	getCachedCredentials(): OAuth2Tokens | null {
		return this.credentials?.tokens ?? null;
	}

	getStatus(): AuthStatus {
		if (!this.credentials) {
			return {loggedIn: false, tokenValid: false};
		}

		const hasTokens =
			this.credentials.tokens.access_token &&
			this.credentials.tokens.refresh_token;

		if (!hasTokens) {
			return {loggedIn: false, tokenValid: false};
		}

		const expiryDate = this.credentials.tokens.expiry_date;
		const expiryMs = expiryDate ? new Date(expiryDate).getTime() : 0;
		const isExpired = !isNaN(expiryMs) && expiryMs > 0 && expiryMs < Date.now();

		return {
			loggedIn: true,
			accountName: this.credentials.accountName,
			signedInAt: this.credentials.signedInAt,
			tokenValid: !isExpired,
		};
	}

	async signIn(): Promise<{
		success: boolean;
		verificationUrl?: string;
		userCode?: string;
		error?: string;
	}> {
		if (this.loading) {
			return {success: false, error: 'Login already in progress'};
		}

		this.loading = true;

		try {
			const innertube = await Innertube.create();

			const authPromise = new Promise<{
				success: boolean;
				error?: string;
			}>(resolve => {
				innertube.session.once('auth', ({credentials}) => {
					this.saveCredentials({
						schemaVersion: SCHEMA_VERSION,
						tokens: credentials,
						signedInAt: new Date().toISOString(),
					});
					resolve({success: true});
				});

				innertube.session.once('auth-error', err => {
					resolve({
						success: false,
						error: err instanceof Error ? err.message : String(err),
					});
				});
			});

			const deviceCode = await innertube.session.oauth.getDeviceAndUserCode();

			if (deviceCode.error_code) {
				return {
					success: false,
					error: `OAuth error: ${deviceCode.error_code}`,
				};
			}

			innertube.session.oauth.pollForAccessToken(deviceCode);

			const result = await authPromise;
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error('AuthService', 'Sign-in failed', {error: message});
			return {success: false, error: message};
		} finally {
			this.loading = false;
		}
	}

	async signOut(innertube?: Innertube): Promise<boolean> {
		try {
			if (this.credentials?.tokens) {
				if (innertube) {
					await innertube.session.signIn(this.credentials.tokens);
					await innertube.session.signOut();
				} else {
					const client = await Innertube.create();
					await client.session.signIn(this.credentials.tokens);
					await client.session.signOut();
				}
			}
		} catch (error) {
			logger.warn('AuthService', 'Token revocation failed (non-fatal)', {
				error: formatError(error),
			});
		}

		try {
			if (existsSync(CREDENTIALS_FILE)) {
				unlinkSync(CREDENTIALS_FILE);
			}
			this.credentials = null;
			logger.info('AuthService', 'Signed out, credentials removed');
			return true;
		} catch (error) {
			logger.error('AuthService', 'Failed to remove credentials', {
				error: formatError(error),
			});
			return false;
		}
	}

	async restoreSession(innertube: Innertube): Promise<boolean> {
		const tokens = this.getCachedCredentials();
		if (!tokens) {
			return false;
		}

		try {
			const expiryMs = tokens.expiry_date
				? new Date(tokens.expiry_date).getTime()
				: 0;
			const isExpiryValid = !isNaN(expiryMs) && expiryMs > 0;
			if (
				innertube.session.oauth.shouldRefreshToken() ||
				(isExpiryValid && expiryMs < Date.now())
			) {
				innertube.session.oauth.setTokens(tokens);
				await innertube.session.oauth.refreshAccessToken();
				const newTokens = innertube.session.oauth.oauth2_tokens;
				if (newTokens) {
					this.saveCredentials({
						schemaVersion: SCHEMA_VERSION,
						tokens: newTokens,
						signedInAt: this.credentials?.signedInAt ?? '',
						accountName: this.credentials?.accountName,
					});
				}
			} else {
				await innertube.session.signIn(tokens);
			}

			logger.info('AuthService', 'Session restored successfully');
			return true;
		} catch (error) {
			logger.warn('AuthService', 'Session restore failed', {
				error: formatError(error),
			});
			try {
				await this.signOut(innertube);
			} catch (signOutError) {
				logger.warn('AuthService', 'Cleanup sign-out also failed', {
					error: formatError(signOutError),
				});
			}
			return false;
		}
	}
}

let authServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
	if (!authServiceInstance) {
		authServiceInstance = new AuthService();
	}

	return authServiceInstance;
}
