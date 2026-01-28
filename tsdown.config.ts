import { defineConfig } from 'tsdown';

export default defineConfig({
	clean: true,
	entry: [
		'src/**/*.ts'
	],
	format: ['cjs', 'esm'],
	dts: true,
	minify: true,
	skipNodeModulesBundle: true,
	target: ['chrome100', 'firefox100', 'safari15.4', 'node24'],
	exports: {
		packageJson: false
	},
	tsconfig: './tsconfig.json'
});
