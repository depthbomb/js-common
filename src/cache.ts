import type { Awaitable, Maybe } from './typing';

/** Why an entry left an {@link LRUCache}. */
export const enum CacheEvictionReason {
	Capacity = 'capacity',
	Deleted  = 'deleted',
	Expired  = 'expired',
	Replaced = 'replaced',
	Cleared  = 'cleared'
}

/** Options for constructing an {@link LRUCache}. */
export interface ILRUCacheOptions<K, V> {
	maxSize: number;
	ttlMs?: number;
	onEvict?: (key: K, value: V, reason: CacheEvictionReason) => void;
}

/** Options for one cache entry. */
export interface ICacheEntryOptions {
	ttlMs?: number;
}

interface ICacheEntry<V> {
	value: V;
	expiresAt: number;
}

/** A bounded least-recently-used cache with optional entry expiration. */
export class LRUCache<K, V> implements Iterable<[K, V]> {
	readonly #maxSize: number;
	readonly #ttlMs: number;
	readonly #onEvict?: (key: K, value: V, reason: CacheEvictionReason) => void;
	readonly #entries = new Map<K, ICacheEntry<V>>();

	public constructor(options: ILRUCacheOptions<K, V>) {
		this.#validateMaxSize(options.maxSize);
		this.#validateTtl(options.ttlMs ?? Number.POSITIVE_INFINITY);

		this.#maxSize = options.maxSize;
		this.#ttlMs = options.ttlMs ?? Number.POSITIVE_INFINITY;
		this.#onEvict = options.onEvict;
	}

	public get maxSize() { return this.#maxSize; }
	public get ttlMs() { return this.#ttlMs; }

	public get size() {
		this.pruneExpired();

		return this.#entries.size;
	}

	/** Read and mark an entry as most recently used. */
	public get(key: K): Maybe<V> {
		const entry = this.#getLiveEntry(key);

		if (!entry) {
			return undefined;
		}

		this.#entries.delete(key);
		this.#entries.set(key, entry);

		return entry.value;
	}

	/** Read an entry without changing its recency. */
	public peek(key: K): Maybe<V> {
		return this.#getLiveEntry(key)?.value;
	}

	public has(key: K): boolean {
		return this.#getLiveEntry(key) !== undefined;
	}

	/** Insert or replace an entry and mark it as most recently used. */
	public set(key: K, value: V, options: ICacheEntryOptions = {}): this {
		const ttlMs = options.ttlMs ?? this.#ttlMs;

		this.#validateTtl(ttlMs);

		const previous = this.#entries.get(key);

		if (previous) {
			this.#entries.delete(key);
			this.#notifyEviction(key, previous.value, CacheEvictionReason.Replaced);
		}

		this.#entries.set(key, {
			value,
			expiresAt: ttlMs === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Date.now() + ttlMs
		});
		this.#evictOverflow();

		return this;
	}

	/** Return a cached value or create and cache one. */
	public getOrSet(key: K, factory: () => V, options: ICacheEntryOptions = {}): V {
		const entry = this.#getLiveEntry(key);

		if (entry) {
			this.#entries.delete(key);
			this.#entries.set(key, entry);

			return entry.value;
		}

		const value = factory();

		this.set(key, value, options);

		return value;
	}

	/** Return a cached value or asynchronously create and cache one. */
	public async getOrSetAsync(key: K, factory: () => Awaitable<V>, options: ICacheEntryOptions = {}): Promise<V> {
		const entry = this.#getLiveEntry(key);

		if (entry) {
			this.#entries.delete(key);
			this.#entries.set(key, entry);

			return entry.value;
		}

		const value = await factory();

		this.set(key, value, options);

		return value;
	}

	public delete(key: K): boolean {
		const entry = this.#entries.get(key);

		if (!entry) {
			return false;
		}

		this.#entries.delete(key);
		this.#notifyEviction(key, entry.value, CacheEvictionReason.Deleted);

		return true;
	}

	public clear(): void {
		const entries = [...this.#entries];

		this.#entries.clear();

		for (const [key, entry] of entries) {
			this.#notifyEviction(key, entry.value, CacheEvictionReason.Cleared);
		}
	}

	/** Remove every expired entry and return the number removed. */
	public pruneExpired(): number {
		const now = Date.now();
		let removed = 0;

		for (const [key, entry] of this.#entries) {
			if (entry.expiresAt <= now) {
				this.#remove(key, entry, CacheEvictionReason.Expired);
				removed++;
			}
		}

		return removed;
	}

	public *keys(): IterableIterator<K> {
		for (const [key] of this) {
			yield key;
		}
	}

	public *values(): IterableIterator<V> {
		for (const [, value] of this) {
			yield value;
		}
	}

	public *[Symbol.iterator](): IterableIterator<[K, V]> {
		this.pruneExpired();

		for (const [key, entry] of this.#entries) {
			yield [key, entry.value];
		}
	}

	#getLiveEntry(key: K): Maybe<ICacheEntry<V>> {
		const entry = this.#entries.get(key);

		if (!entry) {
			return undefined;
		}

		if (entry.expiresAt <= Date.now()) {
			this.#remove(key, entry, CacheEvictionReason.Expired);

			return undefined;
		}

		return entry;
	}

	#evictOverflow(): void {
		while (this.#entries.size > this.#maxSize) {
			const oldest = this.#entries.entries().next().value;

			if (!oldest) {
				return;
			}

			const [key, entry] = oldest;
			this.#remove(key, entry, CacheEvictionReason.Capacity);
		}
	}

	#remove(key: K, entry: ICacheEntry<V>, reason: CacheEvictionReason): void {
		this.#entries.delete(key);
		this.#notifyEviction(key, entry.value, reason);
	}

	#notifyEviction(key: K, value: V, reason: CacheEvictionReason): void {
		this.#onEvict?.(key, value, reason);
	}

	#validateMaxSize(maxSize: number): void {
		if (!Number.isInteger(maxSize) || maxSize < 1) {
			throw new Error('maxSize must be an integer >= 1');
		}
	}

	#validateTtl(ttlMs: number): void {
		if ((!Number.isFinite(ttlMs) && ttlMs !== Number.POSITIVE_INFINITY) || ttlMs < 0) {
			throw new Error('ttlMs must be a finite number >= 0 or Infinity');
		}
	}
}
