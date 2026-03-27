import type { Arrayable } from './typing';

/**
 * Values accepted by {@link URLPath} constructors and helpers.
 */
export type URLLike = string | URL | URLPath;
// Taken from the `ufo` package
/**
 * A single query parameter value (including nested and array values).
 */
export type QueryValue =
	| string
	| number
	| undefined
	| null
	| boolean
	| Array<QueryValue>
	| Record<string, any>;
// Taken from the `ufo` package
/**
 * Query-object shape used by URL query mutation helpers.
 */
export type QueryObject = Record<string, QueryValue | QueryValue[]>;

/**
 * Tagged-template helper for encoded URL path segments.
 *
 * @example
 * const path = url`/users/${userId}/posts/${postId}`;
 */
export function url(strings: TemplateStringsArray, ...values: unknown[]) {
	let output = '';
	for (let i = 0; i < strings.length; i++) {
		output += strings[i];
		if (i < values.length) {
			output += encodeURIComponent(String(values[i]));
		}
	}

	return output;
}

/**
 * Immutable URL utility wrapper with convenience path/query operations.
 */
export class URLPath {
	readonly #url: URL;

	/**
	 * Creates a `URLPath` from a URL-like input and optional base URL.
	 *
	 * @param input URL value to parse.
	 * @param base Optional base URL for relative inputs.
	 */
	public constructor(input: URLLike, base?: URLLike) {
		if (input instanceof URLPath) {
			this.#url = new URL(input.toString());
		} else if (input instanceof URL) {
			this.#url = new URL(input.toString());
		} else if (base) {
			this.#url = new URL(input, base.toString());
		} else {
			this.#url = new URL(input);
		}
	}

	/**
	 * URL protocol including trailing `:`.
	 */
	public get protocol(): string {
		return this.#url.protocol;
	}

	/**
	 * Host including port when present.
	 */
	public get host(): string {
		return this.#url.host;
	}

	/**
	 * Hostname without port.
	 */
	public get hostname(): string {
		return this.#url.hostname;
	}

	/**
	 * Port component, or an empty string when absent.
	 */
	public get port(): string {
		return this.#url.port;
	}

	/**
	 * URL origin (`protocol + // + host`).
	 */
	public get origin(): string {
		return this.#url.origin;
	}

	/**
	 * Username component.
	 */
	public get username(): string {
		return this.#url.username;
	}

	/**
	 * Password component.
	 */
	public get password(): string {
		return this.#url.password;
	}

	/**
	 * Hash fragment including leading `#` when present.
	 */
	public get hash(): string {
		return this.#url.hash;
	}

	/**
	 * Search component including leading `?` when present.
	 */
	public get search(): string {
		return this.#url.search;
	}

	/**
	 * Returns a copy of query parameters.
	 */
	public get searchParams(): URLSearchParams {
		return new URLSearchParams(this.#url.search);
	}

	/**
	 * URL pathname component.
	 */
	public get pathname(): string {
		return this.#url.pathname;
	}

	/**
	 * Decoded pathname segments without empty parts.
	 */
	public get parts(): string[] {
		return this.#url.pathname
			.split('/')
			.filter(Boolean)
			.map(decodeURIComponent);
	}

	/**
	 * Final path segment (decoded).
	 */
	public get name(): string {
		return this.parts.at(-1) ?? '';
	}

	/**
	 * File suffix from {@link name}, including the leading dot.
	 */
	public get suffix(): string {
		const name = this.name;
		const i = name.lastIndexOf('.');

		return i >= 0 ? name.slice(i) : '';
	}

	/**
	 * File name without suffix from {@link name}.
	 */
	public get stem(): string {
		const name = this.name;
		const i = name.lastIndexOf('.');

		return i >= 0 ? name.slice(0, i) : name;
	}

	/**
	 * Parent path with the last path segment removed.
	 */
	public get parent(): URLPath {
		const parts = this.parts.slice(0, -1);

		return this.withPath(parts);
	}

	/**
	 * Appends path segments and returns a new URL.
	 *
	 * @param segments Segments to append.
	 */
	public joinpath(...segments: string[]): URLPath {
		const parts = [...this.parts, ...segments.map(s => s.replace(/^\/+|\/+$/g, ''))];

		return this.withPath(parts);
	}

	/**
	 * Alias of {@link joinpath}.
	 *
	 * @param segments Segments to append.
	 */
	public div(...segments: string[]): URLPath {
		return this.joinpath(...segments);
	}

	/**
	 * Creates a copy with replaced pathname parts.
	 *
	 * @param parts Decoded path parts.
	 */
	private withPath(parts: string[]): URLPath {
		const url = new URL(this.#url.toString());
		url.pathname = '/' + parts.map(encodeURIComponent).join('/');
		return new URLPath(url);
	}

	/**
	 * Replaces query parameter values for the provided keys.
	 *
	 * @param params Query values to set.
	 */
	public withQuery(params: QueryObject): URLPath {
		const url = new URL(this.#url.toString());

		for (const [k, v] of Object.entries(params)) {
			url.searchParams.delete(k);
			this.appendQueryValue(url.searchParams, k, v);
		}

		return new URLPath(url);
	}

	/**
	 * Alias of {@link withQuery}.
	 *
	 * @param params Query values to set.
	 */
	public withQueryPatch(params: QueryObject): URLPath {
		return this.withQuery(params);
	}

	/**
	 * Appends query parameter values without deleting existing values.
	 *
	 * @param params Query values to append.
	 */
	public appendQuery(params: QueryObject): URLPath {
		const url = new URL(this.#url.toString());

		for (const [k, v] of Object.entries(params)) {
			this.appendQueryValue(url.searchParams, k, v);
		}

		return new URLPath(url);
	}

	/**
	 * Removes query keys whose values are entirely empty strings.
	 */
	public withoutEmptyQuery(): URLPath {
		const url    = new URL(this.#url.toString());
		const visited = new Set<string>();

		for (const key of url.searchParams.keys()) {
			if (visited.has(key)) {
				continue;
			}

			visited.add(key);

			const values = url.searchParams.getAll(key);
			if (values.every(value => value === '')) {
				url.searchParams.delete(key);
			}
		}

		return new URLPath(url);
	}

	/**
	 * Removes selected query keys.
	 *
	 * @param keys Query keys to remove.
	 */
	public withoutQuery(...keys: string[]): URLPath {
		const url = new URL(this.#url.toString());

		for (const key of keys) {
			url.searchParams.delete(key);
		}

		return new URLPath(url);
	}

	/**
	 * Sets the hash fragment and returns a new URL.
	 *
	 * @param hash Hash value with or without leading `#`.
	 */
	public withHash(hash: string): URLPath {
		const url = new URL(this.#url.toString());
		url.hash = hash.startsWith('#') ? hash : `#${hash}`;

		return new URLPath(url);
	}

	/**
	 * Removes the hash fragment.
	 */
	public withoutHash(): URLPath {
		const url = new URL(this.#url.toString());
		url.hash = '';

		return new URLPath(url);
	}

	// eslint-disable-next-line no-undef
	/**
	 * Calls global `fetch` with this URL as input.
	 *
	 * @param init Optional fetch options.
	 */
	public async fetch(init?: RequestInit): Promise<Response> {
		return fetch(this.#url, init);
	}

	/**
	 * Resolves a relative URL against this URL.
	 *
	 * @param relative Relative URL/path.
	 */
	public resolve(relative: string): URLPath {
		return new URLPath(relative, this);
	}

	/**
	 * Compares URLs by normalized string value.
	 *
	 * @param other URL to compare.
	 */
	public equals(other: URLLike): boolean {
		return this.toString() === new URLPath(other).toString();
	}

	/**
	 * Returns a new native `URL` instance.
	 */
	public toURL(): URL {
		return new URL(this.#url.toString());
	}

	/**
	 * Returns the URL as a string.
	 */
	public toString(): string {
		return this.#url.toString();
	}

	/**
	 * Primitive value representation.
	 */
	public valueOf(): string {
		return this.toString();
	}

	/**
	 * Primitive coercion hook.
	 */
	public [Symbol.toPrimitive](): string {
		return this.toString();
	}

	/**
	 * Creates a `URLPath` from URL-like input.
	 *
	 * @param input URL value to parse.
	 * @param base Optional base URL for relative inputs.
	 */
	public static from(input: URLLike, base?: URLLike): URLPath {
		return new URLPath(input, base);
	}

	/**
	 * Parses an absolute URL string.
	 *
	 * @param input URL string to parse.
	 */
	public static parse(input: string): URLPath {
		return new URLPath(input);
	}

	private appendQueryValue(searchParams: URLSearchParams, key: string, value: Arrayable<QueryValue>) {
		if (value === null || value === undefined) {
			return;
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				this.appendQueryValue(searchParams, key, item);
			}

			return;
		}

		if (typeof value === 'object') {
			try {
				searchParams.append(key, JSON.stringify(value));
			} catch {
				searchParams.append(key, String(value));
			}

			return;
		}

		searchParams.append(key, String(value));
	}
}
