import { it, expect, describe } from 'vitest';
import { chunk, groupBy, partition, range, uniqueBy, windowed, zip } from '../dist/iterable.mjs';

describe('iterable utilities', () => {
	it('chunks values lazily', () => {
		let consumed = 0;
		const source = function* () {
			for (const value of [1, 2, 3]) {
				consumed++;
				yield value;
			}
		};
		const chunks = chunk(source(), 2);

		expect(consumed).toBe(0);
		expect(chunks.next().value).toEqual([1, 2]);
		expect(consumed).toBe(2);
		expect(chunks.next().value).toEqual([3]);
	});

	it('partitions values while preserving order', () => {
		expect(partition([1, 2, 3, 4], value => value % 2 === 0)).toEqual([[2, 4], [1, 3]]);
	});

	it('groups values by selected keys', () => {
		const groups = groupBy(['one', 'two', 'three'], value => value.length);

		expect(groups).toEqual(new Map([
			[3, ['one', 'two']],
			[5, ['three']]
		]));
	});

	it('selects the first unique value for each key', () => {
		const values = [{ id: 1, value: 'a' }, { id: 1, value: 'b' }, { id: 2, value: 'c' }];

		expect([...uniqueBy(values, value => value.id)]).toEqual([values[0], values[2]]);
	});

	it('zips until the shorter iterable is exhausted', () => {
		expect([...zip([1, 2, 3], ['a', 'b'])]).toEqual([[1, 'a'], [2, 'b']]);
	});

	it('creates sliding and stepped windows', () => {
		expect([...windowed([1, 2, 3, 4], 3)]).toEqual([[1, 2, 3], [2, 3, 4]]);
		expect([...windowed([1, 2, 3, 4, 5, 6], 2, 3)]).toEqual([[1, 2], [4, 5]]);
	});

	it('creates ascending and descending half-open ranges', () => {
		expect([...range(4)]).toEqual([0, 1, 2, 3]);
		expect([...range(5, 0, -2)]).toEqual([5, 3, 1]);
	});

	it('validates sizes, steps, and range values', () => {
		expect(() => chunk([], 0).next()).toThrow('size');
		expect(() => windowed([], 1, 0).next()).toThrow('step');
		expect(() => range(0, 1, 0).next()).toThrow('step');
	});
});
