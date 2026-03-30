import type { Awaitable } from './typing';

/**
 * Configuration for promise concurrency helpers.
 */
export interface IConcurrencyOptions {
	concurrency?: number;
}

/**
 * Detailed output from {@link allSettledDetailed}.
 */
export interface ISettledDetailed<T> {
	results: Array<PromiseSettledResult<T>>;
	fulfilled: T[];
	rejected: unknown[];
}

/**
 * Waits for all promises to settle and returns an array of successful results.
 *
 * @param promises An array of promises to wait for
 * @returns A promise that resolves to an array of successful results
 */
export async function allSettledSuccessful<T>(promises: Array<Awaitable<T>>): Promise<T[]> {
	const results = await Promise.allSettled(promises) as Array<PromiseSettledResult<T>>;
	return results
		.filter((r): r is PromiseFulfilledResult<T> => r.status === 'fulfilled')
		.map((r) => r.value);
}

/**
 * Waits for all values to settle and returns full settled results plus split fulfilled/rejected lists.
 *
 * @param promises Values or promises to settle.
 */
export async function allSettledDetailed<T>(promises: Array<Awaitable<T>>): Promise<ISettledDetailed<T>> {
	const results   = await Promise.allSettled(promises) as Array<PromiseSettledResult<T>>;
	const fulfilled = [] as T[];
	const rejected  = [] as unknown[];

	for (const result of results) {
		if (result.status === 'fulfilled') {
			fulfilled.push(result.value);
			continue;
		}

		rejected.push(result.reason);
	}

	return { results, fulfilled, rejected };
}

/**
 * Executes an array of asynchronous tasks sequentially.
 *
 * @param tasks An array of functions that return promises
 * @returns A promise that resolves to an array of results from the input tasks
 */
export async function sequential<T>(tasks: Array<() => Awaitable<T>>): Promise<T[]> {
	const results = [] as T[];
	for (const task of tasks) {
		results.push(await task());
	}

	return results;
}

/**
 * Runs asynchronous tasks with a concurrency limit while preserving result order.
 *
 * @param tasks Task functions to execute.
 * @param options Concurrency options.
 */
export async function pool<T>(tasks: Array<() => Awaitable<T>>, options: IConcurrencyOptions = {}): Promise<T[]> {
	if (tasks.length === 0) {
		return [];
	}

	const concurrency = validateConcurrency(options.concurrency ?? tasks.length);
	const results     = new Array<T>(tasks.length);

	let nextIndex = 0;

	async function worker() {
		while (true) {
			const index = nextIndex++;
			if (index >= tasks.length) {
				return;
			}

			results[index] = await tasks[index]();
		}
	}

	const workerCount = Math.min(concurrency, tasks.length);
	const workers     = Array.from({ length: workerCount }, () => worker());

	await Promise.all(workers);

	return results;
}

/**
 * Maps values using an async mapper with a concurrency limit.
 *
 * @param values Input values.
 * @param mapper Mapping function.
 * @param options Concurrency options.
 */
export async function pMap<T, U>(values: Iterable<T>, mapper: (value: T, index: number) => Awaitable<U>, options: IConcurrencyOptions = {}): Promise<U[]> {
	const tasks = [] as Array<() => Awaitable<U>>;
	let index = 0;
	for (const value of values) {
		const currentIndex = index++;
		tasks.push(() => mapper(value, currentIndex));
	}

	return pool(tasks, options);
}

function validateConcurrency(concurrency: number) {
	if (!Number.isInteger(concurrency) || concurrency < 1) {
		throw new Error('concurrency must be an integer >= 1');
	}

	return concurrency;
}
