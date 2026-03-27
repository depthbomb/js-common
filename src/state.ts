import type { Maybe } from './typing';

/**
 * Holds a mutable value and remembers its initial value so it can be restored.
 *
 * @typeParam T Type of the held value.
 */
export class ResettableValue<T> {
	/**
	 * The current value.
	 */
	public value: T;
	readonly #initialValue: T;

	/**
	 * Create a resettable value.
	 *
	 * @param value Initial value to store and reset back to.
	 */
	public constructor(value: T) {
		this.value = value;
		this.#initialValue = value;
	}

	/**
	 * Set the current value.
	 *
	 * @param value New value to assign.
	 */
	public set(value: T) {
		this.value = value;
	}

	/**
	 * Restore the value back to its initial constructor value.
	 */
	public reset() {
		this.value = this.#initialValue;
	}

	/**
	 * Return the current value for primitive coercion.
	 *
	 * @returns The current value.
	 */
	public valueOf() {
		return this.value;
	}

	/**
	 * Convert the current value to a string.
	 *
	 * @returns The string representation of the current value.
	 */
	public toString() {
		return String(this.value);
	}
}

/**
 * A resettable boolean helper with convenience setters and state checks.
 */
export class Flag extends ResettableValue<boolean> {
	/**
	 * Create a new flag.
	 *
	 * @param value Initial flag value. Defaults to `false`.
	 */
	public constructor(value: boolean = false) {
		super(value);
	}

	/**
	 * Whether the flag is currently `true`.
	 */
	public get isTrue() {
		return this.value === true;
	}

	/**
	 * Whether the flag is currently `false`.
	 */
	public get isFalse() {
		return !this.isTrue;
	}

	/**
	 * Set the flag value.
	 *
	 * @param value Value to assign.
	 */
	public override set(value: boolean) {
		super.set(value);
	}

	/**
	 * Set the flag to `true`.
	 */
	public setTrue() {
		this.value = true;
	}

	/**
	 * Set the flag to `false`.
	 */
	public setFalse() {
		this.value = false;
	}

	/**
	 * Invert the current flag value.
	 */
	public toggle() {
		this.value = !this.value;
	}
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
