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
