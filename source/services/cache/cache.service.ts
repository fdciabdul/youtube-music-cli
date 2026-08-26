// In-memory LRU cache with optional TTL for API responses
import {getConfigService} from '../config/config.service.ts';
import {logger} from '../logger/logger.service.ts';

export const DEFAULT_CACHE_TTL_MINUTES = 5;
export const DEFAULT_CACHE_MAX_ENTRIES = 100;

const MIN_CACHE_TTL_MINUTES = 1;
const MIN_CACHE_MAX_ENTRIES = 10;

export interface ResolvedCacheConfig {
	ttlMs: number;
	maxSize: number;
}

export function resolveCacheConfig(
	ttlMinutes: unknown,
	maxEntries: unknown,
): ResolvedCacheConfig {
	const minutes =
		typeof ttlMinutes === 'number' &&
		Number.isFinite(ttlMinutes) &&
		ttlMinutes >= MIN_CACHE_TTL_MINUTES
			? Math.floor(ttlMinutes)
			: DEFAULT_CACHE_TTL_MINUTES;
	const entries =
		typeof maxEntries === 'number' &&
		Number.isFinite(maxEntries) &&
		maxEntries >= MIN_CACHE_MAX_ENTRIES
			? Math.floor(maxEntries)
			: DEFAULT_CACHE_MAX_ENTRIES;
	return {ttlMs: minutes * 60_000, maxSize: entries};
}

function loadResolvedCacheConfig(): ResolvedCacheConfig {
	try {
		const config = getConfigService();
		return resolveCacheConfig(
			config.get('cacheTtlMinutes'),
			config.get('cacheMaxEntries'),
		);
	} catch {
		return resolveCacheConfig(undefined, undefined);
	}
}

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
	lastAccessed: number;
}

export class CacheService<T = unknown> {
	private cache = new Map<string, CacheEntry<T>>();
	private maxSize: number;
	private defaultTtlMs: number;
	private readonly now: () => number;

	constructor(
		maxSize = DEFAULT_CACHE_MAX_ENTRIES,
		defaultTtlMs = DEFAULT_CACHE_TTL_MINUTES * 60_000,
		now: () => number = Date.now,
	) {
		this.maxSize = maxSize;
		this.defaultTtlMs = defaultTtlMs;
		this.now = now;
	}

	get(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		if (this.now() > entry.expiresAt) {
			this.cache.delete(key);
			return null;
		}

		entry.lastAccessed = this.now();
		return entry.value;
	}

	set(key: string, value: T, ttlMs?: number): void {
		// Evict LRU entry if at capacity
		if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
			this.evictLru();
		}

		this.cache.set(key, {
			value,
			expiresAt: this.now() + (ttlMs ?? this.defaultTtlMs),
			lastAccessed: this.now(),
		});
	}

	has(key: string): boolean {
		return this.get(key) !== null;
	}

	delete(key: string): void {
		this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}

	get size(): number {
		return this.cache.size;
	}

	configure(maxSize: number, defaultTtlMs: number): void {
		this.maxSize = maxSize;
		this.defaultTtlMs = defaultTtlMs;
		while (this.cache.size > this.maxSize) {
			this.evictLru();
		}
	}

	private evictLru(): void {
		let lruKey: string | null = null;
		let lruTime = Infinity;

		for (const [key, entry] of this.cache) {
			if (entry.lastAccessed < lruTime) {
				lruTime = entry.lastAccessed;
				lruKey = key;
			}
		}

		if (lruKey) {
			logger.debug('CacheService', 'Evicting LRU entry', {key: lruKey});
			this.cache.delete(lruKey);
		}
	}
}

// Shared search result cache, sized from config (cacheTtlMinutes/cacheMaxEntries)
let searchCacheInstance: CacheService | null = null;
export const getSearchCache = (): CacheService => {
	if (!searchCacheInstance) {
		searchCacheInstance = new CacheService();
	}
	const resolved = loadResolvedCacheConfig();
	searchCacheInstance.configure(resolved.maxSize, resolved.ttlMs);
	return searchCacheInstance;
};

// Shared suggestions cache, sized from config (cacheTtlMinutes/cacheMaxEntries)
let suggestionsCacheInstance: CacheService | null = null;
export const getSuggestionsCache = (): CacheService => {
	if (!suggestionsCacheInstance) {
		suggestionsCacheInstance = new CacheService();
	}
	const resolved = loadResolvedCacheConfig();
	suggestionsCacheInstance.configure(resolved.maxSize, resolved.ttlMs);
	return suggestionsCacheInstance;
};
