import { afterEach, it, expect, describe, vi } from 'vitest';
import { CacheEvictionReason, LRUCache } from '../dist/cache.mjs';

afterEach(() => {
	vi.useRealTimers();
});

describe('LRUCache', () => {
	it('keeps expiry deadlines correct through replacement, deletion, and clear', () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const cache = new LRUCache<string, number>({
			maxSize: 5
		});
		cache.set('permanent', 1);
		cache.set('short', 2, {
			ttlMs: 10
		});
		cache.set('long', 3, {
			ttlMs: 100
		});
		cache.set('short', 4);
		vi.setSystemTime(10);
		expect(cache.size).toBe(3);
		cache.delete('long');
		cache.set('earlier', 5, {
			ttlMs: 5
		});
		vi.setSystemTime(15);
		expect(cache.size).toBe(2);
		expect([...cache]).toEqual([['permanent', 1], ['short', 4]]);
		cache.clear();
		cache.set('new', 6, {
			ttlMs: 1
		});
		vi.setSystemTime(16);
		expect(cache.size).toBe(0);
	});

	it('retries expiration pruning after an eviction callback throws', () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const onEvict = vi.fn().mockImplementationOnce(() => {
			throw new Error('callback failed');
		});
		const cache = new LRUCache<string, number>({
			maxSize: 2,
			ttlMs:   10,
			onEvict
		});
		cache.set('a', 1).set('b', 2);
		vi.setSystemTime(10);
		expect(() => cache.size).toThrow('callback failed');
		expect(cache.size).toBe(0);
		expect(onEvict).toHaveBeenCalledTimes(2);
	});

	it('matches an ordered-map model through sustained churn and removals', () => {
		const capacity = 17;
		const cache = new LRUCache<number, number>({
			maxSize: capacity
		});
		const model = new Map<number, number>();
		let seed = 12345;

		for (let index = 0; index < 2000; index++) {
			seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
			const key = seed % 31;
			const operation = (seed >>> 8) % 10;
			if (operation < 6) {
				cache.set(key, index);
				model.delete(key);
				model.set(key, index);

				if (model.size > capacity) {
					model.delete(model.keys().next().value!);
				}
			} else if (operation < 8) {
				expect(cache.get(key)).toBe(model.get(key));
				const value = model.get(key);
				if (value !== undefined) {
					model.delete(key);
					model.set(key, value);
				}
			} else if (operation === 8) {
				expect(cache.delete(key)).toBe(model.delete(key));
			} else {
				cache.clear();
				model.clear();
			}

			expect([...cache]).toEqual([...model]);
		}
	});

	it('keeps recency consistent when replacement callbacks insert the same key', () => {
		let reentered = false;
		const cache = new LRUCache<string, number>({
			maxSize: 2,
			onEvict: (key, _value, reason) => {
				if (reason === CacheEvictionReason.Replaced && !reentered) {
					reentered = true;
					cache.set(key, 10);
				}
			}
		});
		cache.set('a', 1).set('b', 2).set('a', 3).set('c', 4);
		expect([...cache]).toEqual([['a', 3], ['c', 4]]);
	});

	it('evicts the least recently used entry at capacity', () => {
		const cache = new LRUCache<string, number>({ maxSize: 2 });

		cache.set('a', 1).set('b', 2);
		expect(cache.get('a')).toBe(1);
		cache.set('c', 3);

		expect(cache.has('a')).toBe(true);
		expect(cache.has('b')).toBe(false);
		expect([...cache]).toEqual([['a', 1], ['c', 3]]);
	});

	it('expires entries using default and per-entry TTL values', () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000);

		const cache = new LRUCache<string, number>({ maxSize: 3, ttlMs: 100 });
		cache.set('default', 1);
		cache.set('custom', 2, { ttlMs: 200 });

		vi.setSystemTime(1_150);

		expect(cache.get('default')).toBeUndefined();
		expect(cache.get('custom')).toBe(2);
		expect(cache.size).toBe(1);
	});

	it('reports eviction reasons', () => {
		const evictions: Array<[string, number, CacheEvictionReason]> = [];
		const cache = new LRUCache<string, number>({
			maxSize: 1,
			onEvict: (key, value, reason) => evictions.push([key, value, reason])
		});

		cache.set('a', 1);
		cache.set('a', 2);
		cache.set('b', 3);
		cache.delete('b');

		expect(evictions).toEqual([
			['a', 1, CacheEvictionReason.Replaced],
			['a', 2, CacheEvictionReason.Capacity],
			['b', 3, CacheEvictionReason.Deleted]
		]);
	});

	it('creates missing values synchronously and asynchronously', async () => {
		const cache = new LRUCache<string, number>({ maxSize: 2 });
		let calls = 0;

		expect(cache.getOrSet('a', () => ++calls)).toBe(1);
		expect(cache.getOrSet('a', () => ++calls)).toBe(1);
		await expect(cache.getOrSetAsync('b', async () => ++calls)).resolves.toBe(2);
		await expect(cache.getOrSetAsync('b', async () => ++calls)).resolves.toBe(2);
		expect(calls).toBe(2);
	});

	it('supports cached undefined values through has and factories', () => {
		const cache = new LRUCache<string, undefined>({ maxSize: 1 });
		let calls = 0;

		cache.set('a', undefined);
		expect(cache.has('a')).toBe(true);
		expect(cache.getOrSet('a', () => {
			calls++;

			return undefined;
		})).toBeUndefined();
		expect(calls).toBe(0);
	});
});
