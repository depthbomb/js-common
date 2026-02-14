import { it, expect, describe } from 'vitest';
import {
	timeout,
	pollUntil,
	sequential,
	withTimeout,
	rejectionTimeout,
	allSettledSuccessful,
} from '../src/async';

describe('async utilities', () => {
	it('timeout resolves asynchronously', async () => {
		let completed = false;

		const pending = timeout(0).then(() => {
			completed = true;
		});

		expect(completed).toBe(false);
		await pending;
		expect(completed).toBe(true);
	});

	it('rejectionTimeout rejects asynchronously', async () => {
		let rejected = false;

		const pending = rejectionTimeout(0).catch(() => {
			rejected = true;
		});

		expect(rejected).toBe(false);
		await pending;
		expect(rejected).toBe(true);
	});

	it('pollUntil resolves when the condition eventually passes', async () => {
		let attempts = 0;

		await pollUntil(() => ++attempts >= 3, 1, 50);
		expect(attempts).toBe(3);
	});

	it('pollUntil rejects when timeout is exceeded', async () => {
		await expect(pollUntil(() => false, 1, 10)).rejects.toThrow('Timeout exceeded');
	});

	it('withTimeout resolves with the source promise value', async () => {
		await expect(withTimeout(Promise.resolve(42), 25)).resolves.toBe(42);
	});

	it('withTimeout rejects when the timeout wins', async () => {
		const never = new Promise<number>(() => {});
		await expect(withTimeout(never, 10)).rejects.toThrow('Operation timed out');
	});

	it('allSettledSuccessful returns fulfilled values only', async () => {
		const values = await allSettledSuccessful([
			Promise.resolve(1),
			Promise.reject(new Error('boom')),
			Promise.resolve(3),
		]);

		expect(values).toEqual([1, 3]);
	});

	it('sequential executes tasks in order', async () => {
		const order: number[] = [];
		const tasks = [
			async () => {
				order.push(1);
				return 'a';
			},
			async () => {
				order.push(2);
				return 'b';
			},
			async () => {
				order.push(3);
				return 'c';
			},
		];

		await expect(sequential(tasks)).resolves.toEqual(['a', 'b', 'c']);
		expect(order).toEqual([1, 2, 3]);
	});
});
