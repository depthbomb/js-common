import * as common from '../dist/index.mjs';
import { it, expect, describe } from 'vitest';

describe('root ESM entrypoint', () => {
	it('re-exports symbols from the package root barrel', () => {
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
});
