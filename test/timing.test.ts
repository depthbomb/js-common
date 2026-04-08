import { it, vi, expect, describe, afterEach } from 'vitest';
import { sequential, allSettledSuccessful } from '../dist/promise.mjs';
import {
	retry,
	timeout,
	pollUntil,
	withAbort,
	formatDuration,
	parseDuration,
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
		vi.useRealTimers();

		const signal = abortAfter(10);

		expect(signal.aborted).toBe(false);

		await new Promise(r => setTimeout(r, 10));

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

describe('duration parsing', () => {
	it('parses compact duration strings and exposes fixed milliseconds', () => {
		const duration = parseDuration('2h30m15s250ms');

		expect(duration.parts).toEqual({
			years: 0,
			months: 0,
			weeks: 0,
			days: 0,
			hours: 2,
			minutes: 30,
			seconds: 15,
			milliseconds: 250
		});
		expect(duration.milliseconds).toBe(9_015_250);
	});

	it('parses duration units from noisy prose', () => {
		const duration = parseDuration('2 hours, plus 30m, ignored text, and another 15 seconds');

		expect(duration.parts.days).toBe(0);
		expect(duration.parts.hours).toBe(2);
		expect(duration.parts.minutes).toBe(30);
		expect(duration.parts.seconds).toBe(15);
		expect(duration.milliseconds).toBe(9_015_000);
	});

	it('supports years through milliseconds', () => {
		const duration = parseDuration('1y 2mo 3w 4d 5h 6m 7s 8ms');

		expect(duration.parts).toEqual({
			years: 1,
			months: 2,
			weeks: 3,
			days: 4,
			hours: 5,
			minutes: 6,
			seconds: 7,
			milliseconds: 8
		});
	});

	it('applies calendar-aware month and year units to a provided date', () => {
		const duration = parseDuration('1y2mo3d');
		const result = duration.from(new Date('2024-01-31T00:00:00.000Z'));

		expect(result.toISOString()).toBe('2025-04-03T00:00:00.000Z');
	});

	it('can calculate anchored milliseconds from a provided date', () => {
		const duration = parseDuration('1mo');
		const start = new Date('2024-01-31T00:00:00.000Z');

		expect(duration.toMilliseconds(start)).toBe(29 * 24 * 60 * 60 * 1_000);
	});

	it('can apply the duration from an explicit now value', () => {
		const duration = parseDuration('2h30m');
		const result = duration.fromNow(new Date('2026-04-08T12:00:00.000Z'));

		expect(result.toISOString()).toBe('2026-04-08T14:30:00.000Z');
	});

	it('formats milliseconds into a human-readable duration string', () => {
		expect(formatDuration(1_000)).toBe('1 second');
		expect(formatDuration(9_015_000, { precision: 2 })).toBe('2 hours 30 minutes');
		expect(formatDuration(9_015_250)).toBe('2 hours 30 minutes 15 seconds 250 milliseconds');
	});

	it('formats parsed durations using the instance helper', () => {
		const duration = parseDuration('2h30m15s250ms');

		expect(duration.toHumanString({ precision: 2 })).toBe('2 hours 30 minutes');
	});

	it('supports custom unit labels for formatting', () => {
		expect(formatDuration(365 * 24 * 60 * 60 * 1_000, {
			labels: {
				years: { singular: 'año', plural: 'años' }
			}
		})).toBe('1 año');

		expect(formatDuration(2 * 365 * 24 * 60 * 60 * 1_000, {
			labels: {
				years: { singular: 'año', plural: 'años' }
			}
		})).toBe('2 años');

		expect(formatDuration(1_000, {
			labels: {
				seconds: { singular: 'segundo', plural: 'segundos' }
			}
		})).toBe('1 segundo');
	});

	it('throws on invalid formatting input', () => {
		expect(() => formatDuration(-1)).toThrow('milliseconds must be a finite number >= 0');
		expect(() => formatDuration(1_000, { precision: 0 })).toThrow('precision must be an integer >= 1');
	});

	it('throws when no duration units are found', () => {
		expect(() => parseDuration('nothing useful here')).toThrow('duration string did not contain any recognized units');
	});
});
