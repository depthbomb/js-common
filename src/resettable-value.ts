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
		this.value         = value;
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
