import { it, vi, expect, describe } from 'vitest';
import { once, pipe, deprecate } from '../dist/functional.mjs';

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

describe('deprecate', () => {
	it('calls the original function and returns its value', () => {
		const fn = (x: number, y: number) => x + y;
		const wrapped = deprecate(fn);

		expect(wrapped(2, 3)).toBe(5);
		expect(wrapped(10, 20)).toBe(30);
	});

	it('logs a console warning when called', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
		const fn = () => 'ok';
		const wrapped = deprecate(fn);

		wrapped();
		expect(warnSpy).toHaveBeenCalled();
		expect(warnSpy.mock.calls[0][0]).toContain('[DEPRECATED]');
		warnSpy.mockRestore();
	});

	it('includes the deprecated function name and options in the warning', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

		const fn = function oldFn() { return 42; };
		const wrapped = deprecate(fn, {
			deprecatedName: 'oldFn',
			replacementName: 'newFn',
			deprecatedSince: 'v1.0',
			removedIn: 'v2.0',
		});

		wrapped();

		const message = warnSpy.mock.calls[0][0];
		expect(message).toContain('oldFn is deprecated');
		expect(message).toContain('since v1.0');
		expect(message).toContain('will be removed in v2.0');
		expect(message).toContain('Use newFn instead.');

		warnSpy.mockRestore();
	});

	it('works with anonymous functions', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

		const wrapped = deprecate(() => 123);
		wrapped();

		const message = warnSpy.mock.calls[0][0];
		expect(message).toContain('Anonymous function is deprecated');
		warnSpy.mockRestore();
	});

	it('passes arguments correctly to the original function', () => {
		const fn = vi.fn((a: number, b: number) => a * b);
		const wrapped = deprecate(fn);

		expect(wrapped(3, 4)).toBe(12);
		expect(fn).toHaveBeenCalledWith(3, 4);
	});

	it('returns the same value on multiple calls', () => {
		const fn = (x: string) => x.toUpperCase();
		const wrapped = deprecate(fn);

		expect(wrapped('hello')).toBe('HELLO');
		expect(wrapped('world')).toBe('WORLD');
	});
});
