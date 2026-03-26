import { it, expect, describe } from 'vitest';
import { ResettableValue } from '../dist/state.mjs';

describe('ResettableValue', () => {
	it('sets and resets to the original constructor value', () => {
		const value = new ResettableValue<number>(5);

		expect(value.value).toBe(5);

		value.set(10);
		expect(value.value).toBe(10);

		value.reset();
		expect(value.value).toBe(5);
	});

	it('uses the original initial value even after multiple updates', () => {
		const value = new ResettableValue<string>('start');

		value.set('middle');
		value.set('end');
		value.reset();

		expect(value.value).toBe('start');
	});

	it('valueOf and toString reflect the current value', () => {
		const value = new ResettableValue<number>(42);

		expect(value.valueOf()).toBe(42);
		expect(value.toString()).toBe('42');

		value.set(7);
		expect(value.valueOf()).toBe(7);
		expect(value.toString()).toBe('7');
	});
});
