import { Fn } from './typing';
import { once as _once } from './atomic';

interface IDeprecateOptions {
	deprecatedName?: string;
	replacementName?: string;
	deprecatedSince?: string;
	removedIn?: string;
}

/**
 * @deprecated
 * Import from the `atomic` module instead.
 */
export const once = deprecate(_once, {
	deprecatedName: 'functional#once',
	replacementName: 'atomic#once',
	deprecatedSince: '2.5.0',
	removedIn: '3.0.0'
});

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
