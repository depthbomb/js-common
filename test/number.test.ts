import { it, expect, describe } from 'vitest';
import { sum, clamp, average, inRange, roundTo } from '../dist/number.mjs';

describe('number utilities', () => {
	it('clamp bounds values to min/max', () => {
		expect(clamp(5, 1, 10)).toBe(5);
		expect(clamp(-1, 0, 10)).toBe(0);
		expect(clamp(11, 0, 10)).toBe(10);
	});

	it('inRange supports inclusive and exclusive checks', () => {
		expect(inRange(10, 10, 20)).toBe(true);
		expect(inRange(20, 10, 20)).toBe(true);
		expect(inRange(10, 10, 20, false)).toBe(false);
		expect(inRange(15, 10, 20, false)).toBe(true);
	});

	it('roundTo rounds to decimal places', () => {
		expect(roundTo(1.2345, 2)).toBe(1.23);
		expect(roundTo(1.235, 2)).toBe(1.24);
		expect(roundTo(12.5)).toBe(13);
	});

	it('sum and average aggregate iterables', () => {
		expect(sum([1, 2, 3, 4])).toBe(10);
		expect(average([1, 2, 3, 4])).toBe(2.5);
	});

	it('validates invalid bounds and empty average', () => {
		expect(() => clamp(1, 5, 1)).toThrow('min must be <= max');
		expect(() => inRange(1, 5, 1)).toThrow('min must be <= max');
		expect(() => average([])).toThrow('cannot compute average of empty iterable');
		expect(() => roundTo(1.2, -1)).toThrow('decimals must be an integer >= 0');
	});
});
