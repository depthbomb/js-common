import { it, expect, describe } from 'vitest';
import { cast, assume, typedEntries } from '../src/types';

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
});
