import { timeout } from '../src/async';
import { cache } from '../src/decorators';
import { it, expect, describe } from 'vitest';

function decorate<T extends object, A extends any[], R>(
	method: (this: T, ...args: A) => R,
	ttlMs: number
): (this: T, ...args: A) => R {
	return cache(ttlMs)(method, {} as ClassMethodDecoratorContext<T, (this: T, ...args: A) => R>);
}

describe('cache decorator', () => {
	it('preserves sync return type and caches by args', () => {
		const read = decorate(function (this: { calls: number }, value: number) {
			this.calls++;
			return { value, calls: this.calls };
		}, 50);
		const subject = { calls: 0, read };

		const first = subject.read(10);
		const second = subject.read(10);
		const third = subject.read(20);

		expect(first).not.toBeInstanceOf(Promise);
		expect(second).toBe(first);
		expect(third).not.toBe(first);
		expect(subject.calls).toBe(2);
	});

	it('separates cache state per instance', () => {
		const run = decorate(function (this: { calls: number }, value: string) {
			this.calls++;
			return `${value}:${this.calls}`;
		}, 100);

		const one = { calls: 0, run };
		const two = { calls: 0, run };

		expect(one.run('x')).toBe('x:1');
		expect(one.run('x')).toBe('x:1');
		expect(two.run('x')).toBe('x:1');
		expect(one.calls).toBe(1);
		expect(two.calls).toBe(1);
	});

	it('deduplicates in-flight async work for same key', async () => {
		const load = decorate(async function (this: { calls: number }, value: number) {
			this.calls++;
			await timeout(1);
			return `${value}:${this.calls}`;
		}, 50);
		const subject = { calls: 0, load };

		const first = subject.load(7);
		const second = subject.load(7);

		expect(second).toBe(first);
		await expect(first).resolves.toBe('7:1');
		expect(subject.calls).toBe(1);
	});

	it('evicts failed async results from cache', async () => {
		let shouldFail = true;
		const load = decorate(async function (this: { calls: number }) {
			this.calls++;
			if (shouldFail) {
				shouldFail = false;
				throw new Error('boom');
			}

			return this.calls;
		}, 100);
		const subject = { calls: 0, load };

		await expect(subject.load()).rejects.toThrow('boom');
		await expect(subject.load()).resolves.toBe(2);
		expect(subject.calls).toBe(2);
	});

	it('expires cache entries after ttl', async () => {
		const get = decorate(function (this: { calls: number }) {
			this.calls++;
			return { calls: this.calls };
		}, 10);
		const subject = { calls: 0, get };

		const first = subject.get();
		const second = subject.get();
		expect(second).toBe(first);

		await timeout(20);

		const third = subject.get();
		expect(third).not.toBe(first);
		expect(subject.calls).toBe(2);
	});

	it('handles bigint and function identity in cache keys', () => {
		const firstFn = function sameName() {
			return 1;
		};
		const secondFn = function sameName() {
			return 2;
		};
		const run = decorate(function (this: { calls: number }, fn: () => number, id: bigint) {
			this.calls++;
			return `${id}:${fn()}`;
		}, 100);
		const subject = { calls: 0, run };

		expect(subject.run(firstFn, 1n)).toBe('1:1');
		expect(subject.run(firstFn, 1n)).toBe('1:1');
		expect(subject.run(secondFn, 1n)).toBe('1:2');
		expect(subject.calls).toBe(2);
	});
});
