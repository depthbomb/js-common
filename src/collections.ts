import type { Maybe } from './typing';

/**
 * Options for constructing a {@link BoundedQueue}.
 */
export interface IBoundedQueueOptions {
	maxSize: number;
	overflow?: BoundedQueueOverflow;
}

/**
 * Overflow behavior for {@link BoundedQueue}.
 */
export const enum BoundedQueueOverflow {
	DropOldest,
	DropNewest,
	Throw
}

/**
 * FIFO queue implementation with O(1) amortized dequeue.
 */
export class Queue<T> {
	#items = [] as T[];
	#head = 0;

	/**
	 * Creates a queue optionally seeded with initial values.
	 *
	 * @param initial Initial values in dequeue order.
	 */
	public constructor(initial?: Iterable<T>) {
		if (initial) {
			this.#items = [...initial];
		}
	}

	/**
	 * Get the number of items in the queue.
	 */
	public get size(): number {
		return this.#items.length - this.#head;
	}

	/**
	 * Check if the queue is empty.
	 */
	public get isEmpty(): boolean {
		return this.size === 0;
	}

	/**
	 * Add an item to the end of the queue.
	 *
	 * @param item Item to add to the end of the queue
	 */
	public enqueue(item: T): void {
		this.#items.push(item);
	}

	/**
	 * Remove and return the item at the front of the queue.
	 *
	 * @returns The item at the front of the queue, or undefined if the queue is empty
	 */
	public dequeue(): Maybe<T> {
		if (this.#head >= this.#items.length) {
			return undefined;
		}

		const item = this.#items[this.#head++];
		if (this.#head >= 64 && this.#head * 2 >= this.#items.length) {
			this.#items = this.#items.slice(this.#head);
			this.#head = 0;
		}

		return item;
	}

	/**
	 * Return the item at the front of the queue without removing it.
	 *
	 * @returns The item at the front of the queue without removing it, or undefined if the queue is empty
	 */
	public peek(): Maybe<T> {
		return this.#items[this.#head];
	}

	/**
	 * Clear all items from the queue.
	 */
	public clear(): void {
		this.#items = [];
		this.#head = 0;
	}

	/**
	 * Get an iterator for the items in the queue.
	 *
	 * @returns An iterator for the items in the queue
	 */
	public *[Symbol.iterator](): Iterator<T> {
		for (let i = this.#head; i < this.#items.length; i++) {
			yield this.#items[i]!;
		}
	}

	/**
	 * Convert the queue to an array.
	 *
	 * @returns An array containing all items in the queue in order
	 */
	public toArray(): T[] {
		return this.#items.slice(this.#head);
	}
}

/**
 * Queue with a fixed maximum size and configurable overflow policy.
 */
export class BoundedQueue<T> {
	readonly #maxSize: number;
	readonly #overflow: BoundedQueueOverflow;
	readonly #queue: Queue<T>;

	/**
	 * Creates a bounded queue.
	 *
	 * @param options Queue size and overflow behavior.
	 * @param initial Optional initial values.
	 */
	public constructor(options: IBoundedQueueOptions, initial?: Iterable<T>) {
		if (!Number.isInteger(options.maxSize) || options.maxSize < 1) {
			throw new Error('maxSize must be an integer >= 1');
		}

		this.#maxSize  = options.maxSize;
		this.#overflow = options.overflow ?? BoundedQueueOverflow.DropOldest;
		this.#queue    = new Queue<T>();

		if (initial) {
			for (const value of initial) {
				this.enqueue(value);
			}
		}
	}

	/**
	 * Number of values currently stored in the queue.
	 */
	public get size() {
		return this.#queue.size;
	}

	/**
	 * Whether the queue currently has zero items.
	 */
	public get isEmpty() {
		return this.#queue.isEmpty;
	}

	/**
	 * Whether the queue has reached its maximum size.
	 */
	public get isFull() {
		return this.size >= this.#maxSize;
	}

	/**
	 * Maximum number of elements this queue can hold.
	 */
	public get maxSize() {
		return this.#maxSize;
	}

	/**
	 * Overflow strategy applied when enqueuing into a full queue.
	 */
	public get overflow() {
		return this.#overflow;
	}

	/**
	 * Adds an item to the queue, applying overflow behavior when full.
	 *
	 * @param item Item to enqueue.
	 */
	public enqueue(item: T): void {
		if (!this.isFull) {
			this.#queue.enqueue(item);
			return;
		}

		if (this.#overflow === BoundedQueueOverflow.DropNewest) {
			return;
		}

		if (this.#overflow === BoundedQueueOverflow.Throw) {
			throw new Error('BoundedQueue overflow');
		}

		this.#queue.dequeue();
		this.#queue.enqueue(item);
	}

	/**
	 * Removes and returns the item at the front of the queue.
	 */
	public dequeue(): Maybe<T> {
		return this.#queue.dequeue();
	}

	/**
	 * Returns the item at the front without removing it.
	 */
	public peek(): Maybe<T> {
		return this.#queue.peek();
	}

	/**
	 * Removes all items from the queue.
	 */
	public clear(): void {
		this.#queue.clear();
	}

	/**
	 * Iterates queue items from oldest to newest.
	 */
	public [Symbol.iterator](): Iterator<T> {
		return this.#queue[Symbol.iterator]();
	}

	/**
	 * Returns queue contents as an array in dequeue order.
	 */
	public toArray(): T[] {
		return this.#queue.toArray();
	}
}
