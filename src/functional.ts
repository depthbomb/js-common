/**
 * Creates a function that calls the given function only once.
 *
 * @param fn Function to be called only once
 * @returns A new function that calls the original function only once
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
	let called = false;
	let result: ReturnType<T>;

	return ((...args: Parameters<T>) => {
		if (!called) {
			result = fn(...args);
			called = true;
		}

		return result;
	}) as T;
}

/**
 * Pipes a value through a sequence of functions, passing the result of each function to the next.
 *
 * @param value Initial value to pass into the first function
 * @param fns Functions to apply in order
 * @returns The result of applying all functions to the initial value
 */
export function pipe<T>(value: T, ...fns: Array<(v: any) => any>): any {
	return fns.reduce((v, f) => f(v), value);
}
