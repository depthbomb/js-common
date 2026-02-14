import { it, expect, describe } from 'vitest';
import { lazy, lazyAsync, resettableLazy } from '../src/lazy';

describe('lazy', () => {
	it('initializes value only once', () => {
		let calls = 0;
		const getValue = lazy(() => {
			calls++;
			return { id: calls };
		});

		const first = getValue();
		const second = getValue();

		expect(second).toBe(first);
		expect(calls).toBe(1);
	});
});

describe('lazyAsync', () => {
	it('initializes promise only once', async () => {
		let calls = 0;
		const getValue = lazyAsync(async () => {
			calls++;
			return { id: calls };
		});

		const first = getValue();
		const second = getValue();

		expect(second).toBe(first);
		await expect(first).resolves.toEqual({ id: 1 });
		expect(calls).toBe(1);
	});
});

describe('resettableLazy', () => {
	it('resets cached value when requested', () => {
		let calls = 0;
		const holder = resettableLazy(() => {
			calls++;
			return { id: calls };
		});

		const first = holder.get();
		const second = holder.get();
		holder.reset();
		const third = holder.get();

		expect(second).toBe(first);
		expect(third).not.toBe(first);
		expect(calls).toBe(2);
	});
});
