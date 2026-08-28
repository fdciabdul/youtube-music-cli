# YouTube Music Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add YouTube Music account authentication via OAuth2 Device Flow to enable personalized features (library access, ad-free playback for Premium users).

**Architecture:** A new singleton `AuthService` manages the OAuth2 lifecycle using `youtubei.js`'s built-in `Session.oauth` flow. Credentials are persisted to `~/.youtube-music-cli/credentials.json`. The existing `Innertube` client singleton in `api.ts` is updated to restore sessions from cached credentials on startup. CLI commands (`ymc login`, `ymc logout`, `ymc whoami`) handle authentication outside the TUI. A TUI view (`LOGIN`) provides in-app login/logout/status.

**Tech Stack:** TypeScript, Bun runtime, `youtubei.js` v18 (OAuth2 Device Flow), React/Ink (TUI), `bun:test`

---

## Architecture Decisions

### Why a separate `AuthService` instead of modifying `api.ts` directly?

- Separation of concerns: auth lifecycle vs. music API
- Reusable by Ink TUI, immersive mode, and CLI commands
- Follows the project's singleton service pattern (`getConfigService()`, `getMusicService()`, etc.)

### Why not use `UniversalCache` from youtubei.js?

- `UniversalCache` persists session/player data but NOT OAuth tokens reliably across versions
- Explicit JSON file gives full control over credential lifecycle (migration, revocation)
- Matches the project's pattern of explicit file-based persistence (favorites.json, player-state.json, history.json)

### Where are credentials stored?

- `~/.youtube-music-cli/credentials.json` — mirrors the pattern of `favorites.json`, `player-state.json`
- Uses the same atomic-write pattern (write to `.tmp`, rename) as `ConfigService`

---

## File Map

| Action | File                                                                       |
| ------ | -------------------------------------------------------------------------- |
| Create | `source/types/auth.types.ts`                                               |
| Create | `source/services/auth/auth.service.ts`                                     |
| Create | `source/components/auth/LoginView.tsx`                                     |
| Create | `tests/auth.test.js`                                                       |
| Modify | `source/utils/constants.ts` — add `VIEW.LOGIN`                             |
| Modify | `source/services/youtube-music/api.ts` — auth-aware `getClient()`          |
| Modify | `source/cli.tsx` — add `login`, `logout`, `whoami` commands                |
| Modify | `source/main.tsx` — add `LoginView` routing                                |
| Modify | `source/types/navigation.types.ts` — no changes needed (views are strings) |
| Modify | `source/components/settings/Settings.tsx` — add Account row                |
| Modify | `source/immersive/settings/settings-items.ts` — add Account row            |
| Modify | `source/main.tsx` — auto-login on startup                                  |

---

## Task 1: Auth Types

**Files:**

- Create: `source/types/auth.types.ts`

**Step 1: Create auth types**

```typescript
// Authentication type definitions
import type {OAuth2Tokens} from 'youtubei.js';

export interface AuthCredentials {
	schemaVersion: number;
	tokens: OAuth2Tokens;
	signedInAt: string;
	accountName?: string;
}

export interface AuthStatus {
	loggedIn: boolean;
	accountName?: string;
	signedInAt?: string;
	tokenValid: boolean;
}
```

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS (no errors)

---

## Task 2: AuthService

**Files:**

- Create: `source/services/auth/auth.service.ts`
- Test: `tests/auth.test.js`

**Step 1: Write tests for credential persistence**

```javascript
// tests/auth.test.js
import {afterEach, expect, test} from 'bun:test';
import {mkdtempSync, rmSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const __fileTeardowns = [];
afterEach(() => {
	while (__fileTeardowns.length) {
		const fn = __fileTeardowns.pop();
		fn();
	}
});

const sampleTokens = {
	access_token: 'test-access-token',
	refresh_token: 'test-refresh-token',
	expiry_date: new Date(Date.now() + 3600_000).toISOString(),
	scope: 'https://www.googleapis.com/auth/youtube',
	token_type: 'Bearer',
	client: {
		client_id: 'test-client-id',
		client_secret: 'test-client-secret',
	},
};

test(
	'auth: parseCredentialsFileContent accepts valid payload',
	async () => {
		const {parseCredentialsFileContent} =
			await import('../source/services/auth/auth.service.ts');

		const result = parseCredentialsFileContent({
			schemaVersion: 1,
			tokens: sampleTokens,
			signedInAt: '2026-01-01T00:00:00.000Z',
		});

		expect(result).not.toBeNull();
		expect(result?.tokens.access_token).toBe('test-access-token');
	},
	{timeout: 60_000},
);

test(
	'auth: parseCredentialsFileContent rejects expired schema',
	async () => {
		const {parseCredentialsFileContent} =
			await import('../source/services/auth/auth.service.ts');

		const result = parseCredentialsFileContent({
			schemaVersion: 99,
			tokens: sampleTokens,
		});

		expect(result).toBeNull();
	},
	{timeout: 60_000},
);

test(
	'auth: parseCredentialsFileContent rejects invalid tokens',
	async () => {
		const {parseCredentialsFileContent} =
			await import('../source/services/auth/auth.service.ts');

		const result = parseCredentialsFileContent({
			schemaVersion: 1,
			tokens: {access_token: ''},
		});

		expect(result).toBeNull();
	},
	{timeout: 60_000},
);

test(
	'auth: parseCredentialsFileContent returns null for garbage input',
	async () => {
		const {parseCredentialsFileContent} =
			await import('../source/services/auth/auth.service.ts');

		expect(parseCredentialsFileContent(null)).toBeNull();
		expect(parseCredentialsFileContent('string')).toBeNull();
		expect(parseCredentialsFileContent(42)).toBeNull();
	},
	{timeout: 60_000},
);
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/auth.test.js`
Expected: FAIL — module not found

**Step 3: Implement AuthService**

```typescript
// source/services/auth/auth.service.ts
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

	private saveCredentials(credentials: AuthCredentials): void {
		try {
			if (!existsSync(CONFIG_DIR)) {
				mkdirSync(CONFIG_DIR, {recursive: true});
			}

			const tempFile = `${CREDENTIALS_FILE}.tmp`;
			writeFileSync(tempFile, JSON.stringify(credentials, null, 2), 'utf8');

			// Atomic rename with retry for Windows
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

		// Check if token is expired
		const expiryDate = this.credentials.tokens.expiry_date;
		const isExpired = expiryDate
			? new Date(expiryDate).getTime() < Date.now()
			: false;

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

			// Register event handlers before triggering auth
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

			// Trigger the device code flow
			const deviceCode = await innertube.session.oauth.getDeviceAndUserCode();

			if (deviceCode.error_code) {
				return {
					success: false,
					error: `OAuth error: ${deviceCode.error_code}`,
				};
			}

			// Start polling for token (this runs in background)
			innertube.session.oauth.pollForAccessToken(deviceCode);

			// Return device code info for user display
			// Wait for auth result
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

	async signOut(): Promise<boolean> {
		try {
			// Try to revoke the token
			if (this.credentials?.tokens) {
				const innertube = await Innertube.create();
				await innertube.session.signIn(this.credentials.tokens);
				await innertube.session.signOut();
			}
		} catch (error) {
			logger.warn('AuthService', 'Token revocation failed (non-fatal)', {
				error: formatError(error),
			});
		}

		// Remove local credentials regardless
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

	/**
	 * Attempt to restore session from cached credentials.
	 * Returns true if session was restored successfully.
	 */
	async restoreSession(innertube: Innertube): Promise<boolean> {
		const tokens = this.getCachedCredentials();
		if (!tokens) {
			return false;
		}

		try {
			// Check if refresh needed
			if (
				innertube.session.oauth.shouldRefreshToken() ||
				new Date(tokens.expiry_date ?? 0).getTime() < Date.now()
			) {
				// Set tokens first, then refresh
				innertube.session.oauth.setTokens(tokens);
				await innertube.session.oauth.refreshAccessToken();
				// Save refreshed tokens
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
			// Clear invalid credentials
			await this.signOut();
			return false;
		}
	}
}

// Singleton instance
let authServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
	if (!authServiceInstance) {
		authServiceInstance = new AuthService();
	}

	return authServiceInstance;
}
```

**Step 4: Run tests**

Run: `bun test tests/auth.test.js`
Expected: PASS

**Step 5: Typecheck**

Run: `bun run typecheck`
Expected: PASS

---

## Task 3: Add LOGIN View Constant

**Files:**

- Modify: `source/utils/constants.ts` — add `LOGIN: 'login'` to `VIEW` object

**Step 1: Add the view constant**

In `source/utils/constants.ts`, add `LOGIN: 'login'` to the `VIEW` object (alphabetical order, after `LYRICS`):

```typescript
LOGIN: 'login',
```

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

---

## Task 4: Auth-Aware Innertube Client

**Files:**

- Modify: `source/services/youtube-music/api.ts`

**Step 1: Update `getClient()` to restore auth**

Replace the existing `getClient()` function in `api.ts`:

```typescript
async function getClient() {
	if (!ytClient) {
		Log.setLevel(Log.Level.ERROR);
		const proxy = getConfigService().getProxy();
		if (proxy) {
			process.env.HTTPS_PROXY = proxy;
			process.env.HTTP_PROXY = proxy;
		}

		ytClient = await Innertube.create();

		// Restore authenticated session if credentials exist
		try {
			const {getAuthService} = await import('../auth/auth.service.ts');
			const authService = getAuthService();
			await authService.restoreSession(ytClient);
		} catch {
			// Auth restoration is non-fatal — continue unauthenticated
		}
	}
	return ytClient;
}
```

**Step 2: Add a function to recreate the client (for after login/logout)**

Add after the `getClient()` function:

```typescript
/**
 * Reset the Innertube client so the next call to getClient()
 * creates a fresh session (with or without auth).
 */
export function resetClient(): void {
	ytClient = null;
}
```

**Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS

---

## Task 5: CLI Login/Logout/Whoami Commands

**Files:**

- Modify: `source/cli.tsx`

**Step 1: Add help text for auth commands**

In the `cli.tsx` help string, add a new section after the Config Commands:

```
🔐 Auth Commands
  $ youtube-music-cli login                Sign in to YouTube Music
  $ youtube-music-cli logout               Sign out and remove credentials
  $ youtube-music-cli whoami               Show current account status
```

**Step 2: Add command handlers**

In the `cli.tsx` command handling section (after the `config doctor` handler, before the main flow), add:

```typescript
// Handle auth commands
if (command === 'login') {
	const {getAuthService} = await import('./services/auth/auth.service.ts');
	const authService = getAuthService();
	const status = authService.getStatus();

	if (status.loggedIn) {
		const accountLabel = status.accountName ?? 'YouTube account';
		console.log(`Already signed in as: ${accountLabel}`);
		if (!status.tokenValid) {
			console.log('(Token expired — will refresh on next API call)');
		}
		process.exit(0);
	}

	console.log('Starting YouTube Music login...');
	console.log('');
	console.log('A device code will be displayed below.');
	console.log('Open the verification URL and enter the code to authorize.');
	console.log('');

	const result = await authService.signIn();

	if (result.success) {
		console.log('');
		console.log('✓ Successfully signed in to YouTube Music!');
		process.exit(0);
	} else {
		console.error(`\n✗ Login failed: ${result.error ?? 'Unknown error'}`);
		process.exit(1);
	}
}

if (command === 'logout') {
	const {getAuthService} = await import('./services/auth/auth.service.ts');
	const authService = getAuthService();
	const status = authService.getStatus();

	if (!status.loggedIn) {
		console.log('Not signed in.');
		process.exit(0);
	}

	const success = await authService.signOut();
	if (success) {
		console.log('✓ Signed out successfully.');
	} else {
		console.error('✗ Failed to sign out.');
		process.exit(1);
	}
}

if (command === 'whoami') {
	const {getAuthService} = await import('./services/auth/auth.service.ts');
	const authService = getAuthService();
	const status = authService.getStatus();

	if (!status.loggedIn) {
		console.log('Not signed in. Run `ymc login` to authenticate.');
		process.exit(0);
	}

	console.log(`Account: ${status.accountName ?? 'YouTube account'}`);
	console.log(`Signed in: ${status.signedInAt ?? 'Unknown'}`);
	console.log(
		`Token valid: ${status.tokenValid ? 'Yes' : 'Expired (will refresh)'}`,
	);
	process.exit(0);
}
```

**Step 3: Typecheck + Lint**

Run: `bun run typecheck && bun run lint:fix`
Expected: PASS

---

## Task 6: Ink TUI LoginView Component

**Files:**

- Create: `source/components/auth/LoginView.tsx`
- Modify: `source/main.tsx` — route to `LoginView`

**Step 1: Create LoginView component**

```typescript
// source/components/auth/LoginView.tsx
import {Box, Text} from 'ink';
import {useTheme} from '../../hooks/useTheme.ts';
import {useNavigation} from '../../hooks/useNavigation.ts';
import {useKeyBinding} from '../../hooks/useKeyboard.ts';
import {resolveKeybinding} from '../../utils/keybinding-resolver.ts';
import {useState, useEffect, useCallback} from 'react';
import {getAuthService} from '../../services/auth/auth.service.ts';
import {resetClient} from '../../services/youtube-music/api.ts';

type LoginState = 'idle' | 'pending' | 'authenticating' | 'success' | 'error';

export default function LoginView() {
	const {theme} = useTheme();
	const {dispatch} = useNavigation();
	const authService = getAuthService();
	const status = authService.getStatus();

	const [loginState, setLoginState] = useState<LoginState>(
		status.loggedIn ? 'idle' : 'idle',
	);
	const [deviceCode, setDeviceCode] = useState<{
		verificationUrl: string;
		userCode: string;
	} | null>(null);
	const [error, setError] = useState<string | null>(null);

	useKeyBinding(resolveKeybinding('BACK'), () => {
		dispatch({category: 'GO_BACK'});
	});

	const handleLogin = useCallback(async () => {
		if (status.loggedIn) {
			return;
		}

		setLoginState('pending');
		setError(null);

		// We need a custom approach since signIn() blocks.
		// Instead, we use the auth service's internal flow.
		try {
			const {Innertube} = await import('youtubei.js');
			const innertube = await Innertube.create();

			const authPromise = new Promise<{
				success: boolean;
				error?: string;
			}>(resolve => {
				innertube.session.once('auth', async ({credentials}) => {
					const {writeFileSync, mkdirSync, renameSync, existsSync} =
						await import('node:fs');
					const {CONFIG_DIR} = await import('../../utils/constants.ts');

					if (!existsSync(CONFIG_DIR)) {
						mkdirSync(CONFIG_DIR, {recursive: true});
					}

					const credentialsData = {
						schemaVersion: 1,
						tokens: credentials,
						signedInAt: new Date().toISOString(),
					};

					const tempFile = `${CONFIG_DIR}/credentials.json.tmp`;
					writeFileSync(
						tempFile,
						JSON.stringify(credentialsData, null, 2),
						'utf8',
					);
					renameSync(tempFile, `${CONFIG_DIR}/credentials.json`);

					setLoginState('success');
					resolve({success: true});
				});

				innertube.session.once('auth-error', err => {
					setLoginState('error');
					setError(
						err instanceof Error ? err.message : 'Authentication failed',
					);
					resolve({success: false, error: String(err)});
				});
			});

			const deviceCode =
				await innertube.session.oauth.getDeviceAndUserCode();

			if (deviceCode.error_code) {
				setLoginState('error');
				setError(`OAuth error: ${deviceCode.error_code}`);
				return;
			}

			setDeviceCode({
				verificationUrl: deviceCode.verification_url,
				userCode: deviceCode.user_code,
			});
			setLoginState('authenticating');

			innertube.session.oauth.pollForAccessToken(deviceCode);
			await authPromise;
		} catch (err) {
			setLoginState('error');
			setError(err instanceof Error ? err.message : 'Login failed');
		}
	}, [status.loggedIn]);

	const handleLogout = useCallback(async () => {
		const success = await authService.signOut();
		if (success) {
			resetClient();
			setLoginState('idle');
			setDeviceCode(null);
		}
	}, [authService]);

	// Auto-start login flow when entering the view
	useEffect(() => {
		if (!status.loggedIn && loginState === 'idle') {
			void handleLogin();
		}
	}, [status.loggedIn, loginState, handleLogin]);

	return (
		<Box flexDirection="column" paddingX={1} paddingY={1}>
			<Box marginBottom={1}>
				<Text color={theme.colors.primary} bold>
					Account
				</Text>
			</Box>

			{status.loggedIn ? (
				<Box flexDirection="column" gap={1}>
					<Box>
						<Text color={theme.colors.text}>
							Signed in as:{' '}
							<Text bold color={theme.colors.primary}>
								{status.accountName ?? 'YouTube account'}
							</Text>
						</Text>
					</Box>
					{!status.tokenValid && (
						<Box>
							<Text color={theme.colors.warning ?? 'yellow'}>
								Token expired (will refresh automatically)
							</Text>
						</Box>
					)}
					<Box>
						<Text color={theme.colors.dim}>
							Press{' '}
							<Text bold color={theme.colors.primary}>
								L
							</Text>{' '}
							to sign out, Esc to go back
						</Text>
					</Box>
					{/* Listen for L key for logout */}
					<LogoutKeyHandler onLogout={handleLogout} />
				</Box>
			) : loginState === 'authenticating' && deviceCode ? (
				<Box flexDirection="column" gap={1}>
					<Box>
						<Text color={theme.colors.text}>
							Open{' '}
							<Text bold color={theme.colors.primary}>
								{deviceCode.verificationUrl}
							</Text>{' '}
							in your browser
						</Text>
					</Box>
					<Box>
						<Text color={theme.colors.text}>Enter this code:</Text>
					</Box>
					<Box
						justifyContent="center"
						borderStyle="round"
						borderColor={theme.colors.primary}
						paddingX={2}
						paddingY={1}
					>
						<Text
							color={theme.colors.primary}
							bold
							fontSize={2}
						>
							{deviceCode.userCode}
						</Text>
					</Box>
					<Box marginTop={1}>
						<Text color={theme.colors.dim}>
							Waiting for authorization...
						</Text>
					</Box>
				</Box>
			) : loginState === 'success' ? (
				<Box flexDirection="column" gap={1}>
					<Box>
						<Text color={theme.colors.success ?? 'green'} bold>
							✓ Successfully signed in!
						</Text>
					</Box>
					<Box>
						<Text color={theme.colors.dim}>Press any key to continue</Text>
					</Box>
				</Box>
			) : loginState === 'error' ? (
				<Box flexDirection="column" gap={1}>
					<Box>
						<Text color={theme.colors.error ?? 'red'} bold>
							✗ Login failed
						</Text>
					</Box>
					{error && (
						<Box>
							<Text color={theme.colors.dim}>{error}</Text>
						</Box>
					)}
					<Box>
						<Text color={theme.colors.dim}>
							Press{' '}
							<Text bold color={theme.colors.primary}>
								R
							</Text>{' '}
							to retry, Esc to go back
						</Text>
					</Box>
				</Box>
			) : (
				<Box>
					<Text color={theme.colors.dim}>Starting login...</Text>
				</Box>
			)}

			<Box marginTop={1}>
				<Text color={theme.colors.dim}>
					Esc to go back
				</Text>
			</Box>
		</Box>
	);
}

// Helper component for logout key binding
function LogoutKeyHandler({onLogout}: {onLogout: () => void}) {
	useKeyBinding(['l'], onLogout);
	return null;
}
```

**Step 2: Route to LoginView in main.tsx**

In `source/main.tsx`, import `LoginView` and add routing. Find the section where views are rendered (the big switch/conditional) and add:

```typescript
import LoginView from './components/auth/LoginView.tsx';
```

And in the view routing (where other views are conditionally rendered), add a case for `VIEW.LOGIN`:

```typescript
{currentView === VIEW.LOGIN && <LoginView />}
```

**Step 3: Typecheck + Lint**

Run: `bun run typecheck && bun run lint:fix`
Expected: PASS

---

## Task 7: Settings Integration — Add Account Row

**Files:**

- Modify: `source/components/settings/Settings.tsx` — add "Account" row
- Modify: `source/immersive/settings/settings-items.ts` — add "Account" row

**Step 1: Add Account row to Ink Settings**

In `source/components/settings/Settings.tsx`:

1. Add `'Account'` to the `SETTINGS_ITEMS` array (first position, before `'Stream Quality'`)

2. Add rendering for the Account row in the component JSX (at position index 0):

```tsx
{
	/* Account */
}
<Box paddingX={1}>
	<Text
		backgroundColor={selectedIndex === 0 ? theme.colors.primary : undefined}
		color={selectedIndex === 0 ? theme.colors.background : theme.colors.text}
		bold={selectedIndex === 0}
	>
		Account →
	</Text>
</Box>;
```

3. Handle Enter key on Account row — navigate to `VIEW.LOGIN`

**Step 2: Add Account row to Immersive Settings**

In `source/immersive/settings/settings-items.ts`:

1. Add a row entry that navigates to login (using the `'navigate'` kind)

2. Adjust `IMMERSIVE_SETTINGS_COUNT` from 28 to 29

3. Update `getSettingsRowKind()` — make index 0 return `'navigate'`

**Step 3: Typecheck + Lint**

Run: `bun run typecheck && bun run lint:fix`
Expected: PASS

---

## Task 8: Auto-Login on Startup

**Files:**

- Modify: `source/main.tsx` — restore session on app start

**Step 1: Add session restoration in Initializer**

In `source/main.tsx`, inside the `Initializer` component's `useEffect`, add:

```typescript
// Restore YouTube Music auth session on startup
useEffect(() => {
	void (async () => {
		try {
			const {getAuthService} = await import('./services/auth/auth.service.ts');
			const authService = getAuthService();
			if (authService.getStatus().loggedIn) {
				// Client will be created with auth when first used
				logger.info('App', 'Authenticated session available');
			}
		} catch {
			// Non-fatal
		}
	})();
}, []);
```

Note: This is lightweight — the actual `Innertube.create()` + `signIn()` happens lazily in `getClient()`. This just logs that auth is available.

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

---

## Task 9: Immersive Mode Login Integration

**Files:**

- Modify: `source/immersive/immersive-app.ts` — add login/logout handling

**Step 1: Add login handler to immersive key handling**

In the immersive app's keyboard handling (where settings key `Ctrl+,` is handled), add a check for auth status and a way to trigger login/logout from the immersive overlay.

This is a lightweight integration — the immersive mode can display auth status in the settings overlay and offer logout. Full login still goes through CLI or Ink TUI (complex OAuth device flow doesn't fit well in raw terminal mode).

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

---

## Task 10: Run Full Quality Suite

**Step 1: Format**

Run: `bun run format`
Expected: PASS

**Step 2: Lint**

Run: `bun run lint:fix`
Expected: PASS

**Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Tests**

Run: `bun test`
Expected: PASS

---

## Commit Strategy

1. `feat(auth): add auth types and credential persistence` — Tasks 1-2
2. `feat(auth): add auth-aware Innertube client` — Tasks 3-4
3. `feat(auth): add login/logout/whoami CLI commands` — Task 5
4. `feat(auth): add TUI LoginView component` — Tasks 6-8
5. `feat(auth): integrate auth into settings and immersive mode` — Task 9
6. `chore: run format, lint, and typecheck` — Task 10

---

## Known Limitations & Future Work

1. **Device Code Flow UX in Ink TUI**: The login view shows the verification URL and code. The user must open a browser separately. Future: auto-open browser with `open`/`start` command.

2. **Account Name Display**: The auth flow doesn't directly return the account name. Future: use `innertube.account.getInfo()` after login to populate `accountName`.

3. **Multi-Account**: `youtubei.js` supports `account_index` for multiple accounts. Future: add account switching.

4. **Token Refresh Background Worker**: Currently refreshes on next API call. Future: background refresh timer.

5. **Immersive Mode Login**: Full device code flow deferred to CLI/TUI. Immersive shows status only.
