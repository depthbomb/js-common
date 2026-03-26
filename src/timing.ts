import type { Awaitable, Maybe } from './typing';

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

export type RetryJitter = 'none' | 'full' | 'equal';

export interface RetryOptions {
	attempts?: number;
	baseMs?: number;
	maxMs?: number;
	jitter?: RetryJitter;
	signal?: AbortSignal;
	shouldRetry?: (error: unknown, attempt: number) => Awaitable<boolean>;
}

function throwIfAborted(signal?: AbortSignal) {
	if (signal?.aborted) {
		throw new Error('Aborted');
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
			reject(new Error('Aborted'));
		}

		if (signal) {
			signal.addEventListener('abort', onAbort, { once: true });
		}
	});
}

function getJitteredDelay(delayMs: number, jitter: RetryJitter): number {
	if (jitter === 'none') {
		return delayMs;
	}

	if (jitter === 'full') {
		return Math.floor(Math.random() * delayMs);
	}

	return Math.floor(delayMs / 2 + Math.random() * (delayMs / 2));
}

/**
 * Retries an operation with exponential backoff.
 *
 * @param fn Operation to run for each attempt.
 * @param options Retry options controlling attempts, backoff, jitter, and cancellation.
 */
export async function retry<T>(fn: (attempt: number) => Awaitable<T>, options: RetryOptions = {}): Promise<T> {
	const attempts = options.attempts ?? 3;
	const baseMs = options.baseMs ?? 100;
	const maxMs = options.maxMs ?? Number.POSITIVE_INFINITY;
	const jitter = options.jitter ?? 'none';

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
			const delay = getJitteredDelay(exponentialDelay, jitter);
			await waitFor(delay, options.signal);
		}
	}

	throw new Error('Unreachable');
}
