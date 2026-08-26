import {useEffect} from 'react';
import process from 'node:process';
import {usePlayer} from './usePlayer.ts';
import {
	buildTerminalTitle,
	formatTerminalTitleSequence,
} from '../utils/terminal-title.ts';

export function useTerminalTitle(): void {
	const {state} = usePlayer();
	const {currentTrack, isPlaying} = state;

	useEffect(() => {
		if (!process.stdout.isTTY) {
			return;
		}
		process.stdout.write(
			formatTerminalTitleSequence(
				buildTerminalTitle({currentTrack, isPlaying}),
			),
		);
	}, [currentTrack, isPlaying]);

	useEffect(() => {
		return () => {
			if (!process.stdout.isTTY) {
				return;
			}
			process.stdout.write(formatTerminalTitleSequence('youtube-music-cli'));
		};
	}, []);
}
