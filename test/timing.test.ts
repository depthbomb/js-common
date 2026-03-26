import { it, vi, expect, describe, afterEach } from 'vitest';
import { sequential, allSettledSuccessful } from '../dist/promise.mjs';
import {
	retry,
	timeout,
	pollUntil,
	withAbort,
	abortAfter,
	raceSignals,
	RetryJitter,
	withTimeout,
	rejectionTimeout
} from '../dist/timing.mjs';

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

describe('retry', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('retries and eventually resolves', async () => {
		vi.useFakeTimers();
		let attempts = 0;

		const promise = retry(async () => {
			attempts++;
			if (attempts < 3) {
				throw new Error('fail');
			}
			return 'ok';
		}, { attempts: 3, baseMs: 10 });

		await vi.advanceTimersByTimeAsync(10);
		await vi.advanceTimersByTimeAsync(20);
		await expect(promise).resolves.toBe('ok');
		expect(attempts).toBe(3);
	});

	it('throws the final error when all attempts fail', async () => {
		vi.useFakeTimers();

		const promise = retry(async () => {
			throw new Error('boom');
		}, { attempts: 2, baseMs: 10 });
		const assertion = expect(promise).rejects.toThrow('boom');

		await vi.advanceTimersByTimeAsync(10);
		await assertion;
	});

	it('honors shouldRetry to stop early', async () => {
		const shouldRetry = vi.fn(() => false);
		let attempts = 0;

		await expect(retry(async () => {
			attempts++;
			throw new Error('stop');
		}, { attempts: 5, shouldRetry })).rejects.toThrow('stop');

		expect(attempts).toBe(1);
		expect(shouldRetry).toHaveBeenCalledTimes(1);
	});

	it('applies full jitter to backoff delay', async () => {
		vi.useFakeTimers();
		vi.spyOn(Math, 'random').mockReturnValue(0.5);

		let attempts = 0;
		const promise = retry(async () => {
			attempts++;
			if (attempts === 1) {
				throw new Error('first');
			}
			return 42;
		}, { attempts: 2, baseMs: 100, jitter: RetryJitter.Full });

		await vi.advanceTimersByTimeAsync(49);
		expect(attempts).toBe(1);
		await vi.advanceTimersByTimeAsync(1);
		await expect(promise).resolves.toBe(42);
		expect(attempts).toBe(2);
	});

	it('aborts before running when signal is already aborted', async () => {
		const controller = new AbortController();
		controller.abort();

		await expect(retry(() => Promise.resolve('ok'), { signal: controller.signal })).rejects.toThrow('Aborted');
	});
});

describe('cancellation helpers', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('abortAfter aborts after the provided timeout', async () => {
		vi.useFakeTimers();
		const signal = abortAfter(10);

		expect(signal.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(10);
		expect(signal.aborted).toBe(true);
	});

	it('withAbort rejects when signal aborts first', async () => {
		vi.useFakeTimers();
		const controller = new AbortController();
		const never = new Promise<number>(() => {});
		const result = withAbort(never, controller.signal);
		const assertion = expect(result).rejects.toThrow('Aborted');

		controller.abort();
		await vi.runAllTimersAsync();
		await assertion;
	});

	it('withAbort resolves source value when source wins', async () => {
		const controller = new AbortController();
		await expect(withAbort(Promise.resolve(7), controller.signal)).resolves.toBe(7);
	});

	it('raceSignals aborts when any signal aborts', () => {
		const a = new AbortController();
		const b = new AbortController();
		const raced = raceSignals(a.signal, b.signal);

		expect(raced.aborted).toBe(false);
		b.abort();
		expect(raced.aborted).toBe(true);
	});
});
