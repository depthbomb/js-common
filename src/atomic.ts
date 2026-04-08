import type { Fn, Maybe, Awaitable, AwaitableFn } from './typing';

const SINGLE_FLIGHT_KEY = Symbol('singleFlight');

/**
 * A deferred promise with externally controlled settlement.
 */
export interface IDeferred<T> {
	readonly promise: Promise<T>;
	readonly settled: boolean;
	resolve(value: T | PromiseLike<T>): void;
	reject(reason?: unknown): void;
}

/**
 * A held lease that releases its resource when disposed.
 */
export interface IAsyncLease extends AsyncDisposable {
	readonly released: boolean;
	release(): void;
}

/**
 * A held mutex lease that releases the mutex when disposed.
 */
export interface IMutexLease extends IAsyncLease {}

/**
 * A held semaphore lease that releases one permit when disposed.
 */
export interface ISemaphoreLease extends IAsyncLease {}

/**
 * A held read/write lock lease.
 */
export interface IReadWriteLease extends IAsyncLease {
	readonly kind: 'read' | 'write';
}

/**
 * Callable single-flight function with cache controls.
 */
export interface ISingleFlightFn<TArgs extends unknown[], TResult> {
	(...args: TArgs): Promise<TResult>;
	clear(): void;
	delete(...args: TArgs): boolean;
	readonly pending: number;
}

/**
 * Callable async memoized function with cache controls.
 */
export interface IMemoizedAsyncFn<TArgs extends unknown[], TResult> {
	(...args: TArgs): Promise<TResult>;
	clear(): void;
	delete(...args: TArgs): boolean;
	readonly size: number;
}

/**
 * Creates a deferred promise with externally controlled settlement.
 */
export function deferred<T>(): IDeferred<T> {
	let settled = false;
	let resolvePromise!: (value: T | PromiseLike<T>) => void;
	let rejectPromise!: (reason?: unknown) => void;

	const promise = new Promise<T>((resolve, reject) => {
		resolvePromise = resolve;
		rejectPromise = reject;
	});

	return {
		promise,
		get settled() {
			return settled;
		},
		resolve(value) {
			if (settled) {
				return;
			}

			settled = true;
			resolvePromise(value);
		},
		reject(reason) {
			if (settled) {
				return;
			}

			settled = true;
			rejectPromise(reason);
		}
	};
}

/**
 * A one-way waitable gate that stays open once opened.
 */
export class Latch {
	#opened: boolean;
	#deferred = deferred<void>();

	public constructor(opened = false) {
		this.#opened = opened;

		if (opened) {
			this.#deferred.resolve();
		}
	}

	/**
	 * Whether the latch is currently open.
	 */
	public get isOpen() {
		return this.#opened;
	}

	/**
	 * Open the latch and release all waiters.
	 */
	public open() {
		if (this.#opened) {
			return;
		}

		this.#opened = true;
		this.#deferred.resolve();
	}

	/**
	 * Wait until the latch is opened.
	 */
	public async wait(): Promise<void> {
		if (this.#opened) {
			return;
		}

		await this.#deferred.promise;
	}
}

/**
 * A waitable manual-reset event.
 */
export class AsyncEvent {
	#set: boolean;
	#deferred = deferred<void>();

	public constructor(initialState = false) {
		this.#set = initialState;

		if (initialState) {
			this.#deferred.resolve();
		}
	}

	/**
	 * Whether the event is currently set.
	 */
	public get isSet() {
		return this.#set;
	}

	/**
	 * Set the event and release all current waiters.
	 */
	public set() {
		if (this.#set) {
			return;
		}

		this.#set = true;
		this.#deferred.resolve();
	}

	/**
	 * Reset the event so future waiters block until the next set.
	 */
	public reset() {
		if (!this.#set) {
			return;
		}

		this.#set = false;
		this.#deferred = deferred<void>();
	}

	/**
	 * Wait until the event is set.
	 */
	public async wait(): Promise<void> {
		if (this.#set) {
			return;
		}

		await this.#deferred.promise;
	}
}

/**
 * Alias for {@link AsyncEvent}.
 */
export class Event extends AsyncEvent {}

/**
 * A simple cyclic barrier that releases all waiters when the required number arrives.
 */
export class Barrier {
	readonly #parties: number;
	#waiting = 0;
	#cycle = deferred<void>();

	public constructor(parties: number) {
		if (!Number.isInteger(parties) || parties < 1) {
			throw new Error('parties must be an integer >= 1');
		}

		this.#parties = parties;
	}

	/**
	 * Number of participants required to release the barrier.
	 */
	public get parties() {
		return this.#parties;
	}

	/**
	 * Number of participants currently waiting in the active cycle.
	 */
	public get waiting() {
		return this.#waiting;
	}

	/**
	 * Wait at the barrier until enough participants have arrived.
	 */
	public async wait(): Promise<void> {
		const cycle = this.#cycle;
		const arrival = ++this.#waiting;

		if (arrival >= this.#parties) {
			this.#waiting = 0;
			this.#cycle = deferred<void>();
			cycle.resolve();
			return;
		}

		await cycle.promise;
	}
}

/**
 * A simple FIFO mutex for coordinating async access across environments.
 */
export class Mutex {
	#locked = false;
	#waiters: Array<() => void> = [];

	/**
	 * Whether the mutex is currently held.
	 */
	public get locked() {
		return this.#locked;
	}

	/**
	 * Number of queued acquirers waiting for the mutex.
	 */
	public get pending() {
		return this.#waiters.length;
	}

	/**
	 * Acquire the mutex and receive a lease that must be released or async-disposed.
	 */
	public async acquire(): Promise<IMutexLease> {
		if (!this.#locked) {
			this.#locked = true;
			return this.#createLease();
		}

		await new Promise<void>((resolve) => {
			this.#waiters.push(resolve);
		});

		return this.#createLease();
	}

	/**
	 * Alias for {@link acquire}.
	 */
	public lock(): Promise<IMutexLease> {
		return this.acquire();
	}

	/**
	 * Run a task while holding the mutex, always releasing the lock afterwards.
	 *
	 * @param fn Task to run while holding the mutex.
	 */
	public async runExclusive<T>(fn: () => Awaitable<T>): Promise<T> {
		const lease = await this.acquire();

		try {
			return await fn();
		} finally {
			await lease[Symbol.asyncDispose]();
		}
	}

	#createLease(): IMutexLease {
		return createLease(() => this.#release());
	}

	#release() {
		const next = this.#waiters.shift();

		if (next) {
			next();
			return;
		}

		this.#locked = false;
	}
}

/**
 * A counting semaphore for limiting concurrent access.
 */
export class Semaphore {
	readonly #capacity: number;
	#available: number;
	#waiters: Array<() => void> = [];

	public constructor(capacity: number) {
		if (!Number.isInteger(capacity) || capacity < 1) {
			throw new Error('capacity must be an integer >= 1');
		}

		this.#capacity = capacity;
		this.#available = capacity;
	}

	/**
	 * Maximum number of concurrent permits.
	 */
	public get capacity() {
		return this.#capacity;
	}

	/**
	 * Number of currently available permits.
	 */
	public get available() {
		return this.#available;
	}

	/**
	 * Number of queued acquirers waiting for a permit.
	 */
	public get pending() {
		return this.#waiters.length;
	}

	/**
	 * Acquire one permit and receive a lease that releases it when disposed.
	 */
	public async acquire(): Promise<ISemaphoreLease> {
		if (this.#available > 0) {
			this.#available--;
			return this.#createLease();
		}

		await new Promise<void>((resolve) => {
			this.#waiters.push(resolve);
		});

		return this.#createLease();
	}

	/**
	 * Run a task while holding one semaphore permit.
	 */
	public async runExclusive<T>(fn: () => Awaitable<T>): Promise<T> {
		const lease = await this.acquire();

		try {
			return await fn();
		} finally {
			await lease[Symbol.asyncDispose]();
		}
	}

	#createLease(): ISemaphoreLease {
		return createLease(() => this.#release());
	}

	#release() {
		const next = this.#waiters.shift();

		if (next) {
			next();
			return;
		}

		this.#available++;
	}
}

/**
 * A fair read/write lock that grants either multiple readers or a single writer.
 */
export class ReadWriteLock {
	#activeReaders = 0;
	#activeWriter = false;
	#queue: Array<{ kind: 'read' | 'write'; resolve: (lease: IReadWriteLease) => void }> = [];

	/**
	 * Number of active readers currently holding the lock.
	 */
	public get readers() {
		return this.#activeReaders;
	}

	/**
	 * Whether a writer currently holds the lock.
	 */
	public get writer() {
		return this.#activeWriter;
	}

	/**
	 * Number of queued readers and writers waiting for the lock.
	 */
	public get pending() {
		return this.#queue.length;
	}

	/**
	 * Acquire a read lease.
	 */
	public async acquireRead(): Promise<IReadWriteLease> {
		if (!this.#activeWriter && this.#queue.length === 0) {
			this.#activeReaders++;
			return this.#createLease('read');
		}

		return await new Promise<IReadWriteLease>((resolve) => {
			this.#queue.push({ kind: 'read', resolve });
		});
	}

	/**
	 * Acquire a write lease.
	 */
	public async acquireWrite(): Promise<IReadWriteLease> {
		if (!this.#activeWriter && this.#activeReaders === 0 && this.#queue.length === 0) {
			this.#activeWriter = true;
			return this.#createLease('write');
		}

		return await new Promise<IReadWriteLease>((resolve) => {
			this.#queue.push({ kind: 'write', resolve });
		});
	}

	/**
	 * Run a task while holding a read lease.
	 */
	public async runRead<T>(fn: () => Awaitable<T>): Promise<T> {
		const lease = await this.acquireRead();

		try {
			return await fn();
		} finally {
			await lease[Symbol.asyncDispose]();
		}
	}

	/**
	 * Run a task while holding a write lease.
	 */
	public async runWrite<T>(fn: () => Awaitable<T>): Promise<T> {
		const lease = await this.acquireWrite();

		try {
			return await fn();
		} finally {
			await lease[Symbol.asyncDispose]();
		}
	}

	#createLease(kind: 'read' | 'write'): IReadWriteLease {
		const lease = createLease(() => this.#release(kind)) as IReadWriteLease;
		Object.defineProperty(lease, 'kind', {
			value: kind,
			enumerable: true,
			configurable: false
		});
		return lease;
	}

	#release(kind: 'read' | 'write') {
		if (kind === 'read') {
			this.#activeReaders--;
		} else {
			this.#activeWriter = false;
		}

		this.#drain();
	}

	#drain() {
		if (this.#activeWriter || this.#activeReaders > 0 || this.#queue.length === 0) {
			return;
		}

		if (this.#queue[0].kind === 'write') {
			const waiter = this.#queue.shift()!;
			this.#activeWriter = true;
			waiter.resolve(this.#createLease('write'));
			return;
		}

		while (this.#queue[0]?.kind === 'read') {
			const waiter = this.#queue.shift()!;
			this.#activeReaders++;
			waiter.resolve(this.#createLease('read'));
		}
	}
}

/**
 * Wrap an async function so only one in-flight call per key runs at a time.
 *
 * @param fn Async function to deduplicate.
 * @param keyFn Optional key selector. Defaults to a single global key.
 */
export function singleFlight<TArgs extends unknown[], TResult>(
	fn: (...args: TArgs) => Promise<TResult>,
	keyFn?: (...args: TArgs) => unknown
): ISingleFlightFn<TArgs, TResult> {
	const inFlight = new Map<unknown, Promise<TResult>>();

	const wrapped = ((...args: TArgs) => {
		const key = keyFn ? keyFn(...args) : SINGLE_FLIGHT_KEY;
		const existing = inFlight.get(key);
		if (existing) {
			return existing;
		}

		const promise = Promise.resolve(fn(...args)).finally(() => {
			inFlight.delete(key);
		});

		inFlight.set(key, promise);
		return promise;
	}) as ISingleFlightFn<TArgs, TResult>;

	wrapped.clear = () => inFlight.clear();
	wrapped.delete = (...args: TArgs) => {
		const key = keyFn ? keyFn(...args) : SINGLE_FLIGHT_KEY;
		return inFlight.delete(key);
	};
	Object.defineProperty(wrapped, 'pending', {
		get: () => inFlight.size
	});

	return wrapped;
}

/**
 * Wrap an async function and cache successful results by key.
 *
 * Rejected calls are evicted so later calls can retry.
 *
 * @param fn Async function to memoize.
 * @param keyFn Optional key selector. Defaults to the first argument.
 */
export function memoizeAsync<TArgs extends unknown[], TResult>(
	fn: (...args: TArgs) => Promise<TResult>,
	keyFn?: (...args: TArgs) => unknown
): IMemoizedAsyncFn<TArgs, TResult> {
	const cache = new Map<unknown, Promise<TResult>>();

	const wrapped = ((...args: TArgs) => {
		const key = keyFn ? keyFn(...args) : args[0];
		const existing = cache.get(key);
		if (existing) {
			return existing;
		}

		const promise = Promise.resolve(fn(...args)).catch((error) => {
			cache.delete(key);
			throw error;
		});

		cache.set(key, promise);
		return promise;
	}) as IMemoizedAsyncFn<TArgs, TResult>;

	wrapped.clear = () => cache.clear();
	wrapped.delete = (...args: TArgs) => {
		const key = keyFn ? keyFn(...args) : args[0];
		return cache.delete(key);
	};
	Object.defineProperty(wrapped, 'size', {
		get: () => cache.size
	});

	return wrapped;
}

/**
 * Creates an async function that runs only one successful invocation at a time.
 *
 * Rejected invocations are evicted so later calls can retry.
 *
 * @param fn Async function to run once.
 */
export function onceAsync<T extends AwaitableFn<any, any>>(fn: T): T {
	let promise: Maybe<Promise<Awaited<ReturnType<T>>>>;

	return ((...args: Parameters<T>) => {
		if (!promise) {
			promise = Promise.resolve(fn(...args)).catch((error) => {
				promise = undefined;
				throw error;
			});
		}

		return promise;
	}) as T;
}

/**
 * A small boxed value with compare-and-set and swap helpers.
 */
export class AtomicValue<T> {
	#value: T;

	public constructor(value: T) {
		this.#value = value;
	}

	/**
	 * Current stored value.
	 */
	public get value() {
		return this.#value;
	}

	public set value(value: T) {
		this.#value = value;
	}

	/**
	 * Replace the current value and return the previous value.
	 */
	public swap(next: T): T {
		return swap(this, next);
	}

	/**
	 * Conditionally replace the current value when it matches the expected value.
	 */
	public compareAndSet(expected: T, next: T): boolean {
		return compareAndSet(this, expected, next);
	}

	/**
	 * Update the current value using the provided updater function.
	 */
	public update(updater: (current: T) => T): T {
		this.#value = updater(this.#value);
		return this.#value;
	}
}

/**
 * Replace a boxed value only when it matches the expected value.
 */
export function compareAndSet<T>(target: { value: T }, expected: T, next: T): boolean {
	if (!Object.is(target.value, expected)) {
		return false;
	}

	target.value = next;
	return true;
}

/**
 * Replace a boxed value and return the previous value.
 */
export function swap<T>(target: { value: T }, next: T): T {
	const previous = target.value;
	target.value = next;
	return previous;
}

/**
 * Creates a function that calls the given function only once.
 *
 * @param fn Function to be called only once.
 * @returns A new function that calls the original function only once.
 */
export function once<T extends Fn<any, any>>(fn: T): T {
	let called = false;
	let result: ReturnType<T>;

	return ((...args: Parameters<T>) => {
		if (!called) {
			result = fn(...args);
			called = true;
		}

		return result;
	}) as T;
}

/**
 * Creates a getter that computes its value once and then returns the cached result.
 *
 * @param factory Function used to create the value.
 * @returns A zero-argument getter for the lazily-created value.
 */
export function lazy<T>(factory: () => T): () => T {
	let cached: Maybe<T>;
	let initialized = false;

	return () => {
		if (!initialized) {
			cached = factory();
			initialized = true;
		}

		return cached!;
	};
}

/**
 * Creates a getter that runs an async factory once and reuses the same promise.
 *
 * @param factory Async function used to create the value.
 * @returns A zero-argument getter returning the cached promise.
 */
export function lazyAsync<T>(factory: () => Promise<T>): () => Promise<T> {
	let promise: Maybe<Promise<T>>;

	return () => {
		if (!promise) {
			promise = factory().catch((error) => {
				promise = undefined;
				throw error;
			});
		}

		return promise;
	};
}

/**
 * Creates a resettable lazy value accessor.
 *
 * @param factory Factory used to create the value.
 */
export function resettableLazy<T>(factory: () => T) {
	let cached: Maybe<T>;
	let initialized = false;

	function get(): T {
		if (!initialized) {
			cached = factory();
			initialized = true;
		}
		return cached!;
	}

	function reset() {
		initialized = false;
		cached = undefined;
	}

	return { get, reset };
}

/**
 * Creates a resettable async lazy accessor.
 *
 * @param factory Async factory used to create the value.
 */
export function resettableLazyAsync<T>(factory: () => Promise<T>) {
	let promise: Maybe<Promise<T>>;

	function get() {
		if (!promise) {
			promise = factory().catch((error) => {
				promise = undefined;
				throw error;
			});
		}

		return promise;
	}

	function reset() {
		promise = undefined;
	}

	return { get, reset };
}

function createLease(onRelease: () => void): IAsyncLease {
	let released = false;

	const release = () => {
		if (released) {
			return;
		}

		released = true;
		onRelease();
	};

	return {
		get released() {
			return released;
		},
		release,
		async [Symbol.asyncDispose]() {
			release();
		}
	};
}
