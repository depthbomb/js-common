/**
 * A value paired with a non-negative selection weight.
 */
export interface IWeightedItem<T> {
	value: T;
	weight: number;
}

/**
 * Returns a random floating-point number in the half-open range `[min, max)`.
 *
 * @param min Lower bound.
 * @param max Upper bound.
 */
export function randomFloat(min = 0, max = 1): number {
	validateBounds(min, max);

	return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer in the inclusive range `[min, max]`.
 *
 * @param min Lower bound.
 * @param max Upper bound.
 */
export function randomInt(min: number, max: number): number {
	if (!Number.isInteger(min) || !Number.isInteger(max)) {
		throw new Error('min and max must be integers');
	}

	validateBounds(min, max);

	return Math.floor(randomFloat(min, max + 1));
}

/**
 * Picks a random element from a non-empty array.
 *
 * @param values Candidate values.
 */
export function pickRandom<T>(values: readonly T[]): T {
	if (values.length === 0) {
		throw new Error('cannot pick from empty array');
	}

	const index = randomInt(0, values.length - 1);

	return values[index] as T;
}

/**
 * Picks a value from weighted candidates.
 *
 * @param items Weighted candidate items.
 */
export function pickWeighted<T>(items: Array<IWeightedItem<T>>): T {
	if (items.length === 0) {
		throw new Error('cannot pick from empty weighted items');
	}

	let totalWeight = 0;
	for (const item of items) {
		if (!Number.isFinite(item.weight) || item.weight < 0) {
			throw new Error('weights must be finite numbers >= 0');
		}

		totalWeight += item.weight;
	}

	if (totalWeight <= 0) {
		throw new Error('total weight must be > 0');
	}

	let threshold = randomFloat(0, totalWeight);

	for (const item of items) {
		threshold -= item.weight;
		if (threshold <= 0) {
			return item.value;
		}
	}

	return items[items.length - 1]!.value;
}

/**
 * Validates inclusive random bounds.
 *
 * @param min Lower bound.
 * @param max Upper bound.
 */
function validateBounds(min: number, max: number) {
	if (!Number.isFinite(min) || !Number.isFinite(max)) {
		throw new Error('min and max must be finite numbers');
	}

	if (min > max) {
		throw new Error('min must be <= max');
	}
}
