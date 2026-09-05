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

interface ICacheEntry<K, V> {
	key:        K;
	value:      V;
	expiresAt:  number;
	previous?:  ICacheEntry<K, V>;
	next?:      ICacheEntry<K, V>;
}

/** A bounded least-recently-used cache with optional entry expiration. */
export class LRUCache<K, V> implements Iterable<[K, V]> {
	readonly #maxSize: number;
	readonly #ttlMs: number;
	readonly #onEvict?: (key: K, value: V, reason: CacheEvictionReason) => void;
	readonly #entries = new Map<K, ICacheEntry<K, V>>();
	#oldest?: ICacheEntry<K, V>;
	#newest?: ICacheEntry<K, V>;
	#nextExpiry = Number.POSITIVE_INFINITY;

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

		this.#touch(entry);

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
			this.#remove(key, previous, CacheEvictionReason.Replaced);
		}

		// A replacement callback may have inserted this key again.
		const inserted = this.#entries.get(key);
		if (inserted) {
			this.#unlink(inserted);
			this.#entries.delete(key);
		}

		const entry = {
			key,
			value,
			expiresAt: ttlMs === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Date.now() + ttlMs
		} as ICacheEntry<K, V>;
		this.#entries.set(key, entry);
		this.#append(entry);
		this.#nextExpiry = Math.min(this.#nextExpiry, entry.expiresAt);
		this.#evictOverflow();

		return this;
	}

	/** Return a cached value or create and cache one. */
	public getOrSet(key: K, factory: () => V, options: ICacheEntryOptions = {}): V {
		const entry = this.#getLiveEntry(key);

		if (entry) {
			this.#touch(entry);

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
			this.#touch(entry);

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

		this.#remove(key, entry, CacheEvictionReason.Deleted);

		return true;
	}

	public clear(): void {
		const entries = [...this.#entries];

		this.#entries.clear();
		this.#oldest = undefined;
		this.#newest = undefined;
		this.#nextExpiry = Number.POSITIVE_INFINITY;

		for (const [key, entry] of entries) {
			this.#notifyEviction(key, entry.value, CacheEvictionReason.Cleared);
		}
	}

	/** Remove every expired entry and return the number removed. */
	public pruneExpired(): number {
		const now = Date.now();
		if (this.#nextExpiry > now) {
			return 0;
		}

		let removed = 0;
		this.#nextExpiry = Number.POSITIVE_INFINITY;

		try {
			for (const [key, entry] of this.#entries) {
				if (entry.expiresAt <= now) {
					this.#remove(key, entry, CacheEvictionReason.Expired);
					removed++;
				} else {
					this.#nextExpiry = Math.min(this.#nextExpiry, entry.expiresAt);
				}
			}
		} catch (error) {
			this.#nextExpiry = Number.NEGATIVE_INFINITY;
			throw error;
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

	#getLiveEntry(key: K): Maybe<ICacheEntry<K, V>> {
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
			const oldest = this.#oldest;

			if (!oldest) {
				return;
			}

			this.#remove(oldest.key, oldest, CacheEvictionReason.Capacity);
		}
	}

	#touch(entry: ICacheEntry<K, V>): void {
		if (entry === this.#newest) {
			return;
		}

		this.#entries.delete(entry.key);
		this.#entries.set(entry.key, entry);
		this.#unlink(entry);
		this.#append(entry);
	}

	#append(entry: ICacheEntry<K, V>): void {
		entry.previous = this.#newest;
		entry.next = undefined;

		if (this.#newest) {
			this.#newest.next = entry;
		} else {
			this.#oldest = entry;
		}

		this.#newest = entry;
	}

	#unlink(entry: ICacheEntry<K, V>): void {
		if (entry.previous) {
			entry.previous.next = entry.next;
		} else {
			this.#oldest = entry.next;
		}

		if (entry.next) {
			entry.next.previous = entry.previous;
		} else {
			this.#newest = entry.previous;
		}

		entry.previous = undefined;
		entry.next = undefined;
	}

	#remove(key: K, entry: ICacheEntry<K, V>, reason: CacheEvictionReason): void {
		this.#entries.delete(key);
		this.#unlink(entry);
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
