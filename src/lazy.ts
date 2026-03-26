import type { Maybe } from './types';

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

export function lazyAsync<T>(factory: () => Promise<T>): () => Promise<T> {
	let promise: Maybe<Promise<T>>;

	return () => {
		if (!promise) {
			promise = factory();
		}

		return promise;
	};
}

export function resettableLazy<T>(factory: () => T) {
	let cached: Maybe<T>;
	let initialized = false;

	function get(): T {
		if (!initialized) {
			cached = factory();
			initialized = true;
		}
		return cached!;
	}

	function reset() {
		initialized = false;
		cached = undefined;
	}

	return { get, reset };
}
