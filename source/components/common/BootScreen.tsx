import {useEffect, useMemo, useState} from 'react';
import {Box, Text} from 'ink';
import {useKeyBinding} from '../../hooks/useKeyboard.ts';
import {useTheme} from '../../hooks/useTheme.ts';
import {useTerminalSize} from '../../hooks/useTerminalSize.ts';
import {getSponsorLine} from '../../utils/funding.ts';
import {APP_NAME, APP_VERSION, GITHUB_REPO_URL} from '../../utils/constants.ts';

const YMC_ART = [
	' __     ____  __  _____ ',
	' \\ \\   / /  \\/  |/ ____|',
	' \\ \\_/ /| \\  / | |     ',
	'   \\   / | |\\/| | |     ',
	'    | |  | |  | | |____ ',
	'    |_|  |_|  |_|\\_____|',
];

const DEFAULT_TIMEOUT_MS = 1500;

export default function BootScreen({onBooted}: {onBooted: () => void}) {
	const theme = useTheme();
	const {columns, rows} = useTerminalSize();
	const [timedOut, setTimedOut] = useState(false);

	useKeyBinding(['*'], () => {
		onBooted();
	});

	useEffect(() => {
		const timer = setTimeout(() => {
			setTimedOut(true);
			onBooted();
		}, DEFAULT_TIMEOUT_MS);

		return () => clearTimeout(timer);
	}, [onBooted]);

	const artLines = useMemo(() => {
		if (columns < 30) {
			return ['YMC'];
		}

		const maxWidth = Math.max(...YMC_ART.map(line => line.length));
		const scale = Math.min(1, Math.floor((columns - 4) / maxWidth));
		const trimmed = YMC_ART.map(line =>
			line.slice(0, Math.floor(maxWidth * scale)),
		);

		return trimmed;
	}, [columns]);

	const sponsor = useMemo(() => getSponsorLine(), []);

	if (timedOut) return null;

	return (
		<Box
			flexDirection="column"
			justifyContent="center"
			alignItems="center"
			height={rows}
		>
			<Box
				borderStyle="round"
				borderColor={theme.theme.colors.secondary}
				padding={1}
			>
				<Text color={theme.theme.colors.primary}>{artLines.join('\n')}</Text>
			</Box>
			<Box marginTop={1} flexDirection="column" alignItems="center">
				<Text color={theme.theme.colors.text}>
					{APP_NAME} v{APP_VERSION}
				</Text>
				<Box marginTop={1}>
					<Text color={theme.theme.colors.dim} dimColor>
						{GITHUB_REPO_URL}
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text color={theme.theme.colors.dim} dimColor>
						{sponsor}
					</Text>
				</Box>
			</Box>
		</Box>
	);
}
