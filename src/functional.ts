type AnyFn = (...args: never[]) => unknown;
type PipeFn = (value: never) => unknown;

interface IDeprecateOptions {
	deprecatedName?: string;
	replacementName?: string;
	deprecatedSince?: string;
	removedIn?: string;
}

/**
 * Pipes a value through a sequence of functions, passing the result of each function to the next.
 *
 * @param value Initial value to pass into the first function
 * @param fns Functions to apply in order
 */
export function pipe<T>(value: T, ...fns: Array<PipeFn>): unknown {
	let result: unknown = value;

	for (const fn of fns) {
		result = fn(result as never);
	}

	return result;
}

/**
 * Designates a function as deprecated by showing a console warning when calling it.
 *
 * @param fn The function to wrap.
 * @param options Options to customize the deprecation message.
 */
export function deprecate<T extends AnyFn>(fn: T, options: IDeprecateOptions = {}): T {
	const {
		deprecatedName = fn.name || 'Anonymous function',
		deprecatedSince,
		removedIn,
		replacementName
	} = options;

	const details = [] as string[];

	if (deprecatedSince) {
		details.push(`since ${deprecatedSince}`);
	}

	if (removedIn) {
		details.push(`will be removed in ${removedIn}`);
	}

	const status    = details.length > 0 ? ` ${details.join(' and ')}` : '';
	const sentences = [`[DEPRECATED] ${deprecatedName} is deprecated${status}.`];

	if (replacementName) {
		sentences.push(`Use ${replacementName} instead.`);
	}

	const message = sentences.join(' ');

	return ((...args: Parameters<T>) => {
		console.warn(message);
		return fn(...args);
	}) as T;
}
