import type { Class } from './typing';

export type Falsy    = false | 0 | 0n | '' | null | undefined;
export type DateLike = Date | string | number;

export function isString(value: unknown): value is string {
	return typeof value === 'string';
}

export function isNonEmptyString(value: unknown): value is string {
	return isString(value) && value.length > 0;
}

export function isNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

export function isPositiveNumber(value: unknown): value is number {
	return isNumber(value) && value > 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isFunction(value: unknown): value is Function {
	return typeof value === 'function';
}

export function isClass<T = unknown>(value: unknown): value is Class<T> {
	return isFunction(value) && value.toString().startsWith('class');
}

export function isNull(value: unknown): value is null {
	return value === null;
}

export function isUndefined(value: unknown): value is undefined {
	return value === undefined;
}

export function isNullOrUndefined(value: unknown): value is null | undefined {
	return isNull(value) || isUndefined(value);
}

export function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean';
}

export function isTruthy<T>(value: T | Falsy): value is T {
	return Boolean(value);
}

export function isFalsy(value: unknown): value is Falsy {
	return !value;
}

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

export const is = {
	string: isString,
	nonEmptyString: isNonEmptyString,
	number: isNumber,
	positiveNumber: isPositiveNumber,
	record: isRecord,
	function: isFunction,
	class: isClass,
	null: isNull,
	undefined: isUndefined,
	nullOrUndefined: isNullOrUndefined,
	boolean: isBoolean,
	truthy: isTruthy,
	falsy: isFalsy,
	dateLike: isDateLike
};

function isValidDate(date: Date): boolean {
	return !Number.isNaN(date.getTime());
}
