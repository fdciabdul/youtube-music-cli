import {afterEach, expect, test} from 'bun:test';

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
	'auth: parseCredentialsFileContent rejects invalid schema version',
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
	'auth: parseCredentialsFileContent rejects tokens without access_token',
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

test(
	'auth: AuthService getStatus and credential saving with strict permissions',
	async () => {
		const {getAuthService} =
			await import('../source/services/auth/auth.service.ts');
		const authService = getAuthService();

		// Save test credentials
		authService.saveCredentials({
			schemaVersion: 1,
			tokens: sampleTokens,
			signedInAt: new Date().toISOString(),
			accountName: 'Test Account',
		});

		const status = authService.getStatus();
		expect(status.loggedIn).toBe(true);
		expect(status.accountName).toBe('Test Account');
		expect(status.tokenValid).toBe(true);

		// Sign out should clear credentials
		await authService.signOut();
		const loggedOutStatus = authService.getStatus();
		expect(loggedOutStatus.loggedIn).toBe(false);
	},
	{timeout: 60_000},
);
