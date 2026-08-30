import { afterEach, it, expect, describe, vi } from 'vitest';
import { CacheEvictionReason, LRUCache } from '../dist/cache.mjs';

afterEach(() => {
	vi.useRealTimers();
});

describe('LRUCache', () => {
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
