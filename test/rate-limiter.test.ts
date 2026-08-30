import { afterEach, it, expect, describe, vi } from 'vitest';
import { RateLimiter, RateLimitQueueFullError, RateLimiterClearedError } from '../dist/rate-limiter.mjs';

afterEach(() => {
	vi.useRealTimers();
});

describe('RateLimiter', () => {
	it('allows bursts and replenishes tokens continuously', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);

		const limiter = new RateLimiter({ limit: 2, intervalMs: 100, burst: 2 });

		await limiter.acquire();
		await limiter.acquire();
		const third = limiter.acquire();

		expect(limiter.available).toBe(0);
		expect(limiter.pending).toBe(1);

		await vi.advanceTimersByTimeAsync(50);
		await expect(third).resolves.toBeUndefined();
		expect(limiter.pending).toBe(0);
	});

	it('releases queued callers in FIFO order', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);

		const limiter = new RateLimiter({ limit: 1, intervalMs: 100, burst: 1 });
		const order: number[] = [];

		await limiter.acquire();
		const second = limiter.acquire().then(() => order.push(2));
		const third = limiter.acquire().then(() => order.push(3));

		await vi.advanceTimersByTimeAsync(100);
		await second;
		expect(order).toEqual([2]);

		await vi.advanceTimersByTimeAsync(100);
		await third;
		expect(order).toEqual([2, 3]);
	});

	it('supports cancellation and queue bounds', async () => {
		const limiter = new RateLimiter({ limit: 1, intervalMs: 10_000, burst: 1, queueLimit: 1 });
		const controller = new AbortController();

		await limiter.acquire();
		const queued = limiter.acquire({ signal: controller.signal });
		await expect(limiter.acquire()).rejects.toBeInstanceOf(RateLimitQueueFullError);

		controller.abort(new Error('cancelled'));
		await expect(queued).rejects.toThrow('cancelled');
		expect(limiter.pending).toBe(0);
		limiter[Symbol.dispose]();
	});

	it('schedules operations after acquisition', async () => {
		const limiter = new RateLimiter({ limit: 1, intervalMs: 1 });

		await expect(limiter.schedule(async () => 'value')).resolves.toBe('value');
		limiter[Symbol.dispose]();
	});

	it('rejects queued and future work after disposal', async () => {
		const limiter = new RateLimiter({ limit: 1, intervalMs: 10_000, burst: 1 });

		await limiter.acquire();
		const queued = limiter.acquire();
		limiter[Symbol.dispose]();

		await expect(queued).rejects.toBeInstanceOf(RateLimiterClearedError);
		await expect(limiter.acquire()).rejects.toBeInstanceOf(RateLimiterClearedError);
	});
});
