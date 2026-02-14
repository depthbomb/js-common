import { Queue } from '../src/queue';
import { it, expect, describe } from 'vitest';

describe('Queue', () => {
	it('supports enqueue, dequeue, peek, size, and isEmpty', () => {
		const queue = new Queue<number>();

		expect(queue.isEmpty).toBe(true);
		expect(queue.size).toBe(0);
		expect(queue.peek()).toBeUndefined();

		queue.enqueue(1);
		queue.enqueue(2);

		expect(queue.isEmpty).toBe(false);
		expect(queue.size).toBe(2);
		expect(queue.peek()).toBe(1);
		expect(queue.dequeue()).toBe(1);
		expect(queue.dequeue()).toBe(2);
		expect(queue.dequeue()).toBeUndefined();
		expect(queue.isEmpty).toBe(true);
	});

	it('supports construction from iterable and stable iteration', () => {
		const queue = new Queue<number>([1, 2, 3, 4]);
		queue.dequeue();

		expect(queue.toArray()).toEqual([2, 3, 4]);
		expect([...queue]).toEqual([2, 3, 4]);
	});

	it('clears all data', () => {
		const queue = new Queue<number>([1, 2, 3]);
		queue.clear();

		expect(queue.size).toBe(0);
		expect(queue.isEmpty).toBe(true);
		expect(queue.peek()).toBeUndefined();
		expect(queue.toArray()).toEqual([]);
	});

	it('preserves order through compaction boundaries', () => {
		const queue = new Queue<number>(Array.from({ length: 200 }, (_, i) => i));

		for (let i = 0; i < 150; i++) {
			expect(queue.dequeue()).toBe(i);
		}

		queue.enqueue(200);
		queue.enqueue(201);

		expect(queue.size).toBe(52);
		expect(queue.peek()).toBe(150);
		expect(queue.toArray().slice(0, 5)).toEqual([150, 151, 152, 153, 154]);
		expect([...queue].slice(-3)).toEqual([199, 200, 201]);
	});
});
