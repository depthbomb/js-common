import { it, expect, describe } from 'vitest';
import { Channel, ChannelClosedError } from '../dist/channel.mjs';

describe('Channel', () => {
	it('delivers values directly to waiting receivers', async () => {
		const channel = new Channel<number>();
		const received = channel.receive();

		expect(channel.pendingReceives).toBe(1);
		await channel.send(42);

		await expect(received).resolves.toEqual({ done: false, value: 42 });
		expect(channel.pendingReceives).toBe(0);
	});

	it('applies backpressure when bounded capacity is full', async () => {
		const channel = new Channel<number>({ capacity: 1 });

		await channel.send(1);
		const second = channel.send(2);

		expect(channel.size).toBe(1);
		expect(channel.pendingSends).toBe(1);
		await expect(channel.receive()).resolves.toEqual({ done: false, value: 1 });
		await expect(second).resolves.toBeUndefined();
		await expect(channel.receive()).resolves.toEqual({ done: false, value: 2 });
	});

	it('supports rendezvous channels with zero capacity', async () => {
		const channel = new Channel<string>({ capacity: 0 });
		const sent = channel.send('value');

		expect(channel.pendingSends).toBe(1);
		await expect(channel.receive()).resolves.toEqual({ done: false, value: 'value' });
		await expect(sent).resolves.toBeUndefined();
	});

	it('preserves order across internal queue compaction boundaries', async () => {
		const channel = new Channel<number>();
		const count = 1_000;

		for (let value = 0; value < count; value++) {
			await channel.send(value);
		}

		for (let value = 0; value < count; value++) {
			await expect(channel.receive()).resolves.toEqual({ done: false, value });
		}

		expect(channel.size).toBe(0);
	});

	it('drains buffered values before completing async iteration', async () => {
		const channel = new Channel<number>();

		await channel.send(1);
		await channel.send(2);
		channel.close();

		const values: number[] = [];

		for await (const value of channel) {
			values.push(value);
		}

		expect(values).toEqual([1, 2]);
		expect(channel.closed).toBe(true);
		await expect(channel.send(3)).rejects.toBeInstanceOf(ChannelClosedError);
	});

	it('rejects waiting operations when aborted or closed with an error', async () => {
		const channel = new Channel<number>({ capacity: 0 });
		const controller = new AbortController();
		const receiving = channel.receive({ signal: controller.signal });

		controller.abort(new Error('cancelled'));
		await expect(receiving).rejects.toThrow('cancelled');
		expect(channel.pendingReceives).toBe(0);

		const failed = channel.receive();
		channel.close(new Error('failed'));

		await expect(failed).rejects.toThrow('failed');
	});
});
