import '../dist/extensions.mjs';
import { it, expect, describe } from 'vitest';

describe('String.empty', () => {
	it('should return an empty string', () => {
		expect(String.empty()).toBe('');
	});
});

describe('String.isEmpty', () => {
	it('only identifies the empty string', () => {
		expect(String.isEmpty('')).toBe(true);
		expect(String.isEmpty(' ')).toBe(false);
		expect(String.isEmpty(null)).toBe(false);
	});
});
