import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickRandom, pickWeighted, randomFloat, randomInt } from '../dist/random.mjs';

describe('random utilities', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('randomFloat returns bounded value', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.25);
		expect(randomFloat(10, 20)).toBe(12.5);
		expect(randomFloat()).toBe(0.25);
	});

	it('randomInt returns bounded inclusive integer', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.0);
		expect(randomInt(3, 5)).toBe(3);

		vi.spyOn(Math, 'random').mockReturnValue(0.999999);
		expect(randomInt(3, 5)).toBe(5);
	});

	it('pickRandom selects an element from input array', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.5);
		expect(pickRandom(['a', 'b', 'c'])).toBe('b');
	});

	it('pickWeighted selects based on cumulative weight', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.1); // threshold 0.6 on total 6
		expect(pickWeighted([
			{ value: 'a', weight: 1 },
			{ value: 'b', weight: 2 },
			{ value: 'c', weight: 3 },
		])).toBe('a');

		vi.spyOn(Math, 'random').mockReturnValue(0.9); // threshold 5.4 on total 6
		expect(pickWeighted([
			{ value: 'a', weight: 1 },
			{ value: 'b', weight: 2 },
			{ value: 'c', weight: 3 },
		])).toBe('c');
	});

	it('validates invalid inputs', () => {
		expect(() => randomFloat(2, 1)).toThrow('min must be <= max');
		expect(() => randomInt(1.2, 3)).toThrow('min and max must be integers');
		expect(() => pickRandom([])).toThrow('cannot pick from empty array');
		expect(() => pickWeighted([])).toThrow('cannot pick from empty weighted items');
		expect(() => pickWeighted([{ value: 'x', weight: -1 }])).toThrow('weights must be finite numbers >= 0');
		expect(() => pickWeighted([{ value: 'x', weight: 0 }])).toThrow('total weight must be > 0');
	});
});
