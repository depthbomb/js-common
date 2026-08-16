import '../dist/extensions.mjs';
import { it, expect, describe } from 'vitest';

describe('String.empty', () => {
	it('should return an empty string', () => {
		expect(String.empty()).toBe('');
	});
});
