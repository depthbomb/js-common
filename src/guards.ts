import type { Class } from './typing';

/**
 * Values that coerce to `false` in JavaScript conditionals.
 */
export type Falsy = false | 0 | 0n | '' | null | undefined;
/**
 * Inputs that can be converted into a valid date.
 */
export type DateLike = Date | string | number;

/**
 * Returns `true` when `value` is a string.
 *
 * @param value Value to check.
 */
export function isString(value: unknown): value is string {
	return typeof value === 'string';
}

/**
 * Returns `true` when `value` is a string with at least one character.
 *
 * @param value Value to check.
 */
export function isNonEmptyString(value: unknown): value is string {
	return isString(value) && value.length > 0;
}

/**
 * Returns `true` when `value` is a finite number.
 *
 * @param value Value to check.
 */
export function isNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Returns `true` when `value` is a finite number greater than `0`.
 *
 * @param value Value to check.
 */
export function isPositiveNumber(value: unknown): value is number {
	return isNumber(value) && value > 0;
}

/**
 * Returns `true` when `value` is a non-null object and not an array.
 *
 * @param value Value to check.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Returns `true` when `value` is callable.
 *
 * @param value Value to check.
 */
export function isFunction(value: unknown): value is Function {
	return typeof value === 'function';
}

/**
 * Returns `true` when `value` is a {@link PromiseConstructor|Promise}.
 *
 * @param value Value to check.
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'then' in value &&
		typeof (value as any).then === 'function'
	);
}

/**
 * Returns `true` when `value` is an ES class constructor.
 *
 * @param value Value to check.
 *
 * @remarks
 * May be unreliable in minified environments.
 */
export function isClass<T = unknown>(value: unknown): value is Class<T> {
	if (!isFunction(value)) {
		return false;
	}

	return Function.prototype.toString.call(value).startsWith('class');
}

/**
 * Returns `true` when `value` is `null`.
 *
 * @param value Value to check.
 */
export function isNull(value: unknown): value is null {
	return value === null;
}

/**
 * Returns `true` when `value` is `undefined`.
 *
 * @param value Value to check.
 */
export function isUndefined(value: unknown): value is undefined {
	return value === undefined;
}

/**
 * Returns `true` when `value` is either `null` or `undefined`.
 *
 * @param value Value to check.
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
	return isNull(value) || isUndefined(value);
}

/**
 * Returns `true` when `value` is a boolean.
 *
 * @param value Value to check.
 */
export function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean';
}

/**
 * Returns `true` when `value` is truthy.
 *
 * @param value Value to check.
 */
export function isTruthy<T>(value: T | Falsy): value is T {
	return Boolean(value);
}

/**
 * Returns `true` when `value` is falsy.
 *
 * @param value Value to check.
 */
export function isFalsy(value: unknown): value is Falsy {
	return !value;
}

/**
 * Returns `true` when `value` can be converted to a valid `Date`.
 *
 * @param value Value to check.
 */
export function isDateLike(value: unknown): value is DateLike {
	if (value instanceof Date) {
		return isValidDate(value);
	}

	if (isNumber(value)) {
		return isValidDate(new Date(value));
	}

	if (isString(value)) {
		return isValidDate(new Date(value));
	}

	return false;
}

/**
 * Namespaced aliases for all guard helpers.
 */
export const is = {
	string: isString,
	nonEmptyString: isNonEmptyString,
	number: isNumber,
	positiveNumber: isPositiveNumber,
	record: isRecord,
	function: isFunction,
	promise: isPromise,
	class: isClass,
	null: isNull,
	undefined: isUndefined,
	nullOrUndefined: isNullOrUndefined,
	boolean: isBoolean,
	truthy: isTruthy,
	falsy: isFalsy,
	dateLike: isDateLike
};

function isValidDate(date: Date) {
	return !Number.isNaN(date.getTime());
}
