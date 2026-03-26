/**
 * Waits for all promises to settle and returns an array of successful results.
 *
 * @param promises An array of promises to wait for
 * @returns A promise that resolves to an array of successful results
 */
export async function allSettledSuccessful<T>(promises: Array<Promise<T>>): Promise<T[]> {
	const results = await Promise.allSettled(promises) as Array<PromiseSettledResult<T>>;
	return results
		.filter((r): r is PromiseFulfilledResult<T> => r.status === 'fulfilled')
		.map((r) => r.value);
}

/**
 * Executes an array of asynchronous tasks sequentially.
 *
 * @param tasks An array of functions that return promises
 * @returns A promise that resolves to an array of results from the input tasks
 */
export async function sequential<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
	const results = [] as T[];
	for (const task of tasks) {
		results.push(await task());
	}

	return results;
}
