import { it, expect, describe } from 'vitest';
import { ok, err, isOk, mapOk, mapErr, unwrap, unwrapOr, tryCatch, tryCatchAsync } from '../dist/result.mjs';

describe('types helpers', () => {
	it('ok and err create Result values', () => {
		expect(ok(123)).toEqual({ ok: true, value: 123 });
		expect(err('boom')).toEqual({ ok: false, error: 'boom' });
	});

	it('isOk narrows result variants', () => {
		const success = ok(1);
		const failure = err(new Error('x'));

		expect(isOk(success)).toBe(true);
		expect(isOk(failure)).toBe(false);
	});

	it('mapOk only maps success values', () => {
		expect(mapOk(ok(2), (value) => value * 5)).toEqual({ ok: true, value: 10 });
		expect(mapOk(err('nope'), () => 10)).toEqual({ ok: false, error: 'nope' });
	});

	it('mapErr only maps error values', () => {
		expect(mapErr(err('bad'), (value) => value.toUpperCase())).toEqual({ ok: false, error: 'BAD' });
		expect(mapErr(ok(10), () => 'x')).toEqual({ ok: true, value: 10 });
	});

	it('unwrap extracts successes and throws stored failures', () => {
		const failure = new Error('no value');
		expect(unwrap(ok(5))).toBe(5);
		expect(() => unwrap(err(failure))).toThrow(failure);
	});

	it('unwrapOr supports eager and error-derived fallback values', () => {
		expect(unwrapOr(ok(5), 10)).toBe(5);
		expect(unwrapOr(err('missing'), 10)).toBe(10);
		expect(unwrapOr(err('missing'), error => error.length)).toBe(7);
	});

	it('tryCatch returns ok on successful operation', () => {
		const result = tryCatch(() => 123);
		expect(result).toEqual({ ok: true, value: 123 });
	});

	it('tryCatch returns err when operation throws', () => {
		const result = tryCatch(() => { throw new Error('fail'); }) as { ok: false; error: Error };
		expect(result.ok).toBe(false);
		expect(result.error.message).toBe('fail');
	});

	it('tryCatch supports custom error mapping', () => {
		const result = tryCatch(() => { throw new Error('fail'); }, () => 'mapped');
		expect(result).toEqual({ ok: false, error: 'mapped' });
	});

	it('tryCatch does not catch successful values when mapError is provided', () => {
		const result = tryCatch(() => 5, () => 'mapped');
		expect(result).toEqual({ ok: true, value: 5 });
	});

	it('tryCatch works with non-Error thrown values', () => {
		const result = tryCatch(() => { throw 'oops'; }) as { ok: false; error: 'oops' };
		expect(result.ok).toBe(false);
		expect(result.error).toBe('oops');
	});

	it('tryCatchAsync returns ok on success', async () => {
		await expect(tryCatchAsync(async () => 42)).resolves.toEqual({ ok: true, value: 42 });
	});

	it('tryCatchAsync returns err on failure', async () => {
		await expect(tryCatchAsync(async () => {
			throw new Error('boom');
		})).resolves.toMatchObject({ ok: false });
	});

	it('tryCatchAsync supports custom error mapping', async () => {
		await expect(tryCatchAsync(async () => {
			throw new Error('boom');
		}, () => 'mapped')).resolves.toEqual({ ok: false, error: 'mapped' });
	});
});
