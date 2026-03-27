import type { Maybe } from './typing';

/**
 * Creates a getter that computes its value once and then returns the cached result.
 *
 * @param factory Function used to create the value.
 * @returns A zero-argument getter for the lazily-created value.
 */
export function lazy<T>(factory: () => T): () => T {
	let cached: Maybe<T>;
	let initialized = false;

	return () => {
		if (!initialized) {
			cached = factory();
			initialized = true;
		}

		return cached!;
	};
}

/**
 * Creates a getter that runs an async factory once and reuses the same promise.
 *
 * @param factory Async function used to create the value.
 * @returns A zero-argument getter returning the cached promise.
 */
export function lazyAsync<T>(factory: () => Promise<T>): () => Promise<T> {
	let promise: Maybe<Promise<T>>;

	return () => {
		if (!promise) {
			promise = factory();
		}

		return promise;
	};
}
