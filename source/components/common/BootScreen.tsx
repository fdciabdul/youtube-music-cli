import {useEffect, useMemo, useState} from 'react';
import {Box, Text} from 'ink';
import {useKeyBinding} from '../../hooks/useKeyboard.ts';
import {useTheme} from '../../hooks/useTheme.ts';
import {useTerminalSize} from '../../hooks/useTerminalSize.ts';
import {getSponsorLine} from '../../utils/funding.ts';

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
			{artLines.map(line => (
				<Box key={line}>
					<Text color={theme.theme.colors.primary}>{line}</Text>
				</Box>
			))}
			<Box marginTop={1}>
				<Text color={theme.theme.colors.dim} dimColor>
					{sponsor}
				</Text>
			</Box>
		</Box>
	);
}
