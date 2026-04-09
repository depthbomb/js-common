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
 * Generic runtime type guard function.
 */
export type Guard<T> = (value: unknown) => value is T;

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
 * Returns `true` when `value` is an array whose items all satisfy `guard`.
 *
 * @param value Value to check.
 * @param guard Element guard applied to every item.
 */
export function isArrayOf<T>(value: unknown, guard: Guard<T>): value is T[] {
	return Array.isArray(value) && value.every(item => guard(item));
}

/**
 * Returns `true` when `value` is callable.
 *
 * @param value Value to check.
 */
export function isFunction(value: unknown): value is (...args: never[]) => unknown {
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
		typeof (value as { then?: unknown }).then === 'function'
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
 * Returns `true` when `value` has the provided property key.
 *
 * @param value Value to check.
 * @param key Property key to look for.
 */
export function hasKey<K extends PropertyKey>(value: unknown, key: K): value is Record<K, unknown> {
	return (typeof value === 'object' || typeof value === 'function')
		&& value !== null
		&& key in value;
}

/**
 * Returns `true` when `value` has every provided property key.
 *
 * @param value Value to check.
 * @param keys Property keys to require.
 */
export function hasKeys<K extends PropertyKey>(value: unknown, ...keys: K[]): value is Record<K, unknown> {
	return keys.every(key => hasKey(value, key));
}

/**
 * Returns `true` when `value` matches a field-to-guard object shape.
 *
 * @param value Value to check.
 * @param shape Object whose values are guards for each corresponding property.
 */
export function hasShape<T extends Record<PropertyKey, unknown>>(
	value: unknown,
	shape: { [K in keyof T]: Guard<T[K]> }
): value is T {
	if (!isRecord(value)) {
		return false;
	}

	for (const key of Reflect.ownKeys(shape) as Array<keyof T>) {
		const guard = shape[key];
		if (!hasKey(value, key) || !guard(value[key])) {
			return false;
		}
	}

	return true;
}

/**
 * Returns `true` when `value` is strictly equal to one of the provided literals.
 *
 * @param value Value to check.
 * @param options Allowed literal values.
 */
export function isOneOf<const T extends readonly unknown[]>(value: unknown, options: T): value is T[number] {
	return options.some(option => Object.is(option, value));
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
	arrayOf: isArrayOf,
	function: isFunction,
	promise: isPromise,
	class: isClass,
	null: isNull,
	undefined: isUndefined,
	nullOrUndefined: isNullOrUndefined,
	boolean: isBoolean,
	oneOf: isOneOf,
	truthy: isTruthy,
	falsy: isFalsy,
	dateLike: isDateLike
};

/**
 * Namespaced aliases for all guard helpers.
 */
export const has = {
	key: hasKey,
	keys: hasKeys,
	shape: hasShape,
};

function isValidDate(date: Date) {
	return !Number.isNaN(date.getTime());
}
