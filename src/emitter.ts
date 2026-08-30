import { Channel } from './channel';
import type { Awaitable } from './typing';

/** A typed event listener. */
export type EventListener<T> = (payload: T) => Awaitable<void>;

/** Options for an event subscription. */
export interface IEventSubscriptionOptions {
	signal?: AbortSignal;
}

interface IListenerRecord<T> {
	listener: EventListener<T>;
	once: boolean;
	unsubscribe(): void;
}

/** Strongly typed async publish/subscribe and event-stream primitive. */
export class Emitter<TEvents extends object> {
	readonly #listeners = new Map<keyof TEvents, Set<IListenerRecord<unknown>>>();

	/** Subscribe to an event and return an idempotent unsubscribe function. */
	public on<K extends keyof TEvents>(
		event: K,
		listener: EventListener<TEvents[K]>,
		options: IEventSubscriptionOptions = {}
	): () => void {
		if (options.signal?.aborted) {
			return () => {};
		}

		return this.#add(event, listener, false, options.signal);
	}

	/** Subscribe for only the next emission of an event. */
	public once<K extends keyof TEvents>(
		event: K,
		listener: EventListener<TEvents[K]>,
		options: IEventSubscriptionOptions = {}
	): () => void {
		if (options.signal?.aborted) {
			return () => {};
		}

		return this.#add(event, listener, true, options.signal);
	}

	/** Remove every registration of a listener for an event. */
	public off<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): boolean {
		const records = this.#listeners.get(event);

		if (!records) {
			return false;
		}

		let removed = false;

		for (const record of [...records]) {
			if (record.listener === listener) {
				record.unsubscribe();
				removed = true;
			}
		}

		return removed;
	}

	/** Invoke listeners concurrently and aggregate any failures. */
	public async emit<K extends keyof TEvents>(
		event: K,
		...payload: TEvents[K] extends void ? [] : [TEvents[K]]
	): Promise<number> {
		const records = [...(this.#listeners.get(event) ?? [])];

		if (records.length === 0) {
			return 0;
		}

		for (const record of records) {
			if (record.once) {
				record.unsubscribe();
			}
		}

		const value = payload[0] as TEvents[K];
		const results = await Promise.allSettled(records.map(record => Promise.resolve().then(() => record.listener(value))));
		const errors = results
			.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
			.map(result => result.reason);

		if (errors.length > 0) {
			throw new AggregateError(errors, `Event listener failures for ${String(event)}`);
		}

		return records.length;
	}

	/** Return the number of listeners currently registered for an event. */
	public listenerCount<K extends keyof TEvents>(event: K): number {
		return this.#listeners.get(event)?.size ?? 0;
	}

	/** Remove listeners for one event, or every event when omitted. */
	public clear<K extends keyof TEvents>(event?: K): void {
		if (event === undefined) {
			for (const records of [...this.#listeners.values()]) {
				for (const record of [...records]) {
					record.unsubscribe();
				}
			}

			return;
		}

		for (const record of [...(this.#listeners.get(event) ?? [])]) {
			record.unsubscribe();
		}
	}

	/** Consume an event as an abortable async iterable. */
	public events<K extends keyof TEvents>(
		event: K,
		options: IEventSubscriptionOptions = {}
	): AsyncIterableIterator<TEvents[K]> {
		const channel = new Channel<TEvents[K]>();
		let finished = false;
		const unsubscribe = this.on(event, payload => channel.send(payload));
		const finish = (error?: unknown) => {
			if (finished) {
				return;
			}

			finished = true;
			unsubscribe();
			options.signal?.removeEventListener('abort', onAbort);
			channel.close(error);
		};
		const onAbort = () => finish(this.#abortReason(options.signal));

		if (options.signal?.aborted) {
			finish(this.#abortReason(options.signal));
		} else {
			options.signal?.addEventListener('abort', onAbort, { once: true });
		}

		return {
			[Symbol.asyncIterator]() {
				return this;
			},
			next: () => channel.receive(),
			return: async () => {
				finish();

				return { done: true, value: undefined };
			},
			throw: async (error?: unknown) => {
				finish(error);

				throw error;
			}
		};
	}

	#add<K extends keyof TEvents>(
		event: K,
		listener: EventListener<TEvents[K]>,
		once: boolean,
		signal?: AbortSignal
	): () => void {
		const records = this.#listeners.get(event) ?? new Set<IListenerRecord<unknown>>();
		const record: IListenerRecord<unknown> = {
			listener: listener as EventListener<unknown>,
			once,
			unsubscribe: () => {}
		};
		let subscribed = true;
		const unsubscribe = () => {
			if (!subscribed) {
				return;
			}

			subscribed = false;
			signal?.removeEventListener('abort', unsubscribe);
			this.#removeRecord(event, record);
		};

		record.unsubscribe = unsubscribe;

		records.add(record);
		this.#listeners.set(event, records);
		signal?.addEventListener('abort', unsubscribe, { once: true });

		return unsubscribe;
	}

	#removeRecord<K extends keyof TEvents>(event: K, record: IListenerRecord<unknown>): void {
		const records = this.#listeners.get(event);

		if (!records) {
			return;
		}

		records.delete(record);

		if (records.size === 0) {
			this.#listeners.delete(event);
		}
	}

	#abortReason(signal?: AbortSignal): unknown {
		return signal?.reason ?? new DOMException('Aborted', 'AbortError');
	}
}
