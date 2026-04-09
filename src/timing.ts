import { isUndefined } from './guards';
import type { DateLike } from './guards';
import type { Maybe, Awaitable } from './typing';

/**
 * Parsed duration parts.
 */
export interface IDurationParts {
	years: number;
	months: number;
	weeks: number;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
	milliseconds: number;
}

/**
 * Formatting options for human-readable durations.
 */
export interface IFormatDurationOptions {
	precision?: number;
	labels?: Partial<Record<keyof IDurationParts, string | { singular: string; plural: string }>>;
}

const enum DurationUnit {
	Years        = 'years',
	Months       = 'months',
	Weeks        = 'weeks',
	Days         = 'days',
	Hours        = 'hours',
	Minutes      = 'minutes',
	Seconds      = 'seconds',
	Milliseconds = 'milliseconds'
}

const DURATION_TOKEN_PATTERN = /(\d+)\s*(milliseconds?|msecs?|ms|years?|yrs?|y|months?|mos?|mo|weeks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m(?!s)|seconds?|secs?|s)/gi;

const FIXED_DURATION_MS = {
	[DurationUnit.Years]:        365 * 24 * 60 * 60 * 1_000,
	[DurationUnit.Months]:       30 * 24 * 60 * 60 * 1_000,
	[DurationUnit.Weeks]:        7 * 24 * 60 * 60 * 1_000,
	[DurationUnit.Days]:         24 * 60 * 60 * 1_000,
	[DurationUnit.Hours]:        60 * 60 * 1_000,
	[DurationUnit.Minutes]:      60 * 1_000,
	[DurationUnit.Seconds]:      1_000,
	[DurationUnit.Milliseconds]: 1,
} as const;

/**
 * Parsed duration value with helpers for fixed-millisecond and date-based calculations.
 */
export class Duration {
	readonly #parts: Readonly<IDurationParts>;

	public constructor(parts: Partial<IDurationParts> = {}) {
		this.#parts = Object.freeze({
			years: parts.years ?? 0,
			months: parts.months ?? 0,
			weeks: parts.weeks ?? 0,
			days: parts.days ?? 0,
			hours: parts.hours ?? 0,
			minutes: parts.minutes ?? 0,
			seconds: parts.seconds ?? 0,
			milliseconds: parts.milliseconds ?? 0
		});
	}

	/**
	 * Parsed duration parts.
	 */
	public get parts(): Readonly<IDurationParts> {
		return this.#parts;
	}

	/**
	 * Fixed-conversion milliseconds for this duration.
	 *
	 * Years are treated as 365 days and months as 30 days unless a date anchor is supplied to
	 * {@link toMilliseconds}.
	 */
	public get milliseconds() {
		return this.toMilliseconds();
	}

	/**
	 * Format the duration as a human-readable string using fixed unit conversions.
	 */
	public toHumanString(options: IFormatDurationOptions = {}) {
		return formatDuration(this.toMilliseconds(), options);
	}

	/**
	 * Convert the duration to milliseconds.
	 *
	 * When `from` is provided, year/month units are applied against that date and the exact
	 * millisecond delta is returned.
	 */
	public toMilliseconds(from?: DateLike): number {
		if (!isUndefined(from)) {
			const start = toDate(from);
			return this.from(start).getTime() - start.getTime();
		}

		return this.#parts.years * FIXED_DURATION_MS[DurationUnit.Years]
			+ this.#parts.months * FIXED_DURATION_MS[DurationUnit.Months]
			+ this.#parts.weeks * FIXED_DURATION_MS[DurationUnit.Weeks]
			+ this.#parts.days * FIXED_DURATION_MS[DurationUnit.Days]
			+ this.#parts.hours * FIXED_DURATION_MS[DurationUnit.Hours]
			+ this.#parts.minutes * FIXED_DURATION_MS[DurationUnit.Minutes]
			+ this.#parts.seconds * FIXED_DURATION_MS[DurationUnit.Seconds]
			+ this.#parts.milliseconds;
	}

	/**
	 * Apply the duration to the current time or a provided `now` value.
	 */
	public fromNow(now: DateLike = new Date()) {
		return this.from(now);
	}

	/**
	 * Apply the duration to a provided date.
	 */
	public from(date: DateLike): Date {
		const result = toDate(date);

		if (this.#parts.years !== 0 || this.#parts.months !== 0) {
			applyCalendarDuration(result, this.#parts.years, this.#parts.months);
		}

		const remainder = this.#parts.weeks * FIXED_DURATION_MS[DurationUnit.Weeks]
			+ this.#parts.days * FIXED_DURATION_MS[DurationUnit.Days]
			+ this.#parts.hours * FIXED_DURATION_MS[DurationUnit.Hours]
			+ this.#parts.minutes * FIXED_DURATION_MS[DurationUnit.Minutes]
			+ this.#parts.seconds * FIXED_DURATION_MS[DurationUnit.Seconds]
			+ this.#parts.milliseconds;

		if (remainder !== 0) {
			result.setTime(result.getTime() + remainder);
		}

		return result;
	}
}

/**
 * Parse a duration string such as `1d3h15m3s` or mixed prose like
 * `1 day, 3h & 15m, and another 3 seconds`.
 *
 * Supported units range from years down to milliseconds.
 */
export function parseDuration(input: string): Duration {
	const parts: IDurationParts = {
		years: 0,
		months: 0,
		weeks: 0,
		days: 0,
		hours: 0,
		minutes: 0,
		seconds: 0,
		milliseconds: 0
	};

	for (const match of input.matchAll(DURATION_TOKEN_PATTERN)) {
		const amount = Number.parseInt(match[1]!, 10);
		const unit   = normalizeDurationUnit(match[2]!);

		parts[unit] += amount;
	}

	if (Object.values(parts).every((value) => value === 0)) {
		throw new Error('duration string did not contain any recognized units');
	}

	return new Duration(parts);
}

/**
 * Convert a millisecond count into a human-readable duration string.
 *
 * Examples:
 * - `1000` -> `1 second`
 * - `98_103_000` with `{ precision: 2 }` -> `1 day 3 hours`
 */
export function formatDuration(milliseconds: number, options: IFormatDurationOptions = {}): string {
	if (!Number.isFinite(milliseconds) || milliseconds < 0) {
		throw new Error('milliseconds must be a finite number >= 0');
	}

	const precision = options.precision ?? Number.POSITIVE_INFINITY;
	if (precision !== Number.POSITIVE_INFINITY && (!Number.isInteger(precision) || precision < 1)) {
		throw new Error('precision must be an integer >= 1');
	}

	if (milliseconds === 0) {
		return '0 milliseconds';
	}

	let remaining = Math.floor(milliseconds);

	const parts = [] as string[];

	for (const [unit, unitMs] of FORMAT_DURATION_UNITS) {
		if (parts.length >= precision) {
			break;
		}

		const amount = Math.floor(remaining / unitMs);
		if (amount <= 0) {
			continue;
		}

		remaining -= amount * unitMs;

		const label = resolveDurationLabel(unit, amount, options.labels?.[unit]);

		parts.push(`${amount} ${label}`);
	}

	return parts.join(' ');
}

/**
 * Options for {@link retry}.
 */
export interface IRetryOptions {
	attempts?: number;
	baseMs?: number;
	maxMs?: number;
	jitter?: RetryJitter;
	signal?: AbortSignal;
	shouldRetry?: (error: unknown, attempt: number) => Awaitable<boolean>;
}

/**
 * Jitter strategies for retry delays.
 */
export const enum RetryJitter {
	None,
	Full,
	Equal
}

/**
 * Returns a promise after the provided {@link ms} has passed
 * @param ms The number of milliseconds to wait
 */
export function timeout(ms: number) {
	return new Promise((res) => setTimeout(res, ms));
}

/**
 * Rejects a promise after the provided {@link ms} has passed
 * @param ms The number of milliseconds to wait
 */
export function rejectionTimeout(ms: number) {
	return new Promise((_, rej) => setTimeout(rej, ms));
}

/**
 * Polls until the provided condition is met, or the timeout is exceeded.
 *
 * @param condition A function that returns a boolean or a promise that resolves to a boolean
 * @param interval The interval in milliseconds to wait between checks
 * @param timeoutMs The maximum time in milliseconds to wait before throwing an error
 */
export async function pollUntil(condition: () => Awaitable<boolean>, interval = 100, timeoutMs = 5_000) {
	const start = Date.now();
	while (!(await condition())) {
		if (Date.now() - start > timeoutMs) {
			throw new Error('Timeout exceeded');
		}

		await timeout(interval);
	}
}

/**
 * Wraps a promise with a timeout. If the promise does not resolve within the specified time, an error is thrown.
 *
 * @param promise The promise to wrap with a timeout
 * @param ms The number of milliseconds to wait before timing out
 *
 * @returns The result of the promise if it resolves before the timeout, otherwise throws an error
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timeoutId: Maybe<ReturnType<typeof setTimeout>>;

	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, rej) => {
				timeoutId = setTimeout(() => rej(new Error('Operation timed out')), ms);
			}),
		]);
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
	}
}

/**
 * Returns an AbortSignal that aborts automatically after the given number of milliseconds.
 *
 * @param ms Delay before automatic abort.
 */
export function abortAfter(ms: number): AbortSignal {
	if (!Number.isFinite(ms) || ms < 0) {
		throw new Error('ms must be a finite number >= 0');
	}

	return AbortSignal.timeout(ms);
}

/**
 * Returns a signal that aborts when any of the input signals aborts.
 *
 * @param signals Input abort signals.
 */
export function raceSignals(...signals: Array<Maybe<AbortSignal>>): AbortSignal {
	const validSignals = signals.filter((signal): signal is AbortSignal => signal !== undefined);
	const controller   = new AbortController();
	const listeners    = new Map<AbortSignal, () => void>();

	const abort = () => {
		if (controller.signal.aborted) {
			return;
		}

		controller.abort();

		for (const [signal, handler] of listeners) {
			signal.removeEventListener('abort', handler);
		}

		listeners.clear();
	};

	for (const signal of validSignals) {
		if (signal.aborted) {
			abort();
			break;
		}

		const handler = () => abort();

		listeners.set(signal, handler);

		signal.addEventListener('abort', handler, { once: true });
	}

	return controller.signal;
}

/**
 * Wraps a promise and rejects when the signal aborts before completion.
 *
 * @param promise Promise or value to await.
 * @param signal Abort signal to monitor.
 */
export async function withAbort<T>(promise: Awaitable<T>, signal: AbortSignal): Promise<T> {
	throwIfAborted(signal);

	return await new Promise<T>((resolve, reject) => {
		function onAbort() {
			signal.removeEventListener('abort', onAbort);
			reject(toAbortError());
		}

		signal.addEventListener('abort', onAbort, { once: true });

		Promise.resolve(promise).then(
			(value) => {
				signal.removeEventListener('abort', onAbort);
				resolve(value);
			},
			(error) => {
				signal.removeEventListener('abort', onAbort);
				reject(error);
			}
		);
	});
}

/**
 * Retries an operation with exponential backoff.
 *
 * @param fn Operation to run for each attempt.
 * @param options Retry options controlling attempts, backoff, jitter, and cancellation.
 */
export async function retry<T>(fn: (attempt: number) => Awaitable<T>, options: IRetryOptions = {}): Promise<T> {
	const attempts = options.attempts ?? 3;
	const baseMs   = options.baseMs   ?? 100;
	const maxMs    = options.maxMs    ?? Number.POSITIVE_INFINITY;
	const jitter   = options.jitter   ?? RetryJitter.None;

	if (!Number.isInteger(attempts) || attempts < 1) {
		throw new Error('attempts must be an integer >= 1');
	}
	if (baseMs < 0 || !Number.isFinite(baseMs)) {
		throw new Error('baseMs must be a finite number >= 0');
	}
	if (maxMs < 0 || Number.isNaN(maxMs)) {
		throw new Error('maxMs must be a number >= 0');
	}

	for (let attempt = 1; attempt <= attempts; attempt++) {
		throwIfAborted(options.signal);

		try {
			return await fn(attempt);
		} catch (error) {
			if (attempt >= attempts) {
				throw error;
			}

			if (options.shouldRetry) {
				const shouldContinue = await options.shouldRetry(error, attempt);
				if (!shouldContinue) {
					throw error;
				}
			}

			const exponentialDelay = Math.min(baseMs * 2 ** (attempt - 1), maxMs);
			const delay            = getJitteredDelay(exponentialDelay, jitter);

			await waitFor(delay, options.signal);
		}
	}

	throw new Error('Unreachable');
}

function toAbortError() {
	const error = new Error('Aborted');
	error.name = 'AbortError';

	return error;
}

function throwIfAborted(signal?: AbortSignal) {
	if (signal?.aborted) {
		throw toAbortError();
	}
}

async function waitFor(ms: number, signal?: AbortSignal) {
	if (ms <= 0) {
		throwIfAborted(signal);
		return;
	}

	await new Promise<void>((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			if (signal) {
				signal.removeEventListener('abort', onAbort);
			}
			resolve();
		}, ms);

		function onAbort() {
			clearTimeout(timeoutId);
			signal?.removeEventListener('abort', onAbort);
			reject(toAbortError());
		}

		if (signal) {
			signal.addEventListener('abort', onAbort, { once: true });
		}
	});
}

function getJitteredDelay(delayMs: number, jitter: RetryJitter) {
	if (jitter === RetryJitter.None) {
		return delayMs;
	}

	if (jitter === RetryJitter.Full) {
		return Math.floor(Math.random() * delayMs);
	}

	return Math.floor(delayMs / 2 + Math.random() * (delayMs / 2));
}

function normalizeDurationUnit(unit: string): keyof IDurationParts {
	switch (unit.toLowerCase()) {
		case 'y':
		case 'yr':
		case 'yrs':
		case 'year':
		case 'years':
			return 'years';
		case 'mo':
		case 'mos':
		case 'month':
		case 'months':
			return 'months';
		case 'w':
		case 'week':
		case 'weeks':
			return 'weeks';
		case 'd':
		case 'day':
		case 'days':
			return 'days';
		case 'h':
		case 'hr':
		case 'hrs':
		case 'hour':
		case 'hours':
			return 'hours';
		case 'm':
		case 'min':
		case 'mins':
		case 'minute':
		case 'minutes':
			return 'minutes';
		case 's':
		case 'sec':
		case 'secs':
		case 'second':
		case 'seconds':
			return 'seconds';
		case 'ms':
		case 'msec':
		case 'msecs':
		case 'millisecond':
		case 'milliseconds':
			return 'milliseconds';
		default:
			throw new Error(`unsupported duration unit: ${unit}`);
	}
}

function toDate(input: DateLike): Date {
	const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);

	if (Number.isNaN(date.getTime())) {
		throw new Error('invalid date');
	}

	return date;
}

function applyCalendarDuration(date: Date, years: number, months: number) {
	const originalDay = date.getUTCDate();
	const totalMonths = date.getUTCMonth() + months + years * 12;
	const targetYear = date.getUTCFullYear() + Math.floor(totalMonths / 12);
	const targetMonth = ((totalMonths % 12) + 12) % 12;
	const lastDay = getLastDayOfMonth(targetYear, targetMonth);

	date.setUTCFullYear(targetYear, targetMonth, Math.min(originalDay, lastDay));
}

function getLastDayOfMonth(year: number, month: number) {
	return new Date(year, month + 1, 0).getDate();
}

const FORMAT_DURATION_UNITS = [
	[DurationUnit.Years, FIXED_DURATION_MS[DurationUnit.Years]],
	[DurationUnit.Months, FIXED_DURATION_MS[DurationUnit.Months]],
	[DurationUnit.Weeks, FIXED_DURATION_MS[DurationUnit.Weeks]],
	[DurationUnit.Days, FIXED_DURATION_MS[DurationUnit.Days]],
	[DurationUnit.Hours, FIXED_DURATION_MS[DurationUnit.Hours]],
	[DurationUnit.Minutes, FIXED_DURATION_MS[DurationUnit.Minutes]],
	[DurationUnit.Seconds, FIXED_DURATION_MS[DurationUnit.Seconds]],
	[DurationUnit.Milliseconds, FIXED_DURATION_MS[DurationUnit.Milliseconds]]
] as const;

const FORMAT_DURATION_LABELS = {
	[DurationUnit.Years]: { singular: 'year', plural: 'years' },
	[DurationUnit.Months]: { singular: 'month', plural: 'months' },
	[DurationUnit.Weeks]: { singular: 'week', plural: 'weeks' },
	[DurationUnit.Days]: { singular: 'day', plural: 'days' },
	[DurationUnit.Hours]: { singular: 'hour', plural: 'hours' },
	[DurationUnit.Minutes]: { singular: 'minute', plural: 'minutes' },
	[DurationUnit.Seconds]: { singular: 'second', plural: 'seconds' },
	[DurationUnit.Milliseconds]: { singular: 'millisecond', plural: 'milliseconds' }
} as const;

function resolveDurationLabel(
	unit: keyof IDurationParts,
	amount: number,
	override?: string | { singular: string; plural: string }
) {
	if (override) {
		if (typeof override === 'string') {
			return override;
		}

		return amount === 1 ? override.singular : override.plural;
	}

	return amount === 1 ? FORMAT_DURATION_LABELS[unit].singular : FORMAT_DURATION_LABELS[unit].plural;
}
