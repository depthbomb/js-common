export type Awaitable<T>           = PromiseLike<T> | T;
export type Maybe<T>               = T | undefined;
export type Nullable<T>            = T | null;
export type Result<T, E = unknown> = { ok: true; value: T } | { ok: false; error: E };

export const cast = <T, U extends T>(value: U) => value;

export function assume<T>(value: unknown): asserts value is T {}

export function typedEntries<T extends object>(obj: T) {
	return Object.entries(obj) as {
		[K in keyof T]: [K, T[K]];
	}[keyof T][];
}

export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
	return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
	return result.ok;
}

export function mapOk<T, U, E>(result: Result<T, E>, mapper: (value: T) => U): Result<U, E> {
	if (!result.ok) {
		return result;
	}

	return ok(mapper(result.value));
}

export function mapErr<T, E, F>(result: Result<T, E>, mapper: (error: E) => F): Result<T, F> {
	if (result.ok) {
		return result;
	}

	return err(mapper(result.error));
}

export async function tryCatchAsync<T>(operation: () => Awaitable<T>): Promise<Result<T, unknown>>;
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
