import { describe, expect, it } from 'vitest';
import { pMap, pool, allSettledDetailed } from '../dist/promise.mjs';
import { timeout } from '../dist/timing.mjs';

describe('promise utilities', () => {
	it('allSettledDetailed returns full results and split values/errors', async () => {
		const error = new Error('boom');
		const result = await allSettledDetailed([
			Promise.resolve(1),
			Promise.reject(error),
			3,
		]);

		expect(result.fulfilled).toEqual([1, 3]);
		expect(result.rejected).toEqual([error]);
		expect(result.results).toHaveLength(3);
		expect(result.results[0]?.status).toBe('fulfilled');
		expect(result.results[1]?.status).toBe('rejected');
	});

	it('pool runs tasks with a concurrency cap and preserves order', async () => {
		let inFlight = 0;
		let maxInFlight = 0;

		const tasks = [1, 2, 3, 4, 5].map((n) => async () => {
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await timeout(2);
			inFlight--;
			return n * 2;
		});

		const results = await pool(tasks, { concurrency: 2 });

		expect(results).toEqual([2, 4, 6, 8, 10]);
		expect(maxInFlight).toBeLessThanOrEqual(2);
	});

	it('pMap maps values with a concurrency cap and preserves order', async () => {
		let inFlight = 0;
		let maxInFlight = 0;

		const results = await pMap([1, 2, 3, 4], async (value, index) => {
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await timeout(2);
			inFlight--;
			return `${index}:${value * 3}`;
		}, { concurrency: 2 });

		expect(results).toEqual(['0:3', '1:6', '2:9', '3:12']);
		expect(maxInFlight).toBeLessThanOrEqual(2);
	});

	it('validates concurrency options', async () => {
		await expect(pool([async () => 1], { concurrency: 0 })).rejects.toThrow('concurrency must be an integer >= 1');
		await expect(pMap([1], async (v) => v, { concurrency: -1 })).rejects.toThrow('concurrency must be an integer >= 1');
	});
});
