import { afterEach, it, expect, describe, vi } from 'vitest';
import { ResourceAcquireTimeoutError, ResourcePool, ResourcePoolClosedError } from '../dist/resource-pool.mjs';
import { deferred } from '../dist/atomic.mjs';

afterEach(() => {
	vi.useRealTimers();
});

describe('ResourcePool', () => {
	it('settles every queued caller when resource creation repeatedly fails', async () => {
		const error = new Error('create failed');
		const create = vi.fn(() => {
			throw error;
		});
		const pool = new ResourcePool({
			maxSize: 1,
			create,
			destroy: () => {}
		});
		const requests = Array.from({
			length: 5
		}, () => pool.acquire());
		const results = await Promise.allSettled(requests);
		expect(results).toEqual(requests.map(() => ({
			status: 'rejected',
			reason: error
		})));
		expect(create).toHaveBeenCalledTimes(5);
		expect(pool.pending).toBe(0);
		await pool.drain();
	});

	it('continues queued acquisitions after invalidation cleanup fails', async () => {
		const error = new Error('destroy failed');
		const destroy = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
		const pool = new ResourcePool({
			maxSize: 1,
			create:  () => ({}),
			destroy
		});
		const first = await pool.acquire();
		const waiting = pool.acquire();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		await expect(first.invalidate()).rejects.toBe(error);
		const replacement = await waiting;
		expect(replacement.value).not.toBe(first.value);
		await replacement.release();
		await pool.drain();
	});

	it.each([false, true])('drains resources undergoing validation (destroy fails: %s)', async (fails) => {
		const started = deferred<void>();
		const validated = deferred<boolean>();
		const error = new Error('destroy failed');
		const destroy = vi.fn(() => {
			if (fails) {
				throw error;
			}
		});
		const pool = new ResourcePool({
			maxSize: 1,
			minSize: 1,
			create:  () => 1,
			destroy,
			validate: () => {
				started.resolve();

				return validated.promise;
			}
		});
		await pool.warm();
		const acquiring = expect(pool.acquire()).rejects.toBeInstanceOf(ResourcePoolClosedError);
		await started.promise;
		const draining = pool.drain();
		const drained = fails
			? expect(draining).rejects.toMatchObject({
				errors: [error]
			})
			: expect(draining).resolves.toBeUndefined();
		validated.resolve(true);
		await acquiring;
		await drained;
		expect(destroy).toHaveBeenCalledExactlyOnceWith(1);
		expect(pool.size).toBe(0);
		expect(pool.idle).toBe(0);
	});

	it.each([false, true])('reclaims capacity after validation fails (async: %s)', async (asynchronous) => {
		const error = new Error('validation failed');
		const destroy = vi.fn();
		const pool = new ResourcePool({
			maxSize: 1,
			minSize: 1,
			create:  () => ({}),
			destroy,
			validate: () => {
				if (asynchronous) {
					return Promise.reject(error);
				}

				throw error;
			}
		});
		await pool.warm();
		await expect(pool.acquire()).rejects.toBe(error);
		expect(destroy).toHaveBeenCalledTimes(1);
		expect(pool.size).toBe(0);
		const replacement = await pool.acquire();
		await replacement.release();
		await pool.drain();
	});

	it('preserves validation and cleanup failures without leaking capacity', async () => {
		const validationError = new Error('validation failed');
		const destroyError = new Error('destroy failed');
		const pool = new ResourcePool({
			maxSize: 1,
			minSize: 1,
			create:  () => 1,
			validate: () => {
				throw validationError;
			},
			destroy: () => {
				throw destroyError;
			}
		});
		await pool.warm();
		await expect(pool.acquire()).rejects.toMatchObject({
			errors: [validationError, destroyError]
		});
		expect(pool.size).toBe(0);
		await pool.drain();
	});

	it('reuses resources and grants leases in FIFO order', async () => {
		let created = 0;
		const pool = new ResourcePool({
			maxSize: 1,
			create: () => ({ id: ++created }),
			destroy: () => {}
		});

		const first = await pool.acquire();
		const secondPromise = pool.acquire();

		expect(first.value.id).toBe(1);
		expect(pool.active).toBe(1);
		expect(pool.pending).toBe(1);

		await first.release();
		const second = await secondPromise;

		expect(second.value.id).toBe(1);
		expect(created).toBe(1);
		await second.release();
		await pool.drain();
	});

	it('serves large contended batches across compaction boundaries', async () => {
		let created = 0;
		const pool = new ResourcePool({
			maxSize: 1,
			create: () => ({ id: ++created }),
			destroy: () => {}
		});
		const first = await pool.acquire();
		const queued = Array.from({ length: 200 }, async () => {
			const lease = await pool.acquire();
			const id = lease.value.id;

			await lease.release();

			return id;
		});

		expect(pool.pending).toBe(200);
		await first.release();
		await expect(Promise.all(queued)).resolves.toEqual(Array.from({ length: 200 }, () => 1));

		expect(created).toBe(1);
		expect(pool.pending).toBe(0);
		await pool.drain();
	});

	it('warms to minimum size and destroys invalid resources', async () => {
		let created = 0;
		const destroyed: number[] = [];
		const healthy = new Map<number, boolean>();
		const pool = new ResourcePool({
			minSize: 2,
			maxSize: 2,
			create: () => {
				const resource = { id: ++created };
				healthy.set(resource.id, true);

				return resource;
			},
			destroy: resource => { destroyed.push(resource.id); },
			validate: resource => healthy.get(resource.id) ?? false
		});

		await pool.warm();
		expect(pool.idle).toBe(2);

		const first = await pool.acquire();
		await first.release();
		healthy.set(first.value.id, false);

		const second = await pool.acquire();
		expect(second.value.id).not.toBe(first.value.id);
		expect(destroyed).toContain(first.value.id);

		await second.release();
		await pool.drain();
	});

	it('supports acquisition cancellation and timeouts', async () => {
		vi.useFakeTimers();

		const pool = new ResourcePool({ maxSize: 1, create: () => ({}), destroy: () => {} });
		const lease = await pool.acquire();
		const controller = new AbortController();
		const aborted = pool.acquire({ signal: controller.signal });
		const timedOut = pool.acquire({ timeoutMs: 50 });
		const timedOutExpectation = expect(timedOut).rejects.toBeInstanceOf(ResourceAcquireTimeoutError);

		controller.abort(new Error('cancelled'));
		await expect(aborted).rejects.toThrow('cancelled');

		await vi.advanceTimersByTimeAsync(50);
		await timedOutExpectation;
		expect(pool.pending).toBe(0);

		await lease.release();
		await pool.drain();
	});

	it('prunes resources after their idle timeout', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);

		const destroyed: number[] = [];
		const pool = new ResourcePool({
			maxSize: 1,
			idleTimeoutMs: 100,
			create: () => 1,
			destroy: resource => { destroyed.push(resource); }
		});
		const lease = await pool.acquire();

		await lease.release();
		vi.setSystemTime(100);
		await expect(pool.pruneIdle()).resolves.toBe(1);

		expect(pool.size).toBe(0);
		expect(destroyed).toEqual([1]);
		await pool.drain();
	});

	it('waits for active leases during graceful drain', async () => {
		const destroyed: number[] = [];
		const pool = new ResourcePool({
			maxSize: 1,
			create: () => 1,
			destroy: resource => { destroyed.push(resource); }
		});
		const lease = await pool.acquire();
		let drained = false;
		const drain = pool.drain().then(() => { drained = true; });

		await Promise.resolve();
		expect(drained).toBe(false);
		await expect(pool.acquire()).rejects.toBeInstanceOf(ResourcePoolClosedError);

		await lease[Symbol.asyncDispose]();
		await drain;

		expect(drained).toBe(true);
		expect(destroyed).toEqual([1]);
	});
});
