# @depthbomb/common

A set of common utilities for TypeScript/JavaScript that I use in my projects.

**Looking for utilities for Node.js specifically? See [@depthbomb/node-common](https://www.npmjs.com/package/@depthbomb/node-common)!**

---

## Modules

### `atomic`

Atomic state-transition helpers for one-time execution, lazy initialization, shared mutable cells, and async coordination primitives.

```ts
import {
	AtomicValue,
	AsyncEvent,
	Barrier,
	Latch,
	once,
	onceAsync,
	Mutex,
	ReadWriteLock,
	Semaphore,
	compareAndSet,
	deferred,
	lazy,
	lazyAsync,
	memoizeAsync,
	resettableLazy,
	resettableLazyAsync,
	singleFlight,
	swap
} from '@depthbomb/common/atomic';

const init = once(() => ({ startedAt: Date.now() }));
const a = init();
const b = init();

const getConfig = lazy(() => ({ env: 'prod' }));
const config = getConfig();

const getToken = lazyAsync(async () => 'token');
const token = await getToken();

const counter = resettableLazy(() => Math.random());
counter.get();
counter.reset();

const tokenCache = resettableLazyAsync(async () => 'token');
await tokenCache.get();
tokenCache.reset();

const mutex = new Mutex();
{
	await using lease = await mutex.acquire();
	// protected work
}

await mutex.runExclusive(async () => {
	// protected async work
});

const semaphore = new Semaphore(2);
await semaphore.runExclusive(async () => {
	// up to two concurrent callers
});

const lock = new ReadWriteLock();
await lock.runRead(async () => {});
await lock.runWrite(async () => {});

const gate = new Latch();
setTimeout(() => gate.open(), 100);
await gate.wait();

const event = new AsyncEvent();
setTimeout(() => event.set(), 100);
await event.wait();
event.reset();

const ready = deferred<string>();
setTimeout(() => ready.resolve('ok'), 100);
await ready.promise;

const barrier = new Barrier(2);
await Promise.all([barrier.wait(), barrier.wait()]);

const initAsync = onceAsync(async () => ({ connected: true }));
await initAsync();
await initAsync();

const fetchUser = singleFlight(async (id: string) => {
	const response = await fetch(`/api/users/${id}`);
	return response.json();
}, (id) => id);

const fetchProfile = memoizeAsync(async (id: string) => {
	const response = await fetch(`/api/profiles/${id}`);
	return response.json();
}, (id) => id);

const cell = new AtomicValue(1);
cell.compareAndSet(1, 2);
const previous = cell.swap(3);

const box = { value: 'a' };
compareAndSet(box, 'a', 'b');
swap(box, 'c');
```

### `timing`

Timing and timeout flow-control helpers.

```ts
import {
	timeout,
	rejectionTimeout,
	formatDuration,
	parseDuration,
	pollUntil,
	withTimeout,
	retry,
	abortAfter,
	withAbort,
	raceSignals,
	RetryJitter,
} from '@depthbomb/common/timing';

await timeout(250);
await rejectionTimeout(100).catch(() => {});

let ready = false;
setTimeout(() => { ready = true; }, 200);
await pollUntil(() => ready, 50, 1_000);

const value = await withTimeout(Promise.resolve('ok'), 500);

const data = await retry(
	async (attempt) => {
		const response = await fetch('https://example.com/data');
		if (!response.ok) {
			throw new Error(`request failed on attempt ${attempt}`);
		}
		return response.json();
	},
	{
		attempts: 4,
		baseMs: 100,
		maxMs: 1_000,
		jitter: RetryJitter.Full,
	}
);

const signal = abortAfter(1_000);
await withAbort(fetch('https://example.com/slow'), signal);

const parent = new AbortController();
const child = abortAfter(500);
const combined = raceSignals(parent.signal, child);

const duration = parseDuration('2 hours, plus 30m, ignored text, and another 15 seconds');

duration.milliseconds; // fixed conversion: 9_015_000
duration.toHumanString({ precision: 2 }); // "2 hours 30 minutes"
duration.fromNow(); // Date relative to now
duration.from(new Date('2026-04-08T12:00:00.000Z')); // 2026-04-08T14:30:15.000Z

const oneMonth = parseDuration('1mo');
oneMonth.toMilliseconds(); // fixed conversion: 30 days
oneMonth.toMilliseconds(new Date('2024-01-31T00:00:00.000Z')); // anchored conversion: 29 days

formatDuration(1_000); // "1 second"
formatDuration(9_015_000, { precision: 2 }); // "2 hours 30 minutes"
formatDuration(2 * 365 * 24 * 60 * 60 * 1_000, {
	labels: {
		years: { singular: 'año', plural: 'años' }
	}
}); // "2 años"
```

### `promise`

Promise composition helpers, including detailed settled results and concurrency-limited execution.

```ts
import { allSettledSuccessful, allSettledDetailed, sequential, pool, pMap } from '@depthbomb/common/promise';

const successful = await allSettledSuccessful([
	Promise.resolve(1),
	Promise.reject(new Error('x')),
	Promise.resolve(2)
]); // [1, 2]

const ordered = await sequential([
	async () => 'first',
	async () => 'second'
]); // ['first', 'second']

const detailed = await allSettledDetailed([
	Promise.resolve('ok'),
	Promise.reject(new Error('x')),
]); // { results, fulfilled: ['ok'], rejected: [Error('x')] }

const pooled = await pool([
	async () => 1,
	async () => 2,
	async () => 3,
], { concurrency: 2 });

const mapped = await pMap([1, 2, 3], async (v) => v * 10, { concurrency: 2 });
```

### `decorators`

TypeScript decorators for reusable behavior. Currently includes a TTL-based `cache` decorator for memoizing method results per instance and argument set.

```ts
import { cache } from '@depthbomb/common/decorators';

class Service {
	calls = 0;

	@cache(1_000)
	getUser(id: string) {
		this.calls++;
		return { id, calls: this.calls };
	}
}

const s = new Service();
s.getUser('1');
s.getUser('1'); // cached for 1 second
```

### `state`

State primitives: `ResettableValue` and `Flag`.

`resettableLazy` and `resettableLazyAsync` remain available here as legacy exports, but new code should import them from `atomic`.

```ts
import { Flag, ResettableValue } from '@depthbomb/common/state';
import { resettableLazy, resettableLazyAsync } from '@depthbomb/common/atomic';

const flag = new Flag();
flag.setTrue();
flag.toggle();
flag.reset();

const retries = new ResettableValue(3);
retries.set(1);
retries.reset(); // back to 3

const counter = resettableLazy(() => Math.random());
const first = counter.get();
counter.reset();
const second = counter.get(); // recomputed

const tokenCache = resettableLazyAsync(async () => {
	const response = await fetch('https://example.com/token');
	return response.text();
});
const token = await tokenCache.get();
tokenCache.reset();
```

### `functional`

General function utilities such as `pipe` and `deprecate`.

`once` remains available here as a legacy export, but new code should import it from `atomic`.

```ts
import { once } from '@depthbomb/common/atomic';

const init = once(() => ({ startedAt: Date.now() }));

const a = init();
const b = init();
console.log(a === b); // true
```

### `lazy`

Legacy lazy initialization entrypoint.

`lazy` and `lazyAsync` remain available here as legacy exports, but new code should import them from `atomic`.

```ts
import { lazy, lazyAsync } from '@depthbomb/common/atomic';

const getConfig = lazy(() => ({ env: 'prod' }));
const config = getConfig(); // factory runs once

const getToken = lazyAsync(async () => 'token');
const token = await getToken(); // promise created once
```

### `collections`

A lightweight generic FIFO queue with `enqueue`, `dequeue`, `peek`, iteration support, and internal compaction to keep long-running usage efficient. Also includes `BoundedQueue` for fixed-capacity use cases.

```ts
import { Queue, BoundedQueue, BoundedQueueOverflow } from '@depthbomb/common/collections';

const q = new Queue<number>([1, 2]);
q.enqueue(3);

console.log(q.peek());    // 1
console.log(q.dequeue()); // 1
console.log(q.toArray()); // [2, 3]

const bounded = new BoundedQueue<number>({ maxSize: 3, overflow: BoundedQueueOverflow.DropOldest }, [1, 2, 3]);
bounded.enqueue(4);
console.log(bounded.toArray()); // [2, 3, 4]
```

### `number`

Numeric helpers for clamping, range checks, rounding, and aggregation.

```ts
import { clamp, inRange, roundTo, sum, average } from '@depthbomb/common/number';

const bounded = clamp(12, 0, 10); // 10
const valid = inRange(5, 1, 10); // true
const rounded = roundTo(3.14159, 2); // 3.14
const total = sum([1, 2, 3, 4]); // 10
const mean = average([1, 2, 3, 4]); // 2.5
```

### `random`

Cross-environment random helpers for ranges and selection.

```ts
import { randomFloat, randomInt, pickRandom, pickWeighted } from '@depthbomb/common/random';

const f = randomFloat(5, 10); // 5 <= f < 10
const i = randomInt(1, 6); // inclusive
const choice = pickRandom(['red', 'green', 'blue']);
const weighted = pickWeighted([
	{ value: 'small', weight: 1 },
	{ value: 'medium', weight: 3 },
	{ value: 'large', weight: 6 },
]);
```

### `guards`

Runtime type guards for common narrowing patterns.

```ts
import {
	has,
	isArrayOf,
	isDateLike,
	isNonEmptyString,
	isNumber,
	isOneOf,
	isString
} from '@depthbomb/common/guards';

const input: unknown = {
	name: 'Ada',
	createdAt: '2026-01-01',
	roles: ['admin', 'editor'],
	status: 'active'
};

if (has.shape<{
	name: string;
	createdAt: string;
	roles: string[];
	status: 'active' | 'disabled';
}>(input, {
	name: isNonEmptyString,
	createdAt: isDateLike,
	roles: (value): value is string[] => isArrayOf(value, isString),
	status: (value): value is 'active' | 'disabled' => isOneOf(value, ['active', 'disabled'] as const)
})) {
	console.log(input.roles.join(', '));
}

const maybeCount: unknown = 42;
if (isNumber(maybeCount)) {
	console.log(maybeCount + 1);
}
```

### `typing`

Shared type aliases and type-oriented helpers such as `Awaitable`, `Maybe`, `Nullable`, `ValueOf`, `NonEmptyArray`, `Brand`, `OptionalKeys`, `RequiredKeys`, JSON-related types, `cast`, `assume`, and `typedEntries`.

Result helpers live in the `result` module. The legacy `typing` re-exports for `ok`, `err`, `isOk`, `mapOk`, `mapErr`, `tryCatch`, and `tryCatchAsync` are deprecated and scheduled for removal in `3.0.0`.

```ts
import {
	cast, assume, typedEntries,
	type Awaitable, type Brand, type JsonValue, type Maybe, type NonEmptyArray,
	type Nullable, type OptionalKeys, type RequiredKeys, type ValueOf
} from '@depthbomb/common/typing';
import {
	ok, err, isOk, mapOk, mapErr, tryCatchAsync,
	type Result
} from '@depthbomb/common/result';

const v = cast<object, { id: string }>({ id: 'a' });

const unknownValue: unknown = 'hello';
assume<string>(unknownValue); // assertion helper

const entries = typedEntries({ a: 1, b: 2 }); // typed key/value tuples

const maybeName: Maybe<string> = undefined;
const task: Awaitable<number> = Promise.resolve(1);
type Status = ValueOf<{ ready: 'ready'; done: 'done' }>;
type Tags = NonEmptyArray<string>;
type UserId = Brand<string, 'UserId'>;
type OptionalUserKeys = OptionalKeys<{ id: string; name?: string }>;
type RequiredUserKeys = RequiredKeys<{ id: string; name?: string }>;
const payload: JsonValue = { tags: ['a', 'b'], active: true };

const initial: Result<number, string> = ok(2);
const doubled = mapOk(initial, (value) => value * 2);
const message = mapErr(err('bad'), (e) => `error: ${e}`);

const parsed = await tryCatchAsync(async () => JSON.parse('{"x":1}'));
if (isOk(parsed)) {
	console.log(parsed.value.x);
}
```

### `url`

URL-focused utilities centered around `URLPath`, an ergonomic wrapper for URL parsing, path composition, query/hash manipulation, and request dispatch via `fetch`.

```ts
import { URLPath, url } from '@depthbomb/common/url';

const api = new URLPath('https://example.com/api');
const usersUrl = api
	.joinpath('users', '42')
	.withQuery({ include: ['roles', 'profile'] })
	.withQueryPatch({ page: 1 })
	.appendQuery({ include: 'permissions' })
	.withoutEmptyQuery()
	.withHash('details');

const userPath = url`/users/${'john/doe'}/posts/${'my first post'}`;

console.log(usersUrl.toString());
// https://example.com/api/users/42?include=roles&include=profile#details
console.log(userPath);
// /users/john%2Fdoe/posts/my%20first%20post
```
