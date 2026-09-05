import '../dist/extensions.mjs';
import { Rolldown } from 'tsdown';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { it, expect, describe } from 'vitest';

describe('String.empty', () => {
	it('preserves extension initialization in a tree-shaken consumer bundle', async () => {
		const entry = '\0extensions-consumer';
		const extension = resolve('dist/extensions.mjs').replaceAll('\\', '/');
		const bundle = await Rolldown.rolldown({
			input: entry,
			plugins: [{
				name: 'extensions-consumer',
				resolveId(id) {
					return id === entry ? entry : null;
				},
				load(id) {
					return id === entry
						? `import ${JSON.stringify(extension)}; globalThis.extensionResult = [String.empty(), String.isEmpty('')];`
						: null;
				}
			}]
		});

		try {
			const output = await bundle.generate({
				format: 'iife'
			});
			const context = {} as {
				extensionResult?: unknown;
			};
			runInNewContext(output.output[0].code, context);
			expect(context.extensionResult).toEqual(['', true]);
		} finally {
			await bundle.close();
		}
	});

	it('should return an empty string', () => {
		expect(String.empty()).toBe('');
	});
});

describe('String.isEmpty', () => {
	it('only identifies the empty string', () => {
		expect(String.isEmpty('')).toBe(true);
		expect(String.isEmpty(' ')).toBe(false);
		expect(String.isEmpty(null)).toBe(false);
	});
});
