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
 * Class constructor type.
 */
export type Class<T, Args extends unknown[] = any[]> = new (...args: Args) => T;

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
export async function tryCatchAsync<T, E>(
	operation: () => Awaitable<T>,
	mapError: (error: unknown) => E
): Promise<Result<T, E>>;
export async function tryCatchAsync<T, E>(
	operation: () => Awaitable<T>,
	mapError?: (error: unknown) => E
) {
	try {
		return ok(await operation());
	} catch (error) {
		return err(mapError ? mapError(error) : error);
	}
}
