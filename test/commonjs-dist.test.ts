import { describe, expect, it } from 'vitest';

describe('CommonJS dist entrypoints', () => {
	it('exports the root barrel from dist/index.cjs', async () => {
		const common = await import('../dist/index.cjs');

		expect(common.Queue).toBeTypeOf('function');
		expect(common.URLPath).toBeTypeOf('function');
		expect(common.timeout).toBeTypeOf('function');
		expect(common.ok).toBeTypeOf('function');
	});

	it('exports subpath CommonJS modules', async () => {
		const { Queue } = await import('../dist/collections.cjs');
		const { URLPath } = await import('../dist/url.cjs');

		expect(Queue).toBeTypeOf('function');
		expect(URLPath).toBeTypeOf('function');
	});
});
