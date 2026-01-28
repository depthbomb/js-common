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
	target: ['chrome142', 'firefox145', 'safari24', 'node24'],
	exports: {
		packageJson: false
	},
	tsconfig: './tsconfig.json'
});
