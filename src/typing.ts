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
 * Flattens mapped/intersection display in editor tooltips.
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};
/**
 * Discriminated result type for success/failure operations.
 */
export type Result<T, E = unknown> = { ok: true; value: T } | { ok: false; error: E };
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
 * Creates a successful {@link Result}.
 *
 * @param value Success value.
 */
export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

/**
 * Creates a failed {@link Result}.
 *
 * @param error Failure value.
 */
export function err<E>(error: E): Result<never, E> {
	return { ok: false, error };
}

/**
 * Type guard for successful {@link Result} values.
 *
 * @param result Result to check.
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
	return result.ok;
}

/**
 * Maps only the success branch of a {@link Result}.
 *
 * @param result Result to map.
 * @param mapper Success mapper.
 */
export function mapOk<T, U, E>(result: Result<T, E>, mapper: (value: T) => U): Result<U, E> {
	if (!result.ok) {
		return result;
	}

	return ok(mapper(result.value));
}

/**
 * Maps only the error branch of a {@link Result}.
 *
 * @param result Result to map.
 * @param mapper Error mapper.
 */
export function mapErr<T, E, F>(result: Result<T, E>, mapper: (error: E) => F): Result<T, F> {
	if (result.ok) {
		return result;
	}

	return err(mapper(result.error));
}

/**
 * Executes a function and captures any thrown error as a {@link Result}.
 *
 * @typeParam T - The success value type.
 *
 * @param operation Function to execute.
 *
 * @returns A {@link Result} containing the returned value on success,
 * or the thrown error as `unknown` on failure.
 */
export function tryCatch<T>(operation: () => T): Result<T, unknown>;
/**
 * Executes a function and captures any thrown error as a {@link Result},
 * mapping the error to a custom type.
 *
 * @typeParam T - The success value type.
 * @typeParam E - The mapped error type.
 *
 * @param operation Function to execute.
 * @param mapError Function to transform the thrown error into a typed value.
 *
 * @returns A {@link Result} containing the returned value on success,
 * or the mapped error on failure.
 */
export function tryCatch<T, E>(operation: () => T, mapError: (e: unknown) => E): Result<T, E>;
export function tryCatch<T, E>(operation: () => T, mapError?: (e: unknown) => E) {
	try {
		return ok(operation());
	} catch (e) {
		return err(mapError ? mapError(e) : e);
	}
}

/**
 * Runs an async operation and converts thrown errors into a failed {@link Result}.
 *
 * @param operation Async operation to execute.
 */
export async function tryCatchAsync<T>(operation: () => Awaitable<T>): Promise<Result<T, unknown>>;
/**
 * Runs an async operation and maps thrown errors into a custom error type.
 *
 * @param operation Async operation to execute.
 * @param mapError Error mapper.
 */
export async function tryCatchAsync<T, E>(operation: () => Awaitable<T>, mapError: (error: unknown) => E
): Promise<Result<T, E>>;
export async function tryCatchAsync<T, E>(operation: () => Awaitable<T>, mapError?: (error: unknown) => E) {
	try {
		return ok(await operation());
	} catch (error) {
		return err(mapError ? mapError(error) : error);
	}
}
