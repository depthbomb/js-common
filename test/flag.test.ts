import { Flag } from '../src/flag';
import { it, expect, describe } from 'vitest';

describe('Flag', () => {
	it('defaults to false', () => {
		const flag = new Flag();

		expect(flag.value).toBe(false);
		expect(flag.isTrue).toBe(false);
		expect(flag.isFalse).toBe(true);
	});

	it('supports true initial value and explicit set', () => {
		const flag = new Flag(true);

		expect(flag.isTrue).toBe(true);
		expect(flag.isFalse).toBe(false);

		flag.set(false);
		expect(flag.value).toBe(false);
		expect(flag.isFalse).toBe(true);
	});

	it('supports setTrue, setFalse, and toggle', () => {
		const flag = new Flag(false);

		flag.setTrue();
		expect(flag.isTrue).toBe(true);

		flag.toggle();
		expect(flag.isFalse).toBe(true);

		flag.setFalse();
		expect(flag.isFalse).toBe(true);
	});

	it('resets to its original initial value', () => {
		const flag = new Flag(true);

		flag.setFalse();
		expect(flag.value).toBe(false);

		flag.reset();
		expect(flag.value).toBe(true);
		expect(flag.isTrue).toBe(true);
	});
});
