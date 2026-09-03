// Authentication type definitions
import type {OAuth2Tokens} from 'youtubei.js';

export type AuthMethod = 'oauth2' | 'cookie';

export interface AuthCredentials {
	schemaVersion: number;
	method: AuthMethod;
	tokens?: OAuth2Tokens;
	cookie?: string;
	signedInAt: string;
	accountName?: string;
}

export interface AuthStatus {
	loggedIn: boolean;
	method?: AuthMethod;
	accountName?: string;
	signedInAt?: string;
	tokenValid: boolean;
	cookie?: string;
}
