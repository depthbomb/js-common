import { it, expect, describe } from 'vitest';
import { once, pipe } from '../dist/functional.mjs';

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

describe('pipe', () => {
	it('applies functions from left to right', () => {
		const result = pipe(
			2,
			(x: number) => x + 1,
			(x: number) => x * 3,
			(x: number) => `value: ${x}`
		);

		expect(result).toBe('value: 9');
	});

	it('returns the initial value when no functions are provided', () => {
		expect(pipe(42)).toBe(42);
	});

	it('passes the result of each function to the next', () => {
		const spy: number[] = [];

		const result = pipe(
			1,
			(x: number) => {
				spy.push(x);
				return x + 2;
			},
			(x: number) => {
				spy.push(x);
				return x * 2;
			}
		);

		expect(result).toBe(6);
		expect(spy).toEqual([1, 3]);
	});
});
