import * as common from '@depthbomb/common';
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
		expect(common.KeyedMutex).toBeTypeOf('function');
		expect(common.Stack).toBeTypeOf('function');
		expect(common.tap).toBeTypeOf('function');
		expect(common.isInteger).toBeTypeOf('function');
		expect(common.median).toBeTypeOf('function');
		expect(common.pFilter).toBeTypeOf('function');
		expect(common.shuffle).toBeTypeOf('function');
		expect(common.unwrap).toBeTypeOf('function');
		expect(common.measure).toBeTypeOf('function');
		expect(common.typedKeys).toBeTypeOf('function');
	});
});
