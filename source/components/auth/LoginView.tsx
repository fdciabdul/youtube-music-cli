// YouTube Music account login/logout view
import {Box, Text} from 'ink';
import {useTheme} from '../../hooks/useTheme.ts';
import {useNavigation} from '../../hooks/useNavigation.ts';
import {useKeyBinding} from '../../hooks/useKeyboard.ts';
import {resolveKeybinding} from '../../utils/keybinding-resolver.ts';
import {useState, useEffect, useCallback, useRef} from 'react';
import {getAuthService} from '../../services/auth/auth.service.ts';
import {resetClient} from '../../services/youtube-music/api.ts';

type LoginState = 'idle' | 'pending' | 'authenticating' | 'success' | 'error';

export default function LoginView() {
	const {theme} = useTheme();
	const {dispatch} = useNavigation();
	const authService = getAuthService();
	const status = authService.getStatus();

	const [loginState, setLoginState] = useState<LoginState>('idle');
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

		try {
			const {Innertube} = await import('youtubei.js');
			const innertube = await Innertube.create();

			const authPromise = new Promise<{
				success: boolean;
				error?: string;
			}>(resolve => {
				innertube.session.once('auth', ({credentials}) => {
					getAuthService().saveCredentials({
						schemaVersion: 1,
						tokens: credentials,
						signedInAt: new Date().toISOString(),
					});

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

			const deviceCode = await innertube.session.oauth.getDeviceAndUserCode();

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

	const loginInitiated = useRef(false);

	useEffect(() => {
		if (!status.loggedIn && loginState === 'idle' && !loginInitiated.current) {
			loginInitiated.current = true;
			void handleLogin();
		}
	}, [status.loggedIn, loginState, handleLogin]);

	useKeyBinding(['l'], () => {
		if (status.loggedIn && loginState === 'idle') {
			void handleLogout();
		}
	});

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
							<Text color="yellow">
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
						<Text color={theme.colors.primary} bold>
							{deviceCode.userCode}
						</Text>
					</Box>
					<Box marginTop={1}>
						<Text color={theme.colors.dim}>Waiting for authorization...</Text>
					</Box>
				</Box>
			) : loginState === 'success' ? (
				<Box flexDirection="column" gap={1}>
					<Box>
						<Text color="green" bold>
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
						<Text color="red" bold>
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
				<Text color={theme.colors.dim}>Esc to go back</Text>
			</Box>
		</Box>
	);
}
