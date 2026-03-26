function isValidDate(date: Date): boolean {
	return !Number.isNaN(date.getTime());
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

export function isNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

export function isDateLike(value: unknown): value is Date | number | string {
	if (value instanceof Date) {
		return isValidDate(value);
	}

	if (typeof value === 'number') {
		return Number.isFinite(value) && isValidDate(new Date(value));
	}

	if (typeof value === 'string') {
		return value.length > 0 && isValidDate(new Date(value));
	}

	return false;
}
