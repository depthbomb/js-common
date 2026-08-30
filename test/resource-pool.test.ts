import { afterEach, it, expect, describe, vi } from 'vitest';
import { ResourceAcquireTimeoutError, ResourcePool, ResourcePoolClosedError } from '../dist/resource-pool.mjs';

afterEach(() => {
	vi.useRealTimers();
});

describe('ResourcePool', () => {
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
