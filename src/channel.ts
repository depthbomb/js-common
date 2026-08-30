/** Options for creating a {@link Channel}. */
export interface IChannelOptions {
	capacity?: number;
}

/** Options for an abortable channel operation. */
export interface IChannelOperationOptions {
	signal?: AbortSignal;
}

interface ISender<T> {
	value: T;
	resolve(): void;
	reject(error: unknown): void;
	cleanup(): void;
}

interface IReceiver<T> {
	resolve(result: IteratorResult<T>): void;
	reject(error: unknown): void;
	cleanup(): void;
}

/** Error raised when sending to a closed channel. */
export class ChannelClosedError extends Error {
	public constructor() {
		super('Channel is closed');
		this.name = 'ChannelClosedError';
	}
}

/**
 * An async producer/consumer queue with optional bounded capacity and backpressure.
 */
export class Channel<T> implements AsyncIterable<T> {
	readonly #capacity: number;
	readonly #values: T[] = [];
	readonly #senders: Array<ISender<T>> = [];
	readonly #receivers: Array<IReceiver<T>> = [];
	#closed = false;
	#closeError: unknown;

	public constructor(options: IChannelOptions = {}) {
		const capacity = options.capacity ?? Number.POSITIVE_INFINITY;

		if ((!Number.isInteger(capacity) && capacity !== Number.POSITIVE_INFINITY) || capacity < 0) {
			throw new Error('capacity must be an integer >= 0 or Infinity');
		}

		this.#capacity = capacity;
	}

	public get capacity() { return this.#capacity; }
	public get size() { return this.#values.length; }
	public get pendingSends() { return this.#senders.length; }
	public get pendingReceives() { return this.#receivers.length; }
	public get closed() { return this.#closed; }

	/** Send a value, waiting while a bounded channel is full. */
	public async send(value: T, options: IChannelOperationOptions = {}): Promise<void> {
		this.#throwIfAborted(options.signal);

		if (this.#closed) {
			throw new ChannelClosedError();
		}

		const receiver = this.#receivers.shift();

		if (receiver) {
			receiver.cleanup();
			receiver.resolve({ done: false, value });

			return;
		}

		if (this.#values.length < this.#capacity) {
			this.#values.push(value);

			return;
		}

		await new Promise<void>((resolve, reject) => {
			const sender = this.#createSender(value, resolve, reject, options.signal);
			this.#senders.push(sender);
		});
	}

	/** Receive the next value, or a completed iterator result after graceful closure. */
	public async receive(options: IChannelOperationOptions = {}): Promise<IteratorResult<T>> {
		this.#throwIfAborted(options.signal);

		if (this.#values.length > 0) {
			const value = this.#values.shift()!;
			this.#promoteSender();

			return { done: false, value };
		}

		const sender = this.#senders.shift();

		if (sender) {
			sender.cleanup();
			sender.resolve();

			return { done: false, value: sender.value };
		}

		if (this.#closed) {
			return this.#closedResult();
		}

		return await new Promise<IteratorResult<T>>((resolve, reject) => {
			const receiver = this.#createReceiver(resolve, reject, options.signal);
			this.#receivers.push(receiver);
		});
	}

	/** Close the channel. Buffered values remain available after graceful closure. */
	public close(error?: unknown): void {
		if (this.#closed) {
			return;
		}

		this.#closed = true;
		this.#closeError = error;

		const closeReason = error ?? new ChannelClosedError();

		for (const sender of this.#senders.splice(0)) {
			sender.cleanup();
			sender.reject(closeReason);
		}

		if (this.#values.length === 0) {
			this.#settleReceivers();
		}
	}

	public [Symbol.asyncIterator](): AsyncIterator<T> {
		return {
			next: () => this.receive()
		};
	}

	#createSender(value: T, resolve: () => void, reject: (error: unknown) => void, signal?: AbortSignal): ISender<T> {
		const sender: ISender<T> = {
			value,
			resolve,
			reject,
			cleanup: () => signal?.removeEventListener('abort', onAbort)
		};

		const onAbort = () => {
			const index = this.#senders.indexOf(sender);

			if (index >= 0) {
				this.#senders.splice(index, 1);
			}

			reject(this.#abortReason(signal));
		};

		signal?.addEventListener('abort', onAbort, { once: true });

		return sender;
	}

	#createReceiver(resolve: (result: IteratorResult<T>) => void, reject: (error: unknown) => void, signal?: AbortSignal): IReceiver<T> {
		const receiver: IReceiver<T> = {
			resolve,
			reject,
			cleanup: () => signal?.removeEventListener('abort', onAbort)
		};

		const onAbort = () => {
			const index = this.#receivers.indexOf(receiver);

			if (index >= 0) {
				this.#receivers.splice(index, 1);
			}

			reject(this.#abortReason(signal));
		};

		signal?.addEventListener('abort', onAbort, { once: true });

		return receiver;
	}

	#promoteSender(): void {
		const sender = this.#senders.shift();

		if (sender) {
			sender.cleanup();
			this.#values.push(sender.value);
			sender.resolve();
		}

		if (this.#closed && this.#values.length === 0) {
			this.#settleReceivers();
		}
	}

	#settleReceivers(): void {
		for (const receiver of this.#receivers.splice(0)) {
			receiver.cleanup();

			if (this.#closeError !== undefined) {
				receiver.reject(this.#closeError);
			} else {
				receiver.resolve({ done: true, value: undefined });
			}
		}
	}

	#closedResult(): IteratorResult<T> {
		if (this.#closeError !== undefined) {
			throw this.#closeError;
		}

		return { done: true, value: undefined };
	}

	#throwIfAborted(signal?: AbortSignal): void {
		if (signal?.aborted) {
			throw this.#abortReason(signal);
		}
	}

	#abortReason(signal?: AbortSignal): unknown {
		return signal?.reason ?? new DOMException('Aborted', 'AbortError');
	}
}
