// Radio mode type definitions
export type RadioSeedType = 'track' | 'artist' | 'playlist' | 'genre' | 'mood';

export interface RadioSeed {
	type: RadioSeedType;
	id: string;
	name: string;
}

export interface RadioState {
	isActive: boolean;
	seed: RadioSeed | null;
	tracksPlayed: number;
	startedAt: string | null;
}

export interface StartRadioAction {
	readonly category: 'START_RADIO';
	seed: RadioSeed;
}

export interface StopRadioAction {
	readonly category: 'STOP_RADIO';
}

export interface ToggleRadioAction {
	readonly category: 'TOGGLE_RADIO';
}
