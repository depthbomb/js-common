import { it, expect, describe } from 'vitest';
import { Emitter } from '../dist/emitter.mjs';

interface ITestEvents {
	progress: { completed: number; total: number };
	done: void;
	error: Error;
}

describe('Emitter', () => {
	it('delivers typed payloads and supports idempotent unsubscription', async () => {
		const emitter = new Emitter<ITestEvents>();
		const received: number[] = [];
		const unsubscribe = emitter.on('progress', event => {
			received.push(event.completed);
		});

		await expect(emitter.emit('progress', { completed: 1, total: 2 })).resolves.toBe(1);
		unsubscribe();
		unsubscribe();
		await expect(emitter.emit('progress', { completed: 2, total: 2 })).resolves.toBe(0);

		expect(received).toEqual([1]);
	});

	it('removes one-shot listeners before invoking them', async () => {
		const emitter = new Emitter<ITestEvents>();
		let calls = 0;

		emitter.once('done', async () => {
			calls++;
			await emitter.emit('done');
		});

		await emitter.emit('done');

		expect(calls).toBe(1);
		expect(emitter.listenerCount('done')).toBe(0);
	});

	it('aggregates synchronous and asynchronous listener failures', async () => {
		const emitter = new Emitter<ITestEvents>();
		let successful = false;

		emitter.on('error', () => { throw new Error('sync'); });
		emitter.on('error', async () => { throw new Error('async'); });
		emitter.on('error', () => { successful = true; });

		const emission = emitter.emit('error', new Error('source'));

		await expect(emission).rejects.toMatchObject({
			name: 'AggregateError',
			errors: [expect.objectContaining({ message: 'sync' }), expect.objectContaining({ message: 'async' })]
		});
		expect(successful).toBe(true);
	});

	it('removes subscriptions when their signal aborts', async () => {
		const emitter = new Emitter<ITestEvents>();
		const controller = new AbortController();
		let calls = 0;

		emitter.on('done', () => { calls++; }, { signal: controller.signal });
		controller.abort();

		await emitter.emit('done');
		expect(calls).toBe(0);
	});

	it('exposes events as cancellable async streams', async () => {
		const emitter = new Emitter<ITestEvents>();
		const stream = emitter.events('progress');
		const first = stream.next();

		await emitter.emit('progress', { completed: 1, total: 3 });
		await expect(first).resolves.toEqual({
			done: false,
			value: { completed: 1, total: 3 }
		});

		await stream.return?.();
		expect(emitter.listenerCount('progress')).toBe(0);
		await expect(stream.next()).resolves.toEqual({ done: true, value: undefined });
	});

	it('rejects event streams when their signal aborts', async () => {
		const emitter = new Emitter<ITestEvents>();
		const controller = new AbortController();
		const stream = emitter.events('done', { signal: controller.signal });
		const next = stream.next();

		controller.abort(new Error('cancelled'));

		await expect(next).rejects.toThrow('cancelled');
		expect(emitter.listenerCount('done')).toBe(0);
	});
});
