import { it, vi, expect, describe } from 'vitest';
import {
	swap,
	Latch,
	Barrier,
	Mutex,
	lazy,
	once,
	deferred,
	onceAsync,
	Semaphore,
	AsyncEvent,
	AtomicValue,
	lazyAsync,
	memoizeAsync,
	singleFlight,
	compareAndSet,
	ReadWriteLock,
	resettableLazy,
	resettableLazyAsync,
	Event as AtomicEvent
} from '../dist/atomic.mjs';

describe('atomic.once', () => {
	it('invokes the wrapped function only once', () => {
		let calls = 0;
		const fn = once((value: number) => {
			calls++;
			return value * 2;
		});

		expect(fn(2)).toBe(4);
		expect(fn(999)).toBe(4);
		expect(calls).toBe(1);
	});

	it('retries if the first invocation throws', () => {
		let calls = 0;
		const fn = once(() => {
			calls++;
			if (calls === 1) {
				throw new Error('boom');
			}
			return 'ok';
		});

		expect(() => fn()).toThrow('boom');
		expect(fn()).toBe('ok');
		expect(calls).toBe(2);
	});
});

describe('atomic.lazy', () => {
	it('initializes value only once', () => {
		let calls = 0;
		const getValue = lazy(() => {
			calls++;
			return { id: calls };
		});

		const first = getValue();
		const second = getValue();

		expect(second).toBe(first);
		expect(calls).toBe(1);
	});
});

describe('atomic.lazyAsync', () => {
	it('initializes promise only once', async () => {
		let calls = 0;
		const getValue = lazyAsync(async () => {
			calls++;
			return { id: calls };
		});

		const first = getValue();
		const second = getValue();

		expect(second).toBe(first);
		await expect(first).resolves.toEqual({ id: 1 });
		expect(calls).toBe(1);
	});
});

describe('atomic.resettableLazy', () => {
	it('resets cached value when requested', () => {
		let calls = 0;
		const holder = resettableLazy(() => {
			calls++;
			return { id: calls };
		});

		const first = holder.get();
		const second = holder.get();
		holder.reset();
		const third = holder.get();

		expect(second).toBe(first);
		expect(third).not.toBe(first);
		expect(calls).toBe(2);
	});
});

describe('atomic.resettableLazyAsync', () => {
	it('initializes promise only once until reset', async () => {
		let calls = 0;
		const holder = resettableLazyAsync(async () => {
			calls++;
			return { id: calls };
		});

		const first = holder.get();
		const second = holder.get();

		expect(second).toBe(first);
		await expect(first).resolves.toEqual({ id: 1 });
		expect(calls).toBe(1);

		holder.reset();
		await expect(holder.get()).resolves.toEqual({ id: 2 });
		expect(calls).toBe(2);
	});

	it('evicts rejected promise so later calls can retry', async () => {
		let calls = 0;
		const holder = resettableLazyAsync(async () => {
			calls++;
			if (calls === 1) {
				throw new Error('boom');
			}
			return 'ok';
		});

		await expect(holder.get()).rejects.toThrow('boom');
		await expect(holder.get()).resolves.toBe('ok');
		expect(calls).toBe(2);
	});
});

describe('atomic.Mutex', () => {
	it('acquires immediately when unlocked', async () => {
		const mutex = new Mutex();
		const lease = await mutex.acquire();

		expect(mutex.locked).toBe(true);
		expect(mutex.pending).toBe(0);
		expect(lease.released).toBe(false);

		lease.release();

		expect(lease.released).toBe(true);
		expect(mutex.locked).toBe(false);
	});

	it('grants access in FIFO order', async () => {
		const mutex = new Mutex();
		const order: number[] = [];

		const first = await mutex.acquire();
		const secondPromise = mutex.acquire().then(async (lease) => {
			order.push(2);
			await lease[Symbol.asyncDispose]();
		});
		const thirdPromise = mutex.acquire().then(async (lease) => {
			order.push(3);
			await lease[Symbol.asyncDispose]();
		});

		expect(mutex.pending).toBe(2);

		order.push(1);
		await first[Symbol.asyncDispose]();
		await secondPromise;
		await thirdPromise;

		expect(order).toEqual([1, 2, 3]);
		expect(mutex.locked).toBe(false);
		expect(mutex.pending).toBe(0);
	});

	it('supports await using with an acquired lease', async () => {
		const mutex = new Mutex();

		{
			await using lease = await mutex.acquire();
			expect(lease.released).toBe(false);
			expect(mutex.locked).toBe(true);
		}

		expect(mutex.locked).toBe(false);
	});

	it('runExclusive serializes concurrent tasks', async () => {
		const mutex = new Mutex();
		const events: string[] = [];

		await Promise.all([
			mutex.runExclusive(async () => {
				events.push('a:start');
				await Promise.resolve();
				events.push('a:end');
			}),
			mutex.runExclusive(async () => {
				events.push('b:start');
				events.push('b:end');
			})
		]);

		expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
		expect(mutex.locked).toBe(false);
	});

	it('release is idempotent when called manually and via async dispose', async () => {
		const mutex = new Mutex();
		const first = await mutex.acquire();
		const secondPromise = mutex.acquire();

		first.release();
		first.release();
		await first[Symbol.asyncDispose]();

		const second = await secondPromise;
		expect(second.released).toBe(false);
		expect(mutex.locked).toBe(true);

		await second[Symbol.asyncDispose]();
		expect(mutex.locked).toBe(false);
	});

	it('lock remains available as an alias for acquire', async () => {
		const mutex = new Mutex();
		const lease = await mutex.lock();

		expect(mutex.locked).toBe(true);
		await lease[Symbol.asyncDispose]();
		expect(mutex.locked).toBe(false);
	});
});

describe('atomic.deferred', () => {
	it('settles externally and ignores later settlements', async () => {
		const d = deferred<number>();

		d.resolve(1);
		d.resolve(2);

		await expect(d.promise).resolves.toBe(1);
		expect(d.settled).toBe(true);
	});
});

describe('atomic.Latch', () => {
	it('waits until opened and then stays open', async () => {
		const latch = new Latch();
		let opened = false;

		const waiting = latch.wait().then(() => {
			opened = true;
		});

		expect(latch.isOpen).toBe(false);
		latch.open();

		await waiting;
		expect(opened).toBe(true);
		expect(latch.isOpen).toBe(true);
		await expect(latch.wait()).resolves.toBeUndefined();
	});
});

describe('atomic.AsyncEvent', () => {
	it('releases waiters when set and blocks again after reset', async () => {
		const event = new AsyncEvent();
		let released = 0;

		const first = event.wait().then(() => {
			released++;
		});

		event.set();
		await first;
		expect(released).toBe(1);

		event.reset();
		const second = event.wait().then(() => {
			released++;
		});

		await Promise.resolve();
		expect(released).toBe(1);

		event.set();
		await second;
		expect(released).toBe(2);
	});

	it('Event alias behaves like AsyncEvent', async () => {
		const event = new AtomicEvent();
		let released = false;

		const waiting = event.wait().then(() => {
			released = true;
		});

		event.set();
		await waiting;

		expect(released).toBe(true);
		expect(event.isSet).toBe(true);
	});
});

describe('atomic.Barrier', () => {
	it('releases a full group and resets for the next cycle', async () => {
		const barrier = new Barrier(2);
		const events: string[] = [];

		const firstCycleA = barrier.wait().then(() => events.push('a1'));
		const firstCycleB = barrier.wait().then(() => events.push('b1'));

		await Promise.all([firstCycleA, firstCycleB]);

		const secondCycleA = barrier.wait().then(() => events.push('a2'));
		const secondCycleB = barrier.wait().then(() => events.push('b2'));

		await Promise.all([secondCycleA, secondCycleB]);

		expect(events).toEqual(['b1', 'a1', 'b2', 'a2']);
		expect(barrier.waiting).toBe(0);
	});
});

describe('atomic.Semaphore', () => {
	it('limits concurrency to the configured capacity', async () => {
		const semaphore = new Semaphore(2);
		const running = new AtomicValue(0);
		const peak = new AtomicValue(0);

		await Promise.all(
			Array.from({ length: 4 }, () =>
				semaphore.runExclusive(async () => {
					const next = running.update((value) => value + 1);
					peak.update((value) => Math.max(value, next));
					await Promise.resolve();
					await Promise.resolve();
					running.update((value) => value - 1);
				})
			)
		);

		expect(peak.value).toBe(2);
		expect(semaphore.available).toBe(2);
		expect(semaphore.pending).toBe(0);
	});
});

describe('atomic.ReadWriteLock', () => {
	it('allows multiple readers before a queued writer and then grants the writer', async () => {
		const lock = new ReadWriteLock();
		const order: string[] = [];

		const firstRead = await lock.acquireRead();
		const secondRead = await lock.acquireRead();
		const writer = lock.acquireWrite().then(async (lease) => {
			order.push(lease.kind);
			await lease[Symbol.asyncDispose]();
		});

		expect(lock.readers).toBe(2);
		expect(lock.writer).toBe(false);
		expect(lock.pending).toBe(1);

		await firstRead[Symbol.asyncDispose]();
		expect(lock.writer).toBe(false);
		await secondRead[Symbol.asyncDispose]();
		await writer;

		expect(order).toEqual(['write']);
		expect(lock.readers).toBe(0);
		expect(lock.writer).toBe(false);
	});

	it('runRead allows concurrent readers while runWrite remains exclusive', async () => {
		const lock = new ReadWriteLock();
		const activeReaders = new AtomicValue(0);
		const peakReaders = new AtomicValue(0);

		await Promise.all([
			lock.runRead(async () => {
				const count = activeReaders.update((value) => value + 1);
				peakReaders.update((value) => Math.max(value, count));
				await Promise.resolve();
				activeReaders.update((value) => value - 1);
			}),
			lock.runRead(async () => {
				const count = activeReaders.update((value) => value + 1);
				peakReaders.update((value) => Math.max(value, count));
				await Promise.resolve();
				activeReaders.update((value) => value - 1);
			})
		]);

		expect(peakReaders.value).toBe(2);
	});
});

describe('atomic.singleFlight', () => {
	it('deduplicates concurrent calls by key and clears in-flight state afterwards', async () => {
		let calls = 0;
		const load = singleFlight(async (key: string) => {
			calls++;
			await Promise.resolve();
			return `value:${key}`;
		}, (key) => key);

		const [a, b] = await Promise.all([load('x'), load('x')]);
		const c = await load('x');

		expect(a).toBe('value:x');
		expect(b).toBe('value:x');
		expect(c).toBe('value:x');
		expect(calls).toBe(2);
		expect(load.pending).toBe(0);
	});
});

describe('atomic.onceAsync', () => {
	it('reuses the successful promise and retries after rejection', async () => {
		let calls = 0;
		const init = onceAsync(async () => {
			calls++;
			if (calls === 1) {
				throw new Error('boom');
			}
			return 'ok';
		});

		await expect(init()).rejects.toThrow('boom');
		const [a, b] = await Promise.all([init(), init()]);

		expect(a).toBe('ok');
		expect(b).toBe('ok');
		expect(calls).toBe(2);
	});
});

describe('atomic.memoizeAsync', () => {
	it('caches successful results and evicts rejected results', async () => {
		let calls = 0;
		const load = memoizeAsync(async (key: string) => {
			calls++;
			if (key === 'bad' && calls === 1) {
				throw new Error('boom');
			}
			return `value:${key}:${calls}`;
		}, (key) => key);

		await expect(load('bad')).rejects.toThrow('boom');
		await expect(load('bad')).resolves.toBe('value:bad:2');
		await expect(load('bad')).resolves.toBe('value:bad:2');
		expect(load.size).toBe(1);
		expect(calls).toBe(2);
	});
});

describe('atomic.AtomicValue and helpers', () => {
	it('supports compare-and-set, swap, and update', () => {
		const value = new AtomicValue(1);

		expect(value.compareAndSet(2, 3)).toBe(false);
		expect(value.compareAndSet(1, 2)).toBe(true);
		expect(value.value).toBe(2);
		expect(value.swap(4)).toBe(2);
		expect(value.update((current) => current + 1)).toBe(5);
		expect(value.value).toBe(5);
	});

	it('top-level compareAndSet and swap work with boxed values', () => {
		const box = { value: 'a' };

		expect(compareAndSet(box, 'b', 'c')).toBe(false);
		expect(compareAndSet(box, 'a', 'b')).toBe(true);
		expect(swap(box, 'c')).toBe('b');
		expect(box.value).toBe('c');
	});
});

describe('legacy module aliases', () => {
	it('functional.once still works and warns', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { once: legacyOnce } = await import('../dist/functional.mjs');

		const fn = legacyOnce(() => 123);
		expect(fn()).toBe(123);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('functional#once is deprecated'));
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Use atomic#once instead.'));

		warnSpy.mockRestore();
	});

	it('lazy and state aliases still work and warn', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { lazy: legacyLazy } = await import('../dist/lazy.mjs');
		const { resettableLazy: legacyResettableLazy } = await import('../dist/state.mjs');

		expect(legacyLazy(() => 1)()).toBe(1);
		expect(legacyResettableLazy(() => 2).get()).toBe(2);
		const messages = warnSpy.mock.calls.map(([message]) => String(message));

		expect(messages).toContainEqual(expect.stringContaining('lazy#lazy is deprecated'));
		expect(messages).toContainEqual(expect.stringContaining('Use atomic#lazy instead.'));
		expect(messages).toContainEqual(expect.stringContaining('state#resettableLazy is deprecated'));
		expect(messages).toContainEqual(expect.stringContaining('Use atomic#resettableLazy instead.'));

		warnSpy.mockRestore();
	});
});
