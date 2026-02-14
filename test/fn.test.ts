import { once } from '../src/fn';
import { it, expect, describe } from 'vitest';

describe('once', () => {
	it('invokes the wrapped function only once', () => {
		let calls = 0;
		const fn = once((value: number) => {
			calls++;
			return value * 2;
		});

		expect(fn(2)).toBe(4);
		expect(fn(999)).toBe(4);
		expect(calls).toBe(1);
	});

	it('retries if the first invocation throws', () => {
		let calls = 0;
		const fn = once(() => {
			calls++;
			if (calls === 1) {
				throw new Error('boom');
			}

			return 'ok';
		});

		expect(() => fn()).toThrow('boom');
		expect(fn()).toBe('ok');
		expect(calls).toBe(2);
	});
});
