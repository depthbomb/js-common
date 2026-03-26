export interface IWeightedItem<T> {
	value: T;
	weight: number;
}

function validateBounds(min: number, max: number) {
	if (!Number.isFinite(min) || !Number.isFinite(max)) {
		throw new Error('min and max must be finite numbers');
	}

	if (min > max) {
		throw new Error('min must be <= max');
	}
}

export function randomFloat(min = 0, max = 1): number {
	validateBounds(min, max);

	return Math.random() * (max - min) + min;
}

export function randomInt(min: number, max: number): number {
	if (!Number.isInteger(min) || !Number.isInteger(max)) {
		throw new Error('min and max must be integers');
	}

	validateBounds(min, max);

	return Math.floor(randomFloat(min, max + 1));
}

export function pickRandom<T>(values: readonly T[]): T {
	if (values.length === 0) {
		throw new Error('cannot pick from empty array');
	}

	const index = randomInt(0, values.length - 1);

	return values[index] as T;
}

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
