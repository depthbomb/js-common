# @depthbomb/common

A set of common utilities for TypeScript/JavaScript that I use in my projects.

**Looking for utilities for Node.js specifically? See [@depthbomb/node-common](https://www.npmjs.com/package/@depthbomb/node-common)!**

---

## Modules

### `timing`

Timing and timeout flow-control helpers.

```ts
import {
	timeout,
	rejectionTimeout,
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

State primitives: `ResettableValue`, `Flag`, `resettableLazy`, and `resettableLazyAsync`.

```ts
import { Flag, ResettableValue, resettableLazy, resettableLazyAsync } from '@depthbomb/common/state';

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

General function utilities. Currently includes `once`, which ensures a function runs only on its first invocation and then reuses the same result.

```ts
import { once } from '@depthbomb/common/functional';

const init = once(() => ({ startedAt: Date.now() }));

const a = init();
const b = init();
console.log(a === b); // true
```

### `lazy`

Lazy initialization utilities for sync and async values.

```ts
import { lazy, lazyAsync } from '@depthbomb/common/lazy';

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

### `typing`

Shared type aliases and type-oriented helpers such as `Awaitable`, `Maybe`, `Nullable`, `Result`, `cast`, `assume`, `typedEntries`, `ok`, `err`, `isOk`, `mapOk`, `mapErr`, and `tryCatchAsync`.

```ts
import {
	cast, assume, typedEntries,
	ok, err, isOk, mapOk, mapErr, tryCatchAsync,
	type Awaitable, type Maybe, type Result
} from '@depthbomb/common/typing';

const v = cast<object, { id: string }>({ id: 'a' });

const unknownValue: unknown = 'hello';
assume<string>(unknownValue); // assertion helper

const entries = typedEntries({ a: 1, b: 2 }); // typed key/value tuples

const maybeName: Maybe<string> = undefined;
const task: Awaitable<number> = Promise.resolve(1);

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
import { URLPath } from '@depthbomb/common/url';

const api = new URLPath('https://example.com/api');
const usersUrl = api
	.joinpath('users', '42')
	.withQuery({ include: ['roles', 'profile'] })
	.withHash('details');

console.log(usersUrl.toString());
// https://example.com/api/users/42?include=roles&include=profile#details
```
