/** Lazily split values into fixed-size arrays. */
export function* chunk<T>(values: Iterable<T>, size: number): IterableIterator<T[]> {
	if (!Number.isInteger(size) || size < 1) {
		throw new Error('size must be an integer >= 1');
	}

	let current: T[] = [];

	for (const value of values) {
		current.push(value);

		if (current.length === size) {
			yield current;
			current = [];
		}
	}

	if (current.length > 0) {
		yield current;
	}
}

/** Split values into matching and non-matching arrays in one pass. */
export function partition<T>(values: Iterable<T>, predicate: (value: T, index: number) => boolean): [T[], T[]] {
	const matches: T[] = [];
	const rest: T[] = [];
	let index = 0;

	for (const value of values) {
		(predicate(value, index++) ? matches : rest).push(value);
	}

	return [matches, rest];
}

/** Group values into a map using a selected key. */
export function groupBy<T, K>(values: Iterable<T>, keySelector: (value: T, index: number) => K): Map<K, T[]> {
	const groups = new Map<K, T[]>();
	let index = 0;

	for (const value of values) {
		const key = keySelector(value, index++);
		const group = groups.get(key);

		if (group) {
			group.push(value);
		} else {
			groups.set(key, [value]);
		}
	}

	return groups;
}

/** Lazily yield the first value for each selected key. */
export function* uniqueBy<T, K>(values: Iterable<T>, keySelector: (value: T, index: number) => K): IterableIterator<T> {
	const seen = new Set<K>();
	let index = 0;

	for (const value of values) {
		const key = keySelector(value, index++);

		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		yield value;
	}
}

/** Lazily pair values until either input is exhausted. */
export function* zip<T, U>(left: Iterable<T>, right: Iterable<U>): IterableIterator<[T, U]> {
	const leftIterator = left[Symbol.iterator]();
	const rightIterator = right[Symbol.iterator]();

	while (true) {
		const leftResult = leftIterator.next();
		const rightResult = rightIterator.next();

		if (leftResult.done || rightResult.done) {
			leftIterator.return?.();
			rightIterator.return?.();

			return;
		}

		yield [leftResult.value, rightResult.value];
	}
}

/** Lazily produce full sliding windows from an iterable. */
export function* windowed<T>(values: Iterable<T>, size: number, step = 1): IterableIterator<T[]> {
	if (!Number.isInteger(size) || size < 1) {
		throw new Error('size must be an integer >= 1');
	}

	if (!Number.isInteger(step) || step < 1) {
		throw new Error('step must be an integer >= 1');
	}

	const window: T[] = [];
	let skip = 0;

	for (const value of values) {
		if (skip > 0) {
			skip--;
			continue;
		}

		window.push(value);

		if (window.length === size) {
			yield window.slice();

			if (step <= size) {
				window.splice(0, step);
			} else {
				window.length = 0;
				skip = step - size;
			}
		}
	}
}

/** Lazily produce a half-open numeric range. */
export function range(end: number): IterableIterator<number>;
export function range(start: number, end: number, step?: number): IterableIterator<number>;
export function* range(startOrEnd: number, end?: number, step = 1): IterableIterator<number> {
	const start = end === undefined ? 0 : startOrEnd;
	const stop = end === undefined ? startOrEnd : end;

	if (![start, stop, step].every(Number.isFinite)) {
		throw new Error('range values must be finite numbers');
	}

	if (step === 0) {
		throw new Error('step must not be 0');
	}

	if (step > 0) {
		for (let value = start; value < stop; value += step) {
			yield value;
		}

		return;
	}

	for (let value = start; value > stop; value += step) {
		yield value;
	}
}
