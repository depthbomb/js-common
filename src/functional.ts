import { Fn } from './typing';

interface IDeprecateOptions {
	deprecatedName?: string;
	replacementName?: string;
	deprecatedSince?: string;
	removedIn?: string;
}

/**
 * Creates a function that calls the given function only once.
 *
 * @param fn Function to be called only once
 * @returns A new function that calls the original function only once
 */
export function once<T extends Fn<any, any>>(fn: T): T {
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
export function pipe<T>(value: T, ...fns: Array<Fn<any, any>>): any {
	return fns.reduce((v, f) => f(v), value);
}

/**
 * Designates a function as deprecated by showing a console warning when calling it.
 *
 * @param fn The function to wrap.
 * @param options Options to customize the deprecation message.
 */
export function deprecate<T extends Fn<any, any>>(fn: T, options: IDeprecateOptions = {}): T {
	const {
		deprecatedName = fn.name || 'Anonymous function',
		deprecatedSince,
		removedIn,
		replacementName
	} = options;

	const messageParts = [`[DEPRECATED] ${deprecatedName} is deprecated`];

	if (deprecatedSince) {
		messageParts.push(`since ${deprecatedSince}`);
	}

	if (removedIn) {
		messageParts.push(`and will be removed in ${removedIn}`);
	}

	if (replacementName) {
		messageParts.push(`Use ${replacementName} instead.`);
	}

	const message = messageParts.join(' ') + '.';

	return ((...args: Parameters<T>) => {
		console.warn(message);
		return fn(...args);
	}) as T;
}
