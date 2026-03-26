export function clamp(value: number, min: number, max: number): number {
	if (min > max) {
		throw new Error('min must be <= max');
	}

	return Math.min(Math.max(value, min), max);
}

export function inRange(value: number, min: number, max: number, inclusive = true): boolean {
	if (min > max) {
		throw new Error('min must be <= max');
	}

	if (inclusive) {
		return value >= min && value <= max;
	}

	return value > min && value < max;
}

export function roundTo(value: number, decimals = 0): number {
	if (!Number.isInteger(decimals) || decimals < 0) {
		throw new Error('decimals must be an integer >= 0');
	}

	const factor = 10 ** decimals;
	return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function sum(values: Iterable<number>): number {
	let total = 0;
	for (const value of values) {
		total += value;
	}

	return total;
}

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
