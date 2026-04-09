import { it, expect, describe } from 'vitest';

describe('CommonJS dist entrypoints', () => {
	it('exports the root barrel from dist/index.cjs', async () => {
		const common = await import('../dist/index.cjs');

		expect(common.Queue).toBeTypeOf('function');
		expect(common.URLPath).toBeTypeOf('function');
		expect(common.DateBuilder).toBeTypeOf('function');
		expect(common.date).toBeTypeOf('function');
		expect(common.DateUnit.Day).toBe('day');
		expect(common.Barrier).toBeTypeOf('function');
		expect(common.Mutex).toBeTypeOf('function');
		expect(common.Semaphore).toBeTypeOf('function');
		expect(common.ReadWriteLock).toBeTypeOf('function');
		expect(common.AtomicValue).toBeTypeOf('function');
		expect(common.deferred).toBeTypeOf('function');
		expect(common.singleFlight).toBeTypeOf('function');
		expect(common.timeout).toBeTypeOf('function');
		expect(common.once).toBeTypeOf('function');
		expect(common.onceAsync).toBeTypeOf('function');
		expect(common.ok).toBeTypeOf('function');
	});

	it('exports subpath CommonJS modules', async () => {
		const { Queue } = await import('../dist/collections.cjs');
		const { DateBuilder, DateUnit, date } = await import('../dist/date.cjs');
		const { URLPath } = await import('../dist/url.cjs');
		const { Barrier, Mutex, Semaphore, ReadWriteLock, AtomicValue, deferred, singleFlight, once, onceAsync } = await import('../dist/atomic.cjs');

		expect(Queue).toBeTypeOf('function');
		expect(DateBuilder).toBeTypeOf('function');
		expect(date).toBeTypeOf('function');
		expect(DateUnit.Day).toBe('day');
		expect(URLPath).toBeTypeOf('function');
		expect(Barrier).toBeTypeOf('function');
		expect(Mutex).toBeTypeOf('function');
		expect(Semaphore).toBeTypeOf('function');
		expect(ReadWriteLock).toBeTypeOf('function');
		expect(AtomicValue).toBeTypeOf('function');
		expect(deferred).toBeTypeOf('function');
		expect(singleFlight).toBeTypeOf('function');
		expect(once).toBeTypeOf('function');
		expect(onceAsync).toBeTypeOf('function');
	});
});
