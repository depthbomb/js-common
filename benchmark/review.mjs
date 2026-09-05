import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const dist = process.env.BENCH_DIST
	? pathToFileURL(resolve(process.env.BENCH_DIST) + '/')
	: new URL('../dist/', import.meta.url);
const { LRUCache }     = await import(new URL('cache.mjs', dist));
const { ResourcePool } = await import(new URL('resource-pool.mjs', dist));
const selected        = process.env.BENCH_CASE;
const results         = [];
let checksum          = 0;

async function measure(name, run, rounds = 7) {
	for (let index = 0; index < 3; index++) {
		await run();
	}

	const samplesMs = [];

	for (let index = 0; index < rounds; index++) {
		globalThis.gc?.();
		const start = performance.now();
		await run();
		samplesMs.push(performance.now() - start);
	}

	const sorted = samplesMs.toSorted((left, right) => left - right);
	results.push({
		name,
		medianMs: sorted[Math.floor(sorted.length / 2)],
		samplesMs
	});
}

if (!selected || selected === 'cache-churn') {
	for (const scale of [40_000, 80_000]) {
		await measure(`cache churn ${scale}`, () => {
			const capacity = scale / 2;
			const cache = new LRUCache({
				maxSize: capacity
			});

			for (let key = 0; key < scale; key++) {
				cache.set(key, key);
			}

			let total = 0;

			for (let key = scale - capacity; key < scale; key++) {
				total += cache.get(key);
				cache.has(key);
				cache.set(key, key + 1);
			}

			assert.equal(total, (scale - capacity + scale - 1) * capacity / 2);
			assert.equal(cache.size, capacity);
			checksum += total;
		});
	}
}

if (!selected || selected === 'cache-size') {
	for (const size of [10_000, 50_000]) {
		for (const ttlMs of [Infinity, 60_000]) {
			const cache = new LRUCache({
				maxSize: size,
				ttlMs
			});

			for (let key = 0; key < size; key++) {
				cache.set(key, key);
			}

			await measure(`1000 size reads ${size}, ttl=${ttlMs}`, () => {
				let total = 0;

				for (let index = 0; index < 1000; index++) {
					total += cache.size;
				}

				assert.equal(total, size * 1000);
				checksum += total;
			});
		}
	}
}

if (!selected || selected === 'pool-startup') {
	for (const size of [1, 8]) {
		let maximumCreating = 0;
		await measure(`pool cold acquisition ${size}`, async () => {
			let creating = 0;
			let created  = 0;
			const pool = new ResourcePool({
				maxSize: size,
				create: async () => {
					creating++;
					maximumCreating = Math.max(maximumCreating, creating);
					await delay(20);
					creating--;

					return ++created;
				},
				destroy() {}
			});
			const leases = await Promise.all(Array.from({
				length: size
			}, () => pool.acquire()));
			assert.equal(new Set(leases.map(lease => lease.value)).size, size);
			assert.equal(pool.active, size);
			await Promise.all(leases.map(lease => lease.release()));
			await pool.drain();
			checksum += created;
		}, 5);
		results.at(-1).maximumCreating = maximumCreating;
	}
}

assert.ok(results.length > 0, 'No matching BENCH_CASE');
assert.ok(checksum > 0);
console.log(JSON.stringify({
	node:     process.version,
	platform: process.platform,
	warmups:  3,
	results
}, null, 2));
