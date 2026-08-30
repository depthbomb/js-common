import { performance } from 'node:perf_hooks';
import { Channel } from '../dist/channel.mjs';
import { LRUCache } from '../dist/cache.mjs';
import { CircuitBreaker } from '../dist/circuit-breaker.mjs';
import { Mutex, ReadWriteLock, Semaphore } from '../dist/atomic.mjs';
import { Queue, Stack } from '../dist/collections.mjs';
import { DateUnit, date } from '../dist/date.mjs';
import { Emitter } from '../dist/emitter.mjs';
import { pipe } from '../dist/functional.mjs';
import { hasShape, isInteger, isString } from '../dist/guards.mjs';
import { range, windowed } from '../dist/iterable.mjs';
import { average, sum } from '../dist/number.mjs';
import { allSettledSuccessful, pMap } from '../dist/promise.mjs';
import { pickRandom, shuffle } from '../dist/random.mjs';
import { RateLimiter } from '../dist/rate-limiter.mjs';
import { ResourcePool } from '../dist/resource-pool.mjs';
import { mapOk, ok, unwrap } from '../dist/result.mjs';
import { formatDuration, parseDuration } from '../dist/timing.mjs';
import { URLPath } from '../dist/url.mjs';

const scale = Number.parseInt(process.env.BENCH_SCALE ?? '50000', 10);
const rounds = Number.parseInt(process.env.BENCH_ROUNDS ?? '7', 10);
const warmups = Number.parseInt(process.env.BENCH_WARMUPS ?? '2', 10);
const filter = process.env.BENCH_FILTER;
const cacheSize = Math.max(1, Math.floor(scale / 2));
const numericValues = [...range(scale)];
const increment = value => value + 1;
const double = value => value * 2;
const userShape = { id: isInteger, name: isString };

if (![scale, rounds, warmups].every(Number.isInteger) || scale < 1 || rounds < 1 || warmups < 0) {
	throw new Error('BENCH_SCALE and BENCH_ROUNDS must be positive integers; BENCH_WARMUPS must be non-negative');
}

const benchmarks = [
	{
		name: 'atomic: mutex contention',
		operations: scale,
		async run() {
			const mutex = new Mutex();
			const first = await mutex.acquire();
			let checksum = 0;
			const queued = Array.from({ length: scale }, (_, value) => mutex.runExclusive(() => {
				checksum += value;
			}));

			assertEqual(mutex.pending, scale);
			await first.release();
			await Promise.all(queued);
			assertEqual(checksum, scale * (scale - 1) / 2);
		}
	},
	{
		name: 'atomic: semaphore contention',
		operations: scale,
		async run() {
			const semaphore = new Semaphore(1);
			const first = await semaphore.acquire();
			let checksum = 0;
			const queued = Array.from({ length: scale }, (_, value) => semaphore.runExclusive(() => {
				checksum += value;
			}));

			assertEqual(semaphore.pending, scale);
			await first.release();
			await Promise.all(queued);
			assertEqual(checksum, scale * (scale - 1) / 2);
		}
	},
	{
		name: 'atomic: write lock contention',
		operations: scale,
		async run() {
			const lock = new ReadWriteLock();
			const first = await lock.acquireWrite();
			let checksum = 0;
			const queued = Array.from({ length: scale }, (_, value) => lock.runWrite(() => {
				checksum += value;
			}));

			assertEqual(lock.pending, scale);
			await first.release();
			await Promise.all(queued);
			assertEqual(checksum, scale * (scale - 1) / 2);
		}
	},
	{
		name: 'channel: buffered send/receive',
		operations: scale * 2,
		async run() {
			const channel = new Channel();

			for (let value = 0; value < scale; value++) {
				await channel.send(value);
			}

			let checksum = 0;

			for (let index = 0; index < scale; index++) {
				checksum += (await channel.receive()).value;
			}

			assertEqual(checksum, scale * (scale - 1) / 2);
		}
	},
	{
		name: 'collections: queue round trip',
		operations: scale * 2,
		run() {
			const queue = new Queue();

			for (let value = 0; value < scale; value++) {
				queue.enqueue(value);
			}

			let checksum = 0;

			while (!queue.isEmpty) {
				checksum += queue.dequeue();
			}

			assertEqual(checksum, scale * (scale - 1) / 2);
		}
	},
	{
		name: 'collections: stack iteration',
		operations: scale * 2,
		run() {
			const stack = new Stack(numericValues);
			let checksum = 0;

			for (const value of stack) {
				checksum += value;
			}

			assertEqual(checksum, scale * (scale - 1) / 2);
		}
	},
	{
		name: 'date: chained UTC operations',
		operations: scale,
		run() {
			let checksum = 0;

			for (let value = 0; value < scale; value++) {
				checksum += date(1_700_000_000_000 + value)
					.add({ months: 1, days: 2 })
					.startOf(DateUnit.Day)
					.getUTCFullYear();
			}

			assertEqual(checksum > 0, true);
		}
	},
	{
		name: 'functional: pipe composition',
		operations: scale,
		run() {
			let checksum = 0;

			for (let value = 0; value < scale; value++) {
				checksum += pipe(value, increment, double);
			}

			assertEqual(checksum, scale ** 2 + scale);
		}
	},
	{
		name: 'guards: object shape checks',
		operations: scale,
		run() {
			let matches = 0;

			for (let value = 0; value < scale; value++) {
				if (hasShape({ id: value, name: 'user' }, userShape)) {
					matches++;
				}
			}

			assertEqual(matches, scale);
		}
	},
	{
		name: 'channel: waiting receivers',
		operations: scale * 2,
		async run() {
			const channel = new Channel();
			const receivers = Array.from({ length: scale }, () => channel.receive());

			for (let value = 0; value < scale; value++) {
				await channel.send(value);
			}

			const results = await Promise.all(receivers);
			assertEqual(results.at(-1)?.value, scale - 1);
		}
	},
	{
		name: 'cache: mixed LRU workload',
		operations: scale + cacheSize * 3,
		run() {
			const cache = new LRUCache({ maxSize: cacheSize });

			for (let key = 0; key < scale; key++) {
				cache.set(key, key);
			}

			let checksum = 0;

			for (let key = scale - cacheSize; key < scale; key++) {
				checksum += cache.get(key);
				cache.has(key);
				cache.set(key, key + 1);
			}

			assertEqual(cache.size, cacheSize);
			assertEqual(checksum > 0, true);
		}
	},
	{
		name: 'circuit breaker: successful calls',
		operations: scale,
		async run() {
			const breaker = new CircuitBreaker();
			let checksum = 0;

			for (let value = 0; value < scale; value++) {
				checksum += await breaker.execute(() => value);
			}

			assertEqual(checksum, scale * (scale - 1) / 2);
		}
	},
	{
		name: 'rate limiter: available tokens',
		operations: scale,
		async run() {
			using limiter = new RateLimiter({ limit: scale, intervalMs: 60_000, burst: scale });

			for (let index = 0; index < scale; index++) {
				await limiter.acquire();
			}

			assertEqual(limiter.pending, 0);
		}
	},
	{
		name: 'rate limiter: queued release',
		operations: scale * 2,
		async run() {
			using limiter = new RateLimiter({ limit: 1, intervalMs: 60_000, burst: scale });

			for (let index = 0; index < scale; index++) {
				await limiter.acquire();
			}

			const queued = Array.from({ length: scale }, () => limiter.acquire());
			assertEqual(limiter.pending, scale);
			limiter.reset();
			await Promise.all(queued);
			assertEqual(limiter.pending, 0);
		}
	},
	{
		name: 'iterable: sliding windows',
		operations: scale,
		run() {
			let count = 0;
			let checksum = 0;

			for (const values of windowed(range(scale), 256)) {
				count++;
				checksum += values[0];
			}

			assertEqual(count, Math.max(0, scale - 255));
			assertEqual(checksum > 0, true);
		}
	},
	{
		name: 'number: sum and average',
		operations: scale * 2,
		run() {
			assertEqual(sum(numericValues), scale * (scale - 1) / 2);
			assertEqual(average(numericValues), (scale - 1) / 2);
		}
	},
	{
		name: 'promise: settled success filtering',
		operations: scale,
		async run() {
			const values = await allSettledSuccessful(numericValues);

			assertEqual(values.length, scale);
			assertEqual(values.at(-1), scale - 1);
		}
	},
	{
		name: 'promise: concurrent mapping',
		operations: scale,
		async run() {
			const values = await pMap(numericValues, increment, { concurrency: 64 });

			assertEqual(values.length, scale);
			assertEqual(values.at(-1), scale);
		}
	},
	{
		name: 'random: array selection',
		operations: scale,
		run() {
			let checksum = 0;

			for (let index = 0; index < scale; index++) {
				checksum += pickRandom(numericValues);
			}

			assertEqual(checksum >= 0, true);
		}
	},
	{
		name: 'random: immutable shuffle',
		operations: scale,
		run() {
			const values = shuffle(numericValues);

			assertEqual(values.length, scale);
			assertEqual(numericValues[0], 0);
		}
	},
	{
		name: 'resource pool: sequential reuse',
		operations: scale,
		async run() {
			const pool = new ResourcePool({ maxSize: 1, create: () => ({}), destroy: () => {} });

			for (let index = 0; index < scale; index++) {
				const lease = await pool.acquire();
				await lease.release();
			}

			assertEqual(pool.size, 1);
			await pool.drain();
		}
	},
	{
		name: 'resource pool: contended reuse',
		operations: scale,
		async run() {
			const pool = new ResourcePool({ maxSize: 1, create: () => ({}), destroy: () => {} });
			const first = await pool.acquire();
			const queued = Array.from({ length: scale }, async () => {
				const lease = await pool.acquire();
				await lease.release();
			});

			assertEqual(pool.pending, scale);
			await first.release();
			await Promise.all(queued);
			assertEqual(pool.pending, 0);
			await pool.drain();
		}
	},
	{
		name: 'emitter: single listener',
		operations: scale,
		async run() {
			const emitter = new Emitter();
			let checksum = 0;

			emitter.on('value', value => { checksum += value; });

			for (let value = 0; value < scale; value++) {
				await emitter.emit('value', value);
			}

			assertEqual(checksum, scale * (scale - 1) / 2);
		}
	},
	{
		name: 'result: map and unwrap',
		operations: scale,
		run() {
			let checksum = 0;

			for (let value = 0; value < scale; value++) {
				checksum += unwrap(mapOk(ok(value), increment));
			}

			assertEqual(checksum, scale * (scale + 1) / 2);
		}
	},
	{
		name: 'timing: duration parse and format',
		operations: scale * 2,
		run() {
			let checksum = 0;

			for (let value = 0; value < scale; value++) {
				checksum += parseDuration('2h 30m 15s').milliseconds;
				checksum += formatDuration(9_015_000, { precision: 2 }).length;
			}

			assertEqual(checksum > 0, true);
		}
	},
	{
		name: 'url: immutable path and query chains',
		operations: scale,
		run() {
			let checksum = 0;

			for (let value = 0; value < scale; value++) {
				checksum += new URLPath('https://example.com/api')
					.joinpath('users', String(value))
					.withQuery({ include: ['roles', 'profile'], page: value })
					.withHash('details')
					.toString()
					.length;
			}

			assertEqual(checksum > 0, true);
		}
	}
];

function assertEqual(actual, expected) {
	if (!Object.is(actual, expected)) {
		throw new Error(`benchmark assertion failed: expected ${expected}, received ${actual}`);
	}
}

function median(values) {
	const sorted = values.toSorted((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);

	return sorted.length % 2 === 0
		? (sorted[middle - 1] + sorted[middle]) / 2
		: sorted[middle];
}

async function measure(benchmark) {
	for (let index = 0; index < warmups; index++) {
		await benchmark.run();
	}

	const samples = [];

	for (let index = 0; index < rounds; index++) {
		globalThis.gc?.();

		const startedAt = performance.now();
		await benchmark.run();
		samples.push(performance.now() - startedAt);
	}

	const medianMs = median(samples);

	return {
		name: benchmark.name,
		operations: benchmark.operations,
		medianMs: Number(medianMs.toFixed(3)),
		operationsPerSecond: Math.round(benchmark.operations / medianMs * 1_000),
		samplesMs: samples.map(sample => Number(sample.toFixed(3)))
	};
}

const selected = filter
	? benchmarks.filter(benchmark => benchmark.name.includes(filter))
	: benchmarks;

if (selected.length === 0) {
	throw new Error(`No benchmarks matched BENCH_FILTER=${filter}`);
}

const results = [];

for (const benchmark of selected) {
	const result = await measure(benchmark);
	results.push(result);
	console.log(`${result.name}: ${result.operationsPerSecond.toLocaleString()} ops/s (${result.medianMs} ms median)`);
}

console.log(JSON.stringify({ scale, rounds, warmups, results }, null, 2));
