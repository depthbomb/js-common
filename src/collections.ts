import type { Maybe } from './typing';

export interface IBoundedQueueOptions {
	maxSize: number;
	overflow?: BoundedQueueOverflow;
}

export const enum BoundedQueueOverflow {
	DropOldest,
	DropNewest,
	Throw
}

export class Queue<T> {
	#items = [] as T[];
	#head = 0;

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
	public [Symbol.iterator](): Iterator<T> {
		return this.toArray()[Symbol.iterator]();
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

export class BoundedQueue<T> {
	readonly #maxSize: number;
	readonly #overflow: BoundedQueueOverflow;
	readonly #queue: Queue<T>;

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

	public get size() {
		return this.#queue.size;
	}

	public get isEmpty() {
		return this.#queue.isEmpty;
	}

	public get isFull() {
		return this.size >= this.#maxSize;
	}

	public get maxSize() {
		return this.#maxSize;
	}

	public get overflow() {
		return this.#overflow;
	}

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

	public dequeue(): Maybe<T> {
		return this.#queue.dequeue();
	}

	public peek(): Maybe<T> {
		return this.#queue.peek();
	}

	public clear(): void {
		this.#queue.clear();
	}

	public [Symbol.iterator](): Iterator<T> {
		return this.#queue[Symbol.iterator]();
	}

	public toArray(): T[] {
		return this.#queue.toArray();
	}
}
