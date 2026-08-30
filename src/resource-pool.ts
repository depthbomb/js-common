import type { Awaitable } from './typing';

/** Options for constructing a {@link ResourcePool}. */
export interface IResourcePoolOptions<T> {
	maxSize: number;
	minSize?: number;
	idleTimeoutMs?: number;
	acquireTimeoutMs?: number;
	create(): Awaitable<T>;
	destroy(resource: T): Awaitable<void>;
	validate?(resource: T): Awaitable<boolean>;
}

/** Options for acquiring a resource. */
export interface IResourceAcquireOptions {
	signal?: AbortSignal;
	timeoutMs?: number;
}

/** A checked-out resource that returns to its pool when disposed. */
export interface IResourceLease<T> extends AsyncDisposable {
	readonly value: T;
	readonly released: boolean;
	release(): Promise<void>;
	invalidate(): Promise<void>;
}

interface IIdleResource<T> {
	value: T;
	idleSince: number;
}

interface IResourceWaiter<T> {
	resolve(lease: IResourceLease<T>): void;
	reject(error: unknown): void;
	cleanup(): void;
}

/** Error raised when acquiring from a draining or drained pool. */
export class ResourcePoolClosedError extends Error {
	public constructor() {
		super('Resource pool is closed');
		this.name = 'ResourcePoolClosedError';
	}
}

/** Error raised when resource acquisition exceeds its timeout. */
export class ResourceAcquireTimeoutError extends Error {
	public constructor() {
		super('Resource acquisition timed out');
		this.name = 'ResourceAcquireTimeoutError';
	}
}

/** A bounded, validating pool of reusable async resources. */
export class ResourcePool<T> implements AsyncDisposable {
	readonly #maxSize: number;
	readonly #minSize: number;
	readonly #idleTimeoutMs: number;
	readonly #acquireTimeoutMs: number;
	readonly #create: () => Awaitable<T>;
	readonly #destroy: (resource: T) => Awaitable<void>;
	readonly #validate?: (resource: T) => Awaitable<boolean>;
	readonly #idle: Array<IIdleResource<T>> = [];
	readonly #waiters: Array<IResourceWaiter<T>> = [];
	#active = 0;
	#total = 0;
	#creating = 0;
	#destroying = 0;
	#closed = false;
	#dispatching = false;
	#dispatchRequested = false;
	#idleTimer?: ReturnType<typeof setTimeout>;
	#drainPromise?: Promise<void>;
	#resolveDrain?: () => void;

	public constructor(options: IResourcePoolOptions<T>) {
		this.#validateSize(options.maxSize, 'maxSize', 1);
		this.#validateSize(options.minSize ?? 0, 'minSize', 0);

		if ((options.minSize ?? 0) > options.maxSize) {
			throw new Error('minSize must be <= maxSize');
		}

		this.#validateDuration(options.idleTimeoutMs ?? Number.POSITIVE_INFINITY, 'idleTimeoutMs');
		this.#validateDuration(options.acquireTimeoutMs ?? Number.POSITIVE_INFINITY, 'acquireTimeoutMs');

		this.#maxSize = options.maxSize;
		this.#minSize = options.minSize ?? 0;
		this.#idleTimeoutMs = options.idleTimeoutMs ?? Number.POSITIVE_INFINITY;
		this.#acquireTimeoutMs = options.acquireTimeoutMs ?? Number.POSITIVE_INFINITY;
		this.#create = options.create;
		this.#destroy = options.destroy;
		this.#validate = options.validate;
	}

	public get maxSize() { return this.#maxSize; }
	public get minSize() { return this.#minSize; }
	public get size() { return this.#total; }
	public get active() { return this.#active; }
	public get idle() { return this.#idle.length; }
	public get pending() { return this.#waiters.length; }
	public get closed() { return this.#closed; }

	/** Create idle resources until the configured minimum size is reached. */
	public async warm(): Promise<void> {
		if (this.#closed) {
			throw new ResourcePoolClosedError();
		}

		while (this.#total + this.#creating < this.#minSize) {
			this.#creating++;

			try {
				const resource = await this.#create();

				if (this.#closed) {
					await this.#destroyResource(resource, false);
					throw new ResourcePoolClosedError();
				}

				this.#total++;
				this.#idle.push({ value: resource, idleSince: Date.now() });
			} finally {
				this.#creating--;
				this.#checkDrained();
			}
		}

		this.#scheduleIdlePrune();
		void this.#dispatch();
	}

	/** Acquire a validated resource lease in FIFO request order. */
	public async acquire(options: IResourceAcquireOptions = {}): Promise<IResourceLease<T>> {
		if (this.#closed) {
			throw new ResourcePoolClosedError();
		}

		if (options.signal?.aborted) {
			throw this.#abortReason(options.signal);
		}

		const timeoutMs = options.timeoutMs ?? this.#acquireTimeoutMs;

		this.#validateDuration(timeoutMs, 'timeoutMs');

		const promise = new Promise<IResourceLease<T>>((resolve, reject) => {
			const waiter = this.#createWaiter(resolve, reject, options.signal, timeoutMs);
			this.#waiters.push(waiter);
		});

		void this.#dispatch();

		return await promise;
	}

	/** Destroy expired idle resources and return the number removed. */
	public async pruneIdle(): Promise<number> {
		this.#clearIdleTimer();

		if (this.#idleTimeoutMs === Number.POSITIVE_INFINITY) {
			return 0;
		}

		const now = Date.now();
		const expired: Array<IIdleResource<T>> = [];

		for (let index = this.#idle.length - 1; index >= 0; index--) {
			const resource = this.#idle[index]!;

			if (now - resource.idleSince >= this.#idleTimeoutMs) {
				expired.push(resource);
				this.#idle.splice(index, 1);
			}
		}

		await Promise.all(expired.map(resource => this.#destroyResource(resource.value)));

		this.#scheduleIdlePrune();
		void this.#dispatch();

		return expired.length;
	}

	/** Stop acquisitions, reject queued callers, and destroy resources as leases return. */
	public async drain(): Promise<void> {
		if (this.#drainPromise) {
			return await this.#drainPromise;
		}

		this.#closed = true;
		this.#clearIdleTimer();
		this.#drainPromise = new Promise<void>((resolve) => {
			this.#resolveDrain = resolve;
		});

		for (const waiter of this.#waiters.splice(0)) {
			waiter.cleanup();
			waiter.reject(new ResourcePoolClosedError());
		}

		const idle = this.#idle.splice(0);
		await Promise.all(idle.map(resource => this.#destroyResource(resource.value)));
		this.#checkDrained();

		return await this.#drainPromise;
	}

	public async [Symbol.asyncDispose](): Promise<void> {
		await this.drain();
	}

	#createWaiter(
		resolve: (lease: IResourceLease<T>) => void,
		reject: (error: unknown) => void,
		signal: AbortSignal | undefined,
		timeoutMs: number
	): IResourceWaiter<T> {
		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		const waiter: IResourceWaiter<T> = {
			resolve,
			reject,
			cleanup: () => {
				signal?.removeEventListener('abort', onAbort);

				if (timeoutId !== undefined) {
					clearTimeout(timeoutId);
				}
			}
		};
		const removeAndReject = (error: unknown) => {
			const index = this.#waiters.indexOf(waiter);

			if (index >= 0) {
				this.#waiters.splice(index, 1);
				waiter.cleanup();
				reject(error);
			}
		};
		const onAbort = () => removeAndReject(this.#abortReason(signal));

		signal?.addEventListener('abort', onAbort, { once: true });

		if (timeoutMs !== Number.POSITIVE_INFINITY) {
			timeoutId = setTimeout(() => removeAndReject(new ResourceAcquireTimeoutError()), timeoutMs);
		}

		return waiter;
	}

	async #dispatch(): Promise<void> {
		if (this.#closed) {
			return;
		}

		if (this.#dispatching) {
			this.#dispatchRequested = true;

			return;
		}

		this.#dispatching = true;

		try {
			while (this.#waiters.length > 0 && !this.#closed) {
				let resource: IIdleResource<T> | undefined;

				try {
					resource = await this.#takeIdle();
				} catch (error) {
					this.#rejectNext(error);
					continue;
				}

				if (resource === undefined && this.#total + this.#creating < this.#maxSize) {
					resource = await this.#createForWaiter();
				}

				if (resource === undefined) {
					break;
				}

				const waiter = this.#waiters.shift();

				if (!waiter) {
					resource.idleSince = Date.now();
					this.#idle.push(resource);
					break;
				}

				waiter.cleanup();
				this.#active++;
				waiter.resolve(this.#createLease(resource.value));
			}
		} finally {
			this.#dispatching = false;
			this.#scheduleIdlePrune();
			this.#checkDrained();

			if (this.#dispatchRequested) {
				this.#dispatchRequested = false;
				void this.#dispatch();
			}
		}
	}

	async #createForWaiter(): Promise<IIdleResource<T> | undefined> {
		this.#creating++;

		try {
			const resource = await this.#create();

			if (this.#closed) {
				await this.#destroyResource(resource, false);

				return undefined;
			}

			this.#total++;

			return { value: resource, idleSince: Date.now() };
		} catch (error) {
			this.#rejectNext(error);

			return undefined;
		} finally {
			this.#creating--;
		}
	}

	async #takeIdle(): Promise<IIdleResource<T> | undefined> {
		while (this.#idle.length > 0) {
			const entry = this.#idle.pop()!;
			const expired = Date.now() - entry.idleSince >= this.#idleTimeoutMs;
			const valid = !expired && (this.#validate ? await this.#validate(entry.value) : true);

			if (valid) {
				return entry;
			}

			await this.#destroyResource(entry.value);
		}

		return undefined;
	}

	#createLease(resource: T): IResourceLease<T> {
		let released = false;

		const release = async (invalid: boolean) => {
			if (released) {
				return;
			}

			released = true;
			await this.#releaseResource(resource, invalid);
		};

		return {
			value: resource,
			get released() {
				return released;
			},
			release: () => release(false),
			invalidate: () => release(true),
			async [Symbol.asyncDispose]() {
				await release(false);
			}
		};
	}

	async #releaseResource(resource: T, invalid: boolean): Promise<void> {
		this.#active--;

		if (invalid || this.#closed) {
			await this.#destroyResource(resource);
		} else {
			this.#idle.push({ value: resource, idleSince: Date.now() });
		}

		this.#checkDrained();
		void this.#dispatch();
	}

	async #destroyResource(resource: T, counted = true): Promise<void> {
		if (counted) {
			this.#total--;
		}

		this.#destroying++;

		try {
			await this.#destroy(resource);
		} finally {
			this.#destroying--;
			this.#checkDrained();
		}
	}

	#rejectNext(error: unknown): void {
		const waiter = this.#waiters.shift();

		if (waiter) {
			waiter.cleanup();
			waiter.reject(error);
		}
	}

	#scheduleIdlePrune(): void {
		this.#clearIdleTimer();

		if (this.#closed || this.#idle.length === 0 || this.#idleTimeoutMs === Number.POSITIVE_INFINITY) {
			return;
		}

		const oldest = Math.min(...this.#idle.map(resource => resource.idleSince));
		const delay = Math.max(0, oldest + this.#idleTimeoutMs - Date.now());

		this.#idleTimer = setTimeout(() => {
			void this.pruneIdle().catch(() => undefined);
		}, delay);
	}

	#clearIdleTimer(): void {
		if (this.#idleTimer !== undefined) {
			clearTimeout(this.#idleTimer);
			this.#idleTimer = undefined;
		}
	}

	#checkDrained(): void {
		if (
			this.#closed &&
			this.#total === 0 &&
			this.#active === 0 &&
			this.#creating === 0 &&
			this.#destroying === 0
		) {
			this.#resolveDrain?.();
		}
	}

	#abortReason(signal?: AbortSignal): unknown {
		return signal?.reason ?? new DOMException('Aborted', 'AbortError');
	}

	#validateSize(value: number, name: string, minimum: number): void {
		if (!Number.isInteger(value) || value < minimum) {
			throw new Error(`${name} must be an integer >= ${minimum}`);
		}
	}

	#validateDuration(value: number, name: string): void {
		if ((!Number.isFinite(value) && value !== Number.POSITIVE_INFINITY) || value < 0) {
			throw new Error(`${name} must be a finite number >= 0 or Infinity`);
		}
	}
}
