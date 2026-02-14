function hashArgs(args: any[]): string {
	const seen = new WeakMap<object, number>();
	let counter = 0;

	function hash(value: any) {
		const type = typeof value;

		if (value === null || type === 'number' || type === 'string' || type === 'boolean') {
			return value;
		}

		if (type === 'undefined') {
			return 'undefined';
		}

		if (type === 'bigint') {
			return `bigint:${value.toString()}`;
		}

		if (type === 'function') {
			if (seen.has(value)) {
				return { fnRef: seen.get(value) };
			}

			seen.set(value, counter++);
			return {
				fn: seen.get(value),
				name: value.name || 'anon',
			};
		}

		if (value instanceof Date) {
			return `date:${value.toISOString()}`;
		}

		if (value instanceof RegExp) {
			return `regexp:${value.toString()}`;
		}

		if (Array.isArray(value)) {
			return value.map(hash);
		}

		if (value instanceof Map) {
			return {
				map: [...value.entries()].map(([k, v]) => [hash(k), hash(v)])
			};
		}

		if (value instanceof Set) {
			return {
				set: [...value.values()].map(hash).sort()
			};
		}

		if (typeof value === 'object') {
			if (seen.has(value)) {
				return { ref: seen.get(value) };
			}

			seen.set(value, counter++);

			const entries = Object.entries(value)
				.sort(([a], [b]) => (a < b ? -1 : 1))
				.map(([k, v]) => [k, hash(v)]);

			return { obj: entries };
		}

		return value;
	}

	return JSON.stringify(args.map(hash));
}

/**
 * Creates a method decorator that caches the return value of the method for the specified
 * {@link ttlMs|time to live} in milliseconds.
 *
 * @param ttlMs How long the cached value should be returned after its last call in milliseconds.
 */
export function cache(ttlMs: number) {
	return function <T extends object, Args extends any[], R>(
		method: (this: T, ...args: Args) => R,
		_ctx: ClassMethodDecoratorContext<T, (this: T, ...args: Args) => R>
	) {
		const instanceCache = new WeakMap<object, Map<string, { value: R; expiry: number }>>();

		return function (this: T, ...args: Args): R {
			const now = Date.now();

			let methodCache = instanceCache.get(this);
			if (!methodCache) {
				methodCache = new Map();
				instanceCache.set(this, methodCache);
			}

			const key   = hashArgs(args);
			const entry = methodCache.get(key);
			if (entry && entry.expiry > now) {
				return entry.value;
			}

			const result = method.apply(this, args);
			if (result instanceof Promise) {
				const wrapped = result.catch((error) => {
					methodCache.delete(key);
					throw error;
				}) as R;

				methodCache.set(key, {
					value: wrapped,
					expiry: now + ttlMs,
				});

				return wrapped;
			}

			methodCache.set(key, {
				value: result,
				expiry: now + ttlMs,
			});

			return result;
		};
	};
}
