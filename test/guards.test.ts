import { it, expect, describe } from 'vitest';
import { isNumber, isRecord, isDateLike, isNonEmptyString } from '../dist/guards.mjs';

describe('guards', () => {
	it('isRecord matches plain object-like values and excludes arrays/null', () => {
		expect(isRecord({ a: 1 })).toBe(true);
		expect(isRecord(Object.create(null))).toBe(true);
		expect(isRecord([])).toBe(false);
		expect(isRecord(null)).toBe(false);
		expect(isRecord('x')).toBe(false);
	});

	it('isNonEmptyString matches only strings with length > 0', () => {
		expect(isNonEmptyString('a')).toBe(true);
		expect(isNonEmptyString(' ')).toBe(true);
		expect(isNonEmptyString('')).toBe(false);
		expect(isNonEmptyString(1)).toBe(false);
	});

	it('isNumber matches only finite numbers', () => {
		expect(isNumber(1)).toBe(true);
		expect(isNumber(0)).toBe(true);
		expect(isNumber(Number.NaN)).toBe(false);
		expect(isNumber(Number.POSITIVE_INFINITY)).toBe(false);
		expect(isNumber('1')).toBe(false);
	});

	it('isDateLike matches valid date inputs and rejects invalid ones', () => {
		expect(isDateLike(new Date('2026-01-01T00:00:00.000Z'))).toBe(true);
		expect(isDateLike(new Date('invalid'))).toBe(false);
		expect(isDateLike('2026-01-01')).toBe(true);
		expect(isDateLike('not-a-date')).toBe(false);
		expect(isDateLike(1_700_000_000_000)).toBe(true);
		expect(isDateLike(Number.NaN)).toBe(false);
		expect(isDateLike({})).toBe(false);
	});
});
