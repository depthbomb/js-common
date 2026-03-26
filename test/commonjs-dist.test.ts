import { createRequire } from 'node:module';
import { it, expect, describe } from 'vitest';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as {
	name: string;
	exports: Record<string, { require?: string }>;
};

describe('dist commonjs builds', () => {
	it('loads every declared require export path', () => {
		for (const [subpath, entry] of Object.entries(pkg.exports)) {
			if (!entry.require) continue;

			const specifier = subpath === '.' ? pkg.name : `${pkg.name}${subpath.slice(1)}`;
			const loaded = require(specifier);

			expect(loaded).toBeTypeOf('object');
		}
	});

	it('loads root main entry via require', () => {
		const root = require('..');

		expect(root).toBeTypeOf('object');
		expect(root.timeout).toBeTypeOf('function');
		expect(root.retry).toBeTypeOf('function');
		expect(root.withAbort).toBeTypeOf('function');
		expect(root.pMap).toBeTypeOf('function');
		expect(root.resettableLazyAsync).toBeTypeOf('function');
		expect(root.Queue).toBeTypeOf('function');
		expect(root.BoundedQueue).toBeTypeOf('function');
		expect(root.URLPath).toBeTypeOf('function');
	});

	it('runs a basic behavior check on cjs utilities', async () => {
		const { timeout } = require('../dist/timing.cjs') as {
			timeout: (ms: number) => Promise<void>;
		};
		const { allSettledSuccessful } = require('../dist/promise.cjs') as {
			allSettledSuccessful: <T>(promises: Promise<T>[]) => Promise<T[]>;
		};
		const { Queue } = require('../dist/collections.cjs') as {
			Queue: new <T>(iterable?: Iterable<T>) => {
				enqueue(value: T): void;
				dequeue(): T | undefined;
				size: number;
			};
		};

		await expect(timeout(0)).resolves.toBeUndefined();
		await expect(allSettledSuccessful([Promise.resolve(1), Promise.reject(new Error('boom'))])).resolves.toEqual([1]);

		const queue = new Queue<number>();
		queue.enqueue(1);
		queue.enqueue(2);
		expect(queue.size).toBe(2);
		expect(queue.dequeue()).toBe(1);
	});
});
