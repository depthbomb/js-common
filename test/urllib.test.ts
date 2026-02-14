import { URLPath } from '../src/urllib';
import { it, vi, expect, describe } from 'vitest';

describe('URLPath', () => {
	it('parses URL components and derived path properties', () => {
		const url = new URLPath('https://user:pass@example.com:8080/foo/bar.txt?x=1#frag');

		expect(url.protocol).toBe('https:');
		expect(url.host).toBe('example.com:8080');
		expect(url.hostname).toBe('example.com');
		expect(url.port).toBe('8080');
		expect(url.origin).toBe('https://example.com:8080');
		expect(url.username).toBe('user');
		expect(url.password).toBe('pass');
		expect(url.hash).toBe('#frag');
		expect(url.search).toBe('?x=1');
		expect(url.pathname).toBe('/foo/bar.txt');
		expect(url.parts).toEqual(['foo', 'bar.txt']);
		expect(url.name).toBe('bar.txt');
		expect(url.suffix).toBe('.txt');
		expect(url.stem).toBe('bar');
		expect(url.parent.pathname).toBe('/foo');
		expect(url.parent.search).toBe('?x=1');
		expect(url.parent.hash).toBe('#frag');
	});

	it('supports joinpath and div aliases with normalized segments', () => {
		const base = new URLPath('https://example.com/root');
		const joined = base.joinpath('/a/', 'b c');
		const divided = base.div('a', 'b c');

		expect(joined.pathname).toBe('/root/a/b%20c');
		expect(joined.parts).toEqual(['root', 'a', 'b c']);
		expect(divided.toString()).toBe(joined.toString());
	});

	it('encodes query values consistently in withQuery', () => {
		const url = new URLPath('https://example.com/path?drop=1&keep=0').withQuery({
			keep: ['a', 'b'],
			drop: null,
			flag: true,
			count: 2,
			obj: { a: 1 },
			list: [1, { z: 2 }, null, undefined],
		});

		expect(url.searchParams.getAll('keep')).toEqual(['a', 'b']);
		expect(url.searchParams.has('drop')).toBe(false);
		expect(url.searchParams.get('flag')).toBe('true');
		expect(url.searchParams.get('count')).toBe('2');
		expect(url.searchParams.get('obj')).toBe('{"a":1}');
		expect(url.searchParams.getAll('list')).toEqual(['1', '{"z":2}']);
	});

	it('removes selected query keys', () => {
		const url = new URLPath('https://example.com/path?a=1&b=2&c=3').withoutQuery('a', 'c');

		expect(url.searchParams.has('a')).toBe(false);
		expect(url.searchParams.get('b')).toBe('2');
		expect(url.searchParams.has('c')).toBe(false);
	});

	it('supports hash updates', () => {
		const base = new URLPath('https://example.com/path');
		const withHash = base.withHash('anchor');
		const withPrefixedHash = base.withHash('#already');

		expect(withHash.hash).toBe('#anchor');
		expect(withPrefixedHash.hash).toBe('#already');
		expect(withHash.withoutHash().hash).toBe('');
	});

	it('supports resolve, equals, string conversions, and static constructors', () => {
		const fromStatic = URLPath.from('https://example.com/a/b/');
		const resolved = fromStatic.resolve('../c');
		const parsed = URLPath.parse('https://example.com/x');
		const native = resolved.toURL();

		expect(resolved.equals('https://example.com/a/c')).toBe(true);
		expect(parsed.toString()).toBe('https://example.com/x');
		expect(native).toBeInstanceOf(URL);
		expect(native.toString()).toBe(resolved.toString());
		expect(resolved.valueOf()).toBe(resolved.toString());
		expect(`${resolved}`).toBe(resolved.toString());
	});

	it('delegates fetch to global fetch', async () => {
		const originalFetch = globalThis.fetch;
		const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		try {
			const url = new URLPath('https://example.com/api');
			const init: RequestInit = { method: 'POST', headers: { 'x-test': '1' } };

			await url.fetch(init);

			expect(fetchMock).toHaveBeenCalledTimes(1);
			const [urlArg, initArg] = fetchMock.mock.calls[0];
			expect(urlArg).toBeInstanceOf(URL);
			expect((urlArg as URL).toString()).toBe('https://example.com/api');
			expect(initArg).toEqual(init);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
