import { it, expect, describe } from 'vitest';
import { ok, err, cast, isOk, mapOk, assume, mapErr, tryCatch, typedEntries, tryCatchAsync } from '../dist/typing.mjs';

describe('types helpers', () => {
	it('cast returns the input value unchanged', () => {
		const value = { a: 1, b: 'two' };
		expect(cast<object, typeof value>(value)).toBe(value);
	});

	it('assume is a runtime no-op', () => {
		expect(() => assume<string>(123)).not.toThrow();
	});

	it('typedEntries returns enumerable own key/value tuples', () => {
		const obj = { first: 1, second: 'two' };
		expect(typedEntries(obj)).toEqual([
			['first', 1],
			['second', 'two'],
		]);
	});

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
		const result = tryCatch(() => { throw new Error('fail'); }, (e) => 'mapped');
		expect(result).toEqual({ ok: false, error: 'mapped' });
	});

	it('tryCatch does not catch successful values when mapError is provided', () => {
		const result = tryCatch(() => 5, (e) => 'mapped');
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
