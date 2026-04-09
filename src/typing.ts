import { deprecate } from './functional';
import {
	ok as _ok,
	err as _err,
	isOk as _isOk,
	mapOk as _mapOk,
	mapErr as _mapErr,
	tryCatch as _tryCatch,
	tryCatchAsync as _tryCatchAsync
} from './result';

/**
 * A value or a promise-like value.
 */
export type Awaitable<T> = PromiseLike<T> | T;
/**
 * A value that may be `undefined`.
 */
export type Maybe<T> = T | undefined;
/**
 * A value that may be `null`.
 */
export type Nullable<T> = T | null;
/**
 * A single value or an array of values.
 */
export type Arrayable<T> = T | Array<T>;
/**
 * Union of all value types from object `T`.
 */
export type ValueOf<T> = T[keyof T];
/**
 * Flattens mapped/intersection display in editor tooltips.
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};
/**
 * A generic function type.
 */
export type Fn<Return = void, Args extends unknown[] = unknown[]> = (...args: Args) => Return;
/**
 * A generic function type that may return either a value or a promise-like value.
 */
export type AwaitableFn<Return = void, Args extends unknown[] = unknown[]> = (...args: Args) => Awaitable<Return>;
/**
 * Class constructor type.
 */
export type Class<T, Args extends unknown[] = any[]> = new (...args: Args) => T;
/**
 * A tuple-based array type with at least one item.
 */
export type NonEmptyArray<T> = [T, ...T[]];
/**
 * Branded nominal type built from a structural base type.
 */
export type Brand<T, Tag extends string> = T & {
	readonly __brand: Tag;
};
/**
 * Primitive JavaScript values.
 */
export type Primitive = string | number | bigint | boolean | symbol | null | undefined;
/**
 * @deprecated
 * Use {@link JSONPrimitive} instead.
 * JSON primitive values.
 */
export type JsonPrimitive = string | number | boolean | null;
/**
 * JSON primitive values.
 */
export type JSONPrimitive = string | number | boolean | null;
/**
 * @deprecated
 * Use {@link JSONValue} instead.
 * Any JSON-serializable value.
 */
export type JsonValue = JSONPrimitive | JSONArray | JSONObject;
/**
 * Any JSON-serializable value.
 */
export type JSONValue = JSONPrimitive | JSONArray | JSONObject;
/**
 * @deprecated
 * Use {@link JSONArray} instead.
 * JSON arrays.
 */
export type JsonArray = JSONValue[];
/**
 * JSON arrays.
 */
export type JSONArray = JSONValue[];
/**
 * @deprecated
 * Use {@link JSONObject} instead.
 * JSON objects.
 */
export type JsonObject = { [key: string]: JSONValue; };
/**
 * JSON objects.
 */
export type JSONObject = { [key: string]: JSONValue; };
/**
 * Ensures all properties of an object type are non-nullable.
 *
 * This removes both `null` and `undefined` from each property in `T`,
 * making all values strictly defined.
 *
 * @typeParam T - Object type whose values should be made non-nullable.
 */
export type NonNullableValues<T> = { [K in keyof T]: NonNullable<T[K]> };
/**
 * Recursively marks all properties of a type as `readonly`.
 *
 * Arrays are converted to `ReadonlyArray`, and nested objects are
 * deeply frozen at the type level.
 *
 * @typeParam T - Type to make deeply readonly.
 */
export type DeepReadonly<T> = T extends (infer U)[] ? ReadonlyArray<DeepReadonly<U>> : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
/**
 * Recursively makes all properties of a type optional.
 *
 * Useful for partial updates or patch-style APIs where only a subset
 * of fields may be provided. Applies deeply to nested objects.
 *
 * @typeParam T - Type to make deeply partial.
 */
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
/**
 * Keys of `T` whose properties are optional.
 *
 * @typeParam T - Object type to inspect.
 */
export type OptionalKeys<T extends object> = {
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	[K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];
/**
 * Keys of `T` whose properties are required.
 *
 * @typeParam T - Object type to inspect.
 */
export type RequiredKeys<T extends object> = Exclude<keyof T, OptionalKeys<T>>;

/**
 * Recasts a value to a wider target type without runtime transformation.
 *
 * @param value Input value.
 */
export const cast = <T, U extends T>(value: U) => value;

/**
 * Asserts an unknown value as type `T` at compile time.
 *
 * @param value Value to assert.
 */
export function assume<T>(value: unknown): asserts value is T {}

/**
 * Returns strongly typed `Object.entries` output.
 *
 * @param obj Object to enumerate.
 */
export function typedEntries<T extends object>(obj: T) {
	return Object.entries(obj) as {
		[K in keyof T]: [K, T[K]];
	}[keyof T][];
}

/**
 * @deprecated
 * Import from the `result` module instead.
 */
export const ok = deprecate(_ok, {
	deprecatedName: 'typing.ok',
	replacementName: 'result.ok',
	deprecatedSince: '2.3.0',
	removedIn: '3.0.0'
});

/**
 * @deprecated
 * Import from the `result` module instead.
 */
export const err = deprecate(_err, {
	deprecatedName: 'typing.err',
	replacementName: 'result.err',
	deprecatedSince: '2.3.0',
	removedIn: '3.0.0'
});

/**
 * @deprecated
 * Import from the `result` module instead.
 */
export const isOk = deprecate(_isOk, {
	deprecatedName: 'typing.isOk',
	replacementName: 'result.isOk',
	deprecatedSince: '2.3.0',
	removedIn: '3.0.0'
});

/**
 * @deprecated
 * Import from the `result` module instead.
 */
export const mapOk = deprecate(_mapOk, {
	deprecatedName: 'typing.mapOk',
	replacementName: 'result.mapOk',
	deprecatedSince: '2.3.0',
	removedIn: '3.0.0'
});

/**
 * @deprecated
 * Import from the `result` module instead.
 */
export const mapErr = deprecate(_mapErr, {
	deprecatedName: 'typing.mapErr',
	replacementName: 'result.mapErr',
	deprecatedSince: '2.3.0',
	removedIn: '3.0.0'
});

/**
 * @deprecated
 * Import from the `result` module instead.
 */
export const tryCatch = deprecate(_tryCatch, {
	deprecatedName: 'typing.tryCatch',
	replacementName: 'result.tryCatch',
	deprecatedSince: '2.3.0',
	removedIn: '3.0.0'
});

/**
 * @deprecated
 * Import from the `result` module instead.
 */
export const tryCatchAsync = deprecate(_tryCatchAsync, {
	deprecatedName: 'typing.tryCatchAsync',
	replacementName: 'result.tryCatchAsync',
	deprecatedSince: '2.3.0',
	removedIn: '3.0.0'
});
