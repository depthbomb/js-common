# @depthbomb/common

A set of common utilities for TypeScript/JavaScript that I use in my projects.

**Looking for utilities for Node.js specifically? See [@depthbomb/node-common](https://www.npmjs.com/package/@depthbomb/node-common)!**

---

## Modules

### `async`

Async helpers for common flow-control patterns, including delay utilities, polling, timeout wrapping, settled-result filtering, and sequential task execution.

```ts
import {
	timeout,
	rejectionTimeout,
	pollUntil,
	withTimeout,
	allSettledSuccessful,
	sequential
} from '@depthbomb/common/async';

await timeout(250);
await rejectionTimeout(100).catch(() => {});

let ready = false;
setTimeout(() => { ready = true; }, 200);
await pollUntil(() => ready, 50, 1_000);

const value = await withTimeout(Promise.resolve('ok'), 500);

const successful = await allSettledSuccessful([
	Promise.resolve(1),
	Promise.reject(new Error('x')),
	Promise.resolve(2)
]); // [1, 2]

const ordered = await sequential([
	async () => 'first',
	async () => 'second'
]); // ['first', 'second']
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

### `flag`

A small resettable boolean utility built on `ResettableValue`, with convenience helpers like `isTrue`, `isFalse`, `setTrue`, `setFalse`, and `toggle`.

```ts
import { Flag } from '@depthbomb/common/flag';

const flag = new Flag();
flag.setTrue();
flag.toggle();
flag.reset();
```

### `fn`

General function utilities. Currently includes `once`, which ensures a function runs only on its first invocation and then reuses the same result.

```ts
import { once } from '@depthbomb/common/fn';

const init = once(() => ({ startedAt: Date.now() }));

const a = init();
const b = init();
console.log(a === b); // true
```

### `lazy`

Lazy initialization utilities for sync and async values, plus a resettable variant for explicit cache invalidation.

```ts
import { lazy, lazyAsync, resettableLazy } from '@depthbomb/common/lazy';

const getConfig = lazy(() => ({ env: 'prod' }));
const config = getConfig(); // factory runs once

const getToken = lazyAsync(async () => 'token');
const token = await getToken(); // promise created once

const counter = resettableLazy(() => Math.random());
const first = counter.get();
counter.reset();
const second = counter.get(); // recomputed
```

### `queue`

A lightweight generic FIFO queue with `enqueue`, `dequeue`, `peek`, iteration support, and internal compaction to keep long-running usage efficient.

```ts
import { Queue } from '@depthbomb/common/queue';

const q = new Queue<number>([1, 2]);
q.enqueue(3);

console.log(q.peek());    // 1
console.log(q.dequeue()); // 1
console.log(q.toArray()); // [2, 3]
```

### `resettable-value`

A generic mutable value holder that tracks its initial value so it can be restored with `reset`.

```ts
import { ResettableValue } from '@depthbomb/common/resettable-value';

const retries = new ResettableValue(3);
retries.set(1);
retries.reset(); // back to 3
```

### `types`

Shared type aliases and type-oriented helpers such as `Awaitable`, `Maybe`, `Nullable`, `cast`, `assume`, and `typedEntries`.

```ts
import { cast, assume, typedEntries, type Awaitable, type Maybe } from '@depthbomb/common/types';

const v = cast<object, { id: string }>({ id: 'a' });

const unknownValue: unknown = 'hello';
assume<string>(unknownValue); // assertion helper

const entries = typedEntries({ a: 1, b: 2 }); // typed key/value tuples

const maybeName: Maybe<string> = undefined;
const task: Awaitable<number> = Promise.resolve(1);
```

### `urllib`

URL-focused utilities centered around `URLPath`, an ergonomic wrapper for URL parsing, path composition, query/hash manipulation, and request dispatch via `fetch`.

```ts
import { URLPath } from '@depthbomb/common/urllib';

const api = new URLPath('https://example.com/api');
const usersUrl = api
	.joinpath('users', '42')
	.withQuery({ include: ['roles', 'profile'] })
	.withHash('details');

console.log(usersUrl.toString());
// https://example.com/api/users/42?include=roles&include=profile#details
```
