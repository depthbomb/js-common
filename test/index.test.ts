import { describe, expect, it } from 'vitest';
import * as common from '../dist/index.mjs';

describe('root ESM entrypoint', () => {
	it('re-exports symbols from the package root barrel', () => {
		expect(common.Queue).toBeTypeOf('function');
		expect(common.URLPath).toBeTypeOf('function');
		expect(common.timeout).toBeTypeOf('function');
		expect(common.ok).toBeTypeOf('function');
	});
});
