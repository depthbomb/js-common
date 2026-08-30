import { afterEach, it, expect, describe, vi } from 'vitest';
import { CircuitBreaker, CircuitOpenError, CircuitState } from '../dist/circuit-breaker.mjs';
import { deferred } from '../dist/atomic.mjs';

afterEach(() => {
	vi.useRealTimers();
});

describe('CircuitBreaker', () => {
	it('opens after the failure threshold and closes after a recovery probe', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000);

		const states: CircuitState[] = [];
		const breaker = new CircuitBreaker({
			failureThreshold: 2,
			resetAfterMs: 100,
			onStateChange: state => states.push(state)
		});

		await expect(breaker.execute(() => { throw new Error('one'); })).rejects.toThrow('one');
		await expect(breaker.execute(() => { throw new Error('two'); })).rejects.toThrow('two');
		expect(breaker.state).toBe(CircuitState.Open);
		await expect(breaker.execute(() => 'blocked')).rejects.toBeInstanceOf(CircuitOpenError);

		vi.setSystemTime(1_100);
		await expect(breaker.execute(() => 'recovered')).resolves.toBe('recovered');

		expect(breaker.state).toBe(CircuitState.Closed);
		expect(states).toEqual([CircuitState.Open, CircuitState.HalfOpen, CircuitState.Closed]);
	});

	it('allows only one concurrent half-open probe', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);

		const probe = deferred<string>();
		const breaker = new CircuitBreaker({ failureThreshold: 1, resetAfterMs: 10 });

		await expect(breaker.execute(() => { throw new Error('failure'); })).rejects.toThrow('failure');
		vi.setSystemTime(10);

		const first = breaker.execute(() => probe.promise);
		await expect(breaker.execute(() => 'second')).rejects.toBeInstanceOf(CircuitOpenError);

		probe.resolve('ok');
		await expect(first).resolves.toBe('ok');
	});

	it('supports fallbacks for rejected calls', async () => {
		const breaker = new CircuitBreaker();
		breaker.open();

		await expect(breaker.execute(() => 'unused', {
			fallback: error => error.name
		})).resolves.toBe('CircuitOpenError');
	});

	it('does not count errors excluded by the failure classifier', async () => {
		const breaker = new CircuitBreaker({
			failureThreshold: 1,
			isFailure: error => !(error instanceof TypeError)
		});

		await expect(breaker.execute(() => { throw new TypeError('caller error'); })).rejects.toThrow('caller error');

		expect(breaker.state).toBe(CircuitState.Closed);
		expect(breaker.snapshot.failures).toBe(0);
		expect(breaker.snapshot.successes).toBe(1);
	});

	it('exposes metrics and resets them', async () => {
		const breaker = new CircuitBreaker();

		await expect(breaker.execute(() => 1)).resolves.toBe(1);
		expect(breaker.snapshot).toMatchObject({ executions: 1, successes: 1, failures: 0 });

		breaker.reset();

		expect(breaker.snapshot).toMatchObject({
			state: CircuitState.Closed,
			executions: 0,
			successes: 0,
			failures: 0,
			rejected: 0
		});
	});
});
