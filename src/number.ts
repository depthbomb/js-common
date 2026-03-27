/**
 * Restricts a number to the closed interval `[min, max]`.
 *
 * @param value Input value.
 * @param min Lower bound.
 * @param max Upper bound.
 */
export function clamp(value: number, min: number, max: number): number {
	if (min > max) {
		throw new Error('min must be <= max');
	}

	return Math.min(Math.max(value, min), max);
}

/**
 * Returns whether a number is within the provided range.
 *
 * @param value Input value.
 * @param min Lower bound.
 * @param max Upper bound.
 * @param inclusive Whether range endpoints are included.
 */
export function inRange(value: number, min: number, max: number, inclusive = true): boolean {
	if (min > max) {
		throw new Error('min must be <= max');
	}

	if (inclusive) {
		return value >= min && value <= max;
	}

	return value > min && value < max;
}

/**
 * Rounds a number to a fixed count of decimal places.
 *
 * @param value Number to round.
 * @param decimals Decimal places to keep.
 */
export function roundTo(value: number, decimals = 0): number {
	if (!Number.isInteger(decimals) || decimals < 0) {
		throw new Error('decimals must be an integer >= 0');
	}

	const factor = 10 ** decimals;
	return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Sums all numbers from an iterable.
 *
 * @param values Numbers to add.
 */
export function sum(values: Iterable<number>): number {
	let total = 0;
	for (const value of values) {
		total += value;
	}

	return total;
}

/**
 * Calculates the arithmetic mean of numbers from an iterable.
 *
 * @param values Numbers to average.
 */
export function average(values: Iterable<number>): number {
	let total = 0;
	let count = 0;
	for (const value of values) {
		total += value;
		count++;
	}

	if (count === 0) {
		throw new Error('cannot compute average of empty iterable');
	}

	return total / count;
}
