import { ResettableValue } from './resettable-value';

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
