import type { Awaitable } from './typing';

/** Options for constructing a {@link RateLimiter}. */
export interface IRateLimiterOptions {
	limit: number;
	intervalMs: number;
	burst?: number;
	queueLimit?: number;
}

/** Options for an abortable rate-limited operation. */
export interface IRateLimitOperationOptions {
	signal?: AbortSignal;
}

interface IRateLimitWaiter {
	resolve(): void;
	reject(error: unknown): void;
	cleanup(): void;
}

/** Error raised when a rate limiter's waiting queue is full. */
export class RateLimitQueueFullError extends Error {
	public constructor() {
		super('Rate limiter queue is full');
		this.name = 'RateLimitQueueFullError';
	}
}

/** Error used to reject queued acquisitions when a limiter is cleared. */
export class RateLimiterClearedError extends Error {
	public constructor() {
		super('Rate limiter was cleared');
		this.name = 'RateLimiterClearedError';
	}
}

/** A fair token-bucket rate limiter with bounded queuing and cancellation. */
export class RateLimiter implements Disposable {
	readonly #limit: number;
	readonly #intervalMs: number;
	readonly #burst: number;
	readonly #queueLimit: number;
	readonly #waiters: IRateLimitWaiter[] = [];
	#waiterHead = 0;
	#tokens: number;
	#updatedAt = Date.now();
	#timer?: ReturnType<typeof setTimeout>;
	#disposed = false;

	public constructor(options: IRateLimiterOptions) {
		this.#validatePositive(options.limit, 'limit');
		this.#validatePositive(options.intervalMs, 'intervalMs');

		const burst = options.burst ?? options.limit;
		const queueLimit = options.queueLimit ?? Number.POSITIVE_INFINITY;

		this.#validatePositive(burst, 'burst');

		if ((!Number.isInteger(queueLimit) && queueLimit !== Number.POSITIVE_INFINITY) || queueLimit < 0) {
			throw new Error('queueLimit must be an integer >= 0 or Infinity');
		}

		this.#limit = options.limit;
		this.#intervalMs = options.intervalMs;
		this.#burst = burst;
		this.#queueLimit = queueLimit;
		this.#tokens = burst;
	}

	public get limit() { return this.#limit; }
	public get intervalMs() { return this.#intervalMs; }
	public get burst() { return this.#burst; }
	public get pending() { return this.#waiters.length - this.#waiterHead; }
	public get disposed() { return this.#disposed; }

	public get available() {
		this.#refill();

		return Math.floor(this.#tokens);
	}

	/** Acquire permission for one operation. */
	public async acquire(options: IRateLimitOperationOptions = {}): Promise<void> {
		this.#throwIfUnavailable(options.signal);
		this.#refill();

		if (this.pending === 0 && this.#tokens >= 1) {
			this.#tokens--;

			return;
		}

		if (this.pending >= this.#queueLimit) {
			throw new RateLimitQueueFullError();
		}

		await new Promise<void>((resolve, reject) => {
			const waiter = this.#createWaiter(resolve, reject, options.signal);
			this.#waiters.push(waiter);
			this.#schedule();
		});
	}

	/** Acquire permission and then execute an operation. */
	public async schedule<T>(operation: () => Awaitable<T>, options: IRateLimitOperationOptions = {}): Promise<T> {
		await this.acquire(options);

		return await operation();
	}

	/** Refill the bucket immediately while retaining queued work. */
	public reset(): void {
		if (this.#disposed) {
			throw new RateLimiterClearedError();
		}

		this.#tokens = this.#burst;
		this.#updatedAt = Date.now();
		this.#drain();
	}

	/** Reject all queued acquisitions. New acquisitions remain available. */
	public clear(error: unknown = new RateLimiterClearedError()): void {
		this.#clearTimer();

		let waiter: IRateLimitWaiter | undefined;

		while ((waiter = this.#dequeueWaiter())) {
			waiter.cleanup();
			waiter.reject(error);
		}
	}

	/** Permanently clear and disable the limiter. */
	public [Symbol.dispose](): void {
		if (this.#disposed) {
			return;
		}

		this.#disposed = true;
		this.clear();
	}

	#createWaiter(resolve: () => void, reject: (error: unknown) => void, signal?: AbortSignal): IRateLimitWaiter {
		const waiter: IRateLimitWaiter = {
			resolve,
			reject,
			cleanup: () => signal?.removeEventListener('abort', onAbort)
		};
		const onAbort = () => {
			const index = this.#waiters.indexOf(waiter, this.#waiterHead);

			if (index >= 0) {
				this.#waiters.splice(index, 1);
				this.#schedule();
			}

			reject(this.#abortReason(signal));
		};

		signal?.addEventListener('abort', onAbort, { once: true });

		return waiter;
	}

	#refill(): void {
		const now = Date.now();
		const elapsed = Math.max(0, now - this.#updatedAt);

		if (elapsed === 0) {
			return;
		}

		this.#tokens = Math.min(this.#burst, this.#tokens + elapsed * this.#limit / this.#intervalMs);
		this.#updatedAt = now;
	}

	#drain(): void {
		this.#clearTimer();
		this.#refill();

		while (this.#tokens >= 1 && this.pending > 0) {
			const waiter = this.#dequeueWaiter()!;
			this.#tokens--;
			waiter.cleanup();
			waiter.resolve();
		}

		this.#schedule();
	}

	#schedule(): void {
		if (this.pending === 0 || this.#disposed) {
			this.#clearTimer();

			return;
		}

		this.#refill();

		if (this.#timer !== undefined) {
			return;
		}

		if (this.#tokens >= 1) {
			this.#timer = setTimeout(() => this.#drain(), 0);

			return;
		}

		const delay = Math.ceil((1 - this.#tokens) * this.#intervalMs / this.#limit);
		this.#timer = setTimeout(() => this.#drain(), delay);
	}

	#dequeueWaiter(): IRateLimitWaiter | undefined {
		if (this.#waiterHead >= this.#waiters.length) {
			return undefined;
		}

		const waiter = this.#waiters[this.#waiterHead++];

		if (this.#waiterHead === this.#waiters.length) {
			this.#waiters.length = 0;
			this.#waiterHead = 0;
		} else if (this.#waiterHead >= 64 && this.#waiterHead * 2 >= this.#waiters.length) {
			this.#waiters.splice(0, this.#waiterHead);
			this.#waiterHead = 0;
		}

		return waiter;
	}

	#clearTimer(): void {
		if (this.#timer !== undefined) {
			clearTimeout(this.#timer);
			this.#timer = undefined;
		}
	}

	#throwIfUnavailable(signal?: AbortSignal): void {
		if (this.#disposed) {
			throw new RateLimiterClearedError();
		}

		if (signal?.aborted) {
			throw this.#abortReason(signal);
		}
	}

	#abortReason(signal?: AbortSignal): unknown {
		return signal?.reason ?? new DOMException('Aborted', 'AbortError');
	}

	#validatePositive(value: number, name: string): void {
		if (!Number.isFinite(value) || value <= 0) {
			throw new Error(`${name} must be a finite number > 0`);
		}
	}
}
