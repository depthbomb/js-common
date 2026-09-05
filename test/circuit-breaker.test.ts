import { deferred } from '../dist/atomic.mjs';
import { it, vi, expect, describe, afterEach } from 'vitest';
import { CircuitState, CircuitBreaker, CircuitOpenError } from '../dist/circuit-breaker.mjs';

afterEach(() => {
	vi.useRealTimers();
});

describe('CircuitBreaker', () => {
	it.each([false, true])('ignores stale request state changes during recovery (fails: %s)', async (fails) => {
		const old = deferred<string>();
		const probe = deferred<string>();
		const breaker = new CircuitBreaker({
			failureThreshold: 1,
			successThreshold:  2,
			resetAfterMs:      0
		});
		const oldCall = breaker.execute(() => old.promise);
		const oldResult = fails ? expect(oldCall).rejects.toBe('stale') : expect(oldCall).resolves.toBe('stale');
		breaker.open();
		const probeCall = breaker.execute(() => probe.promise);

		if (fails) {
			old.reject('stale');
		} else {
			old.resolve('stale');
		}

		await oldResult;
		expect(breaker.snapshot.halfOpenSuccesses).toBe(0);
		await expect(breaker.execute(() => 'extra')).rejects.toBeInstanceOf(CircuitOpenError);
		probe.resolve('healthy');
		await probeCall;
		expect(breaker.state).toBe(CircuitState.HalfOpen);
		await breaker.execute(() => 'healthy again');
		expect(breaker.state).toBe(CircuitState.Closed);
	});

	it('does not let an old execution overwrite reset metrics or state', async () => {
		const old = deferred<void>();
		const breaker = new CircuitBreaker({
			failureThreshold: 1
		});
		const call = expect(breaker.execute(() => old.promise)).rejects.toBe('old failure');
		breaker.reset();
		old.reject('old failure');
		await call;
		expect(breaker.snapshot).toMatchObject({
			state:      CircuitState.Closed,
			executions: 0,
			failures:   0
		});
	});

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
