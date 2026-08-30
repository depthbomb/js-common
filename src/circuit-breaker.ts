import type { Awaitable } from './typing';

/** Runtime state of a {@link CircuitBreaker}. */
export const enum CircuitState {
	Closed   = 'closed',
	Open     = 'open',
	HalfOpen = 'half-open'
}

/** Options for constructing a {@link CircuitBreaker}. */
export interface ICircuitBreakerOptions {
	failureThreshold?: number;
	successThreshold?: number;
	resetAfterMs?: number;
	isFailure?: (error: unknown) => boolean;
	onStateChange?: (state: CircuitState, previous: CircuitState) => void;
}

/** Per-call circuit breaker options. */
export interface ICircuitExecutionOptions<T> {
	fallback?: (error: CircuitOpenError) => Awaitable<T>;
}

/** Immutable operational counters for a circuit breaker. */
export interface ICircuitBreakerSnapshot {
	readonly state: CircuitState;
	readonly consecutiveFailures: number;
	readonly halfOpenSuccesses: number;
	readonly openedAt?: number;
	readonly executions: number;
	readonly successes: number;
	readonly failures: number;
	readonly rejected: number;
}

/** Error raised when an open circuit rejects an operation. */
export class CircuitOpenError extends Error {
	public constructor() {
		super('Circuit breaker is open');
		this.name = 'CircuitOpenError';
	}
}

/** Prevent repeated calls to an unhealthy dependency while allowing recovery probes. */
export class CircuitBreaker {
	readonly #failureThreshold: number;
	readonly #successThreshold: number;
	readonly #resetAfterMs: number;
	readonly #isFailure: (error: unknown) => boolean;
	readonly #onStateChange?: (state: CircuitState, previous: CircuitState) => void;
	#state = CircuitState.Closed;
	#consecutiveFailures = 0;
	#halfOpenSuccesses = 0;
	#halfOpenProbe = false;
	#openedAt?: number;
	#executions = 0;
	#successes = 0;
	#failures = 0;
	#rejected = 0;

	public constructor(options: ICircuitBreakerOptions = {}) {
		this.#failureThreshold = options.failureThreshold ?? 5;
		this.#successThreshold = options.successThreshold ?? 1;
		this.#resetAfterMs = options.resetAfterMs ?? 30_000;
		this.#isFailure = options.isFailure ?? (() => true);
		this.#onStateChange = options.onStateChange;

		this.#validatePositiveInteger(this.#failureThreshold, 'failureThreshold');
		this.#validatePositiveInteger(this.#successThreshold, 'successThreshold');

		if (!Number.isFinite(this.#resetAfterMs) || this.#resetAfterMs < 0) {
			throw new Error('resetAfterMs must be a finite number >= 0');
		}
	}

	public get state() { return this.#state; }

	public get snapshot(): ICircuitBreakerSnapshot {
		return {
			state: this.#state,
			consecutiveFailures: this.#consecutiveFailures,
			halfOpenSuccesses: this.#halfOpenSuccesses,
			openedAt: this.#openedAt,
			executions: this.#executions,
			successes: this.#successes,
			failures: this.#failures,
			rejected: this.#rejected
		};
	}

	/** Execute an operation when the circuit permits it. */
	public async execute<T>(operation: () => Awaitable<T>, options: ICircuitExecutionOptions<T> = {}): Promise<T> {
		this.#advanceOpenCircuit();

		if (this.#state === CircuitState.Open || (this.#state === CircuitState.HalfOpen && this.#halfOpenProbe)) {
			this.#rejected++;

			return this.#rejectOrFallback(options);
		}

		if (this.#state === CircuitState.HalfOpen) {
			this.#halfOpenProbe = true;
		}

		this.#executions++;

		try {
			const result = await operation();
			this.#recordSuccess();

			return result;
		} catch (error) {
			if (this.#isFailure(error)) {
				this.#recordFailure();
			} else {
				this.#recordSuccess();
			}

			throw error;
		} finally {
			this.#halfOpenProbe = false;
		}
	}

	/** Manually open the circuit and start its recovery delay. */
	public open(): void {
		this.#openedAt = Date.now();
		this.#halfOpenSuccesses = 0;
		this.#transition(CircuitState.Open);
	}

	/** Manually close the circuit and clear its current failure streak. */
	public close(): void {
		this.#consecutiveFailures = 0;
		this.#halfOpenSuccesses = 0;
		this.#halfOpenProbe = false;
		this.#openedAt = undefined;
		this.#transition(CircuitState.Closed);
	}

	/** Close the circuit and reset all operational counters. */
	public reset(): void {
		this.close();
		this.#executions = 0;
		this.#successes = 0;
		this.#failures = 0;
		this.#rejected = 0;
	}

	async #rejectOrFallback<T>(options: ICircuitExecutionOptions<T>): Promise<T> {
		const error = new CircuitOpenError();

		if (options.fallback) {
			return await options.fallback(error);
		}

		throw error;
	}

	#advanceOpenCircuit(): void {
		if (
			this.#state === CircuitState.Open &&
			this.#openedAt !== undefined &&
			Date.now() - this.#openedAt >= this.#resetAfterMs
		) {
			this.#halfOpenSuccesses = 0;
			this.#transition(CircuitState.HalfOpen);
		}
	}

	#recordSuccess(): void {
		this.#successes++;

		if (this.#state === CircuitState.HalfOpen) {
			this.#halfOpenSuccesses++;

			if (this.#halfOpenSuccesses >= this.#successThreshold) {
				this.close();
			}

			return;
		}

		this.#consecutiveFailures = 0;
	}

	#recordFailure(): void {
		this.#failures++;

		if (this.#state === CircuitState.HalfOpen) {
			this.open();

			return;
		}

		this.#consecutiveFailures++;

		if (this.#consecutiveFailures >= this.#failureThreshold) {
			this.open();
		}
	}

	#transition(state: CircuitState): void {
		if (state === this.#state) {
			return;
		}

		const previous = this.#state;
		this.#state = state;
		this.#onStateChange?.(state, previous);
	}

	#validatePositiveInteger(value: number, name: string): void {
		if (!Number.isInteger(value) || value < 1) {
			throw new Error(`${name} must be an integer >= 1`);
		}
	}
}
