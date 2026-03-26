import { it, expect, describe } from 'vitest';
import { Queue, BoundedQueue, BoundedQueueOverflow } from '../dist/collections.mjs';

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

describe('BoundedQueue', () => {
	it('drops oldest item when full by default', () => {
		const queue = new BoundedQueue<number>({ maxSize: 3 });
		queue.enqueue(1);
		queue.enqueue(2);
		queue.enqueue(3);
		queue.enqueue(4);

		expect(queue.toArray()).toEqual([2, 3, 4]);
		expect(queue.isFull).toBe(true);
		expect(queue.maxSize).toBe(3);
		expect(queue.overflow).toBe(BoundedQueueOverflow.DropOldest);
	});

	it('drops newest item when full in drop-newest mode', () => {
		const queue = new BoundedQueue<number>({ maxSize: 2, overflow: BoundedQueueOverflow.DropNewest });
		queue.enqueue(1);
		queue.enqueue(2);
		queue.enqueue(3);

		expect(queue.toArray()).toEqual([1, 2]);
		expect(queue.size).toBe(2);
	});

	it('throws when full in throw mode', () => {
		const queue = new BoundedQueue<number>({ maxSize: 2, overflow: BoundedQueueOverflow.Throw });
		queue.enqueue(1);
		queue.enqueue(2);

		expect(() => queue.enqueue(3)).toThrow('BoundedQueue overflow');
		expect(queue.toArray()).toEqual([1, 2]);
	});

	it('applies overflow strategy to constructor initial values', () => {
		const queue = new BoundedQueue<number>({ maxSize: 3, overflow: BoundedQueueOverflow.DropOldest }, [1, 2, 3, 4, 5]);
		expect(queue.toArray()).toEqual([3, 4, 5]);
	});

	it('supports dequeue, peek, clear, and iteration', () => {
		const queue = new BoundedQueue<number>({ maxSize: 3 }, [1, 2, 3]);

		expect(queue.peek()).toBe(1);
		expect(queue.dequeue()).toBe(1);
		expect([...queue]).toEqual([2, 3]);

		queue.clear();
		expect(queue.isEmpty).toBe(true);
		expect(queue.size).toBe(0);
	});
});
