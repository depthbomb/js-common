import { it, expect, describe } from 'vitest';
import {
	is,
	isNull,
	isClass,
	isFalsy,
	isNumber,
	isRecord,
	isString,
	isTruthy,
	isBoolean,
	isPromise,
	isDateLike,
	isFunction,
	isUndefined,
	isNonEmptyString,
	isPositiveNumber,
	isNullOrUndefined
} from '../dist/guards.mjs';

describe('guards', () => {
	it('isString matches only string values', () => {
		expect(isString('hello')).toBe(true);
		expect(isString('')).toBe(true);
		expect(isString(1)).toBe(false);
		expect(isString(null)).toBe(false);
	});

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

	it('isPositiveNumber matches finite numbers greater than 0', () => {
		expect(isPositiveNumber(1)).toBe(true);
		expect(isPositiveNumber(0.0001)).toBe(true);
		expect(isPositiveNumber(0)).toBe(false);
		expect(isPositiveNumber(-1)).toBe(false);
		expect(isPositiveNumber(Number.POSITIVE_INFINITY)).toBe(false);
	});

	it('isFunction, isPromise, and isClass classify callable values correctly', () => {
		class ExampleClass {}
		function regularFunction() {}
		const promise = Promise.resolve(42);
		const nonPromise = 123;
		const thenable = { then: () => {} };

		expect(isFunction(regularFunction)).toBe(true);
		expect(isFunction(ExampleClass)).toBe(true);
		expect(isFunction({})).toBe(false);

		expect(isPromise(promise)).toBe(true);
		expect(isPromise(nonPromise)).toBe(false);
		expect(isPromise(regularFunction)).toBe(false);
		expect(isPromise({})).toBe(false);
		expect(isPromise(thenable)).toBe(true);

		expect(isClass(ExampleClass)).toBe(true);
		expect(isClass(regularFunction)).toBe(false);
		expect(isClass(() => null)).toBe(false);
	});

	it('nullish and boolean guards match their exact primitives', () => {
		expect(isNull(null)).toBe(true);
		expect(isNull(undefined)).toBe(false);

		expect(isUndefined(undefined)).toBe(true);
		expect(isUndefined(null)).toBe(false);

		expect(isNullOrUndefined(null)).toBe(true);
		expect(isNullOrUndefined(undefined)).toBe(true);
		expect(isNullOrUndefined(0)).toBe(false);

		expect(isBoolean(true)).toBe(true);
		expect(isBoolean(false)).toBe(true);
		expect(isBoolean(1)).toBe(false);
	});

	it('isTruthy and isFalsy align with JavaScript truthiness', () => {
		expect(isTruthy('a')).toBe(true);
		expect(isTruthy(1)).toBe(true);
		expect(isTruthy(false)).toBe(false);
		expect(isTruthy('')).toBe(false);
		expect(isTruthy(0)).toBe(false);
		expect(isTruthy(null)).toBe(false);

		expect(isFalsy(false)).toBe(true);
		expect(isFalsy('')).toBe(true);
		expect(isFalsy(0)).toBe(true);
		expect(isFalsy(undefined)).toBe(true);
		expect(isFalsy('a')).toBe(false);
		expect(isFalsy(1)).toBe(false);
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

	it('is object exposes aliases for all guard functions', () => {
		expect(is.string).toBe(isString);
		expect(is.nonEmptyString).toBe(isNonEmptyString);
		expect(is.number).toBe(isNumber);
		expect(is.positiveNumber).toBe(isPositiveNumber);
		expect(is.record).toBe(isRecord);
		expect(is.function).toBe(isFunction);
		expect(is.promise).toBe(isPromise);
		expect(is.class).toBe(isClass);
		expect(is.null).toBe(isNull);
		expect(is.undefined).toBe(isUndefined);
		expect(is.nullOrUndefined).toBe(isNullOrUndefined);
		expect(is.boolean).toBe(isBoolean);
		expect(is.truthy).toBe(isTruthy);
		expect(is.falsy).toBe(isFalsy);
		expect(is.dateLike).toBe(isDateLike);
	});
});
