export type URLLike = string | URL | URLPath;
// Taken from the `ufo` package
export type QueryValue =
  | string
  | number
  | undefined
  | null
  | boolean
  | Array<QueryValue>
  | Record<string, any>;
// Taken from the `ufo` package
export type QueryObject = Record<string, QueryValue | QueryValue[]>;

export class URLPath {
	readonly #url: URL;

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

	public get protocol(): string {
		return this.#url.protocol;
	}

	public get host(): string {
		return this.#url.host;
	}

	public get hostname(): string {
		return this.#url.hostname;
	}

	public get port(): string {
		return this.#url.port;
	}

	public get origin(): string {
		return this.#url.origin;
	}

	public get username(): string {
		return this.#url.username;
	}

	public get password(): string {
		return this.#url.password;
	}

	public get hash(): string {
		return this.#url.hash;
	}

	public get search(): string {
		return this.#url.search;
	}

	public get searchParams(): URLSearchParams {
		return new URLSearchParams(this.#url.search);
	}

	public get pathname(): string {
		return this.#url.pathname;
	}

	public get parts(): string[] {
		return this.#url.pathname
			.split('/')
			.filter(Boolean)
			.map(decodeURIComponent);
	}

	public get name(): string {
		return this.parts.at(-1) ?? '';
	}

	public get suffix(): string {
		const name = this.name;
		const i    = name.lastIndexOf('.');

		return i >= 0 ? name.slice(i) : '';
	}

	public get stem(): string {
		const name = this.name;
		const i    = name.lastIndexOf('.');

		return i >= 0 ? name.slice(0, i) : name;
	}

	public get parent(): URLPath {
		const parts = this.parts.slice(0, -1);

		return this.withPath(parts);
	}

	public joinpath(...segments: string[]): URLPath {
		const parts = [...this.parts, ...segments.map(s => s.replace(/^\/+|\/+$/g, ''))];

		return this.withPath(parts);
	}

	public div(...segments: string[]): URLPath {
		return this.joinpath(...segments);
	}

	private withPath(parts: string[]): URLPath {
		const url = new URL(this.#url.toString());
		url.pathname = '/' + parts.map(encodeURIComponent).join('/');
		return new URLPath(url);
	}

	public withQuery(params: QueryObject): URLPath {
		const url = new URL(this.#url.toString());

		for (const [k, v] of Object.entries(params)) {
			if (v === null || v === undefined) {
				url.searchParams.delete(k);
			} else {
				url.searchParams.set(k, String(v));
			}
		}

		return new URLPath(url);
	}

	public withoutQuery(...keys: string[]): URLPath {
		const url = new URL(this.#url.toString());

		for (const key of keys) {
			url.searchParams.delete(key);
		}

		return new URLPath(url);
	}

	public withHash(hash: string): URLPath {
		const url = new URL(this.#url.toString());
		url.hash = hash.startsWith('#') ? hash : `#${hash}`;

		return new URLPath(url);
	}

	public withoutHash(): URLPath {
		const url = new URL(this.#url.toString());
		url.hash = '';

		return new URLPath(url);
	}

	// eslint-disable-next-line no-undef
	public async fetch(init?: RequestInit): Promise<Response> {
		return fetch(this.#url, init);
	}

	public resolve(relative: string): URLPath {
		return new URLPath(relative, this);
	}

	public equals(other: URLLike): boolean {
		return this.toString() === new URLPath(other).toString();
	}

	public toURL(): URL {
		return new URL(this.#url.toString());
	}

	public toString(): string {
		return this.#url.toString();
	}

	public valueOf(): string {
		return this.toString();
	}

	public [Symbol.toPrimitive](): string {
		return this.toString();
	}

	public static from(input: URLLike, base?: URLLike): URLPath {
		return new URLPath(input, base);
	}

	public static parse(input: string): URLPath {
		return new URLPath(input);
	}
}
