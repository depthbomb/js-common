import { deprecate } from './functional';
import { resettableLazy as _resettableLazy, resettableLazyAsync as _resettableLazyAsync } from './atomic';

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
 * @deprecated
 * Import from the `atomic` module instead.
 */
export const resettableLazy = deprecate(_resettableLazy, {
	deprecatedName: 'state#resettableLazy',
	replacementName: 'atomic#resettableLazy',
	deprecatedSince: '2.5.0',
	removedIn: '3.0.0'
});

/**
 * @deprecated
 * Import from the `atomic` module instead.
 */
export const resettableLazyAsync = deprecate(_resettableLazyAsync, {
	deprecatedName: 'state#resettableLazyAsync',
	replacementName: 'atomic#resettableLazyAsync',
	deprecatedSince: '2.5.0',
	removedIn: '3.0.0'
});
