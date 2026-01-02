import * as esbuild from 'esbuild';
import {rmSync} from 'node:fs';
import {parseArgs} from 'node:util';

const {values} = parseArgs({
	options: {
		production: {
			type: 'boolean',
			short: 'p',
		},
		watch: {
			type: 'boolean',
			short: 'w',
		},
	},
});

if (values.production) {
	rmSync('dist', {recursive: true, force: true});
}

async function runBuild() {
	const entryPoints = ['source/cli.ts', 'source/commands/**/*.tsx'];

	if (values.watch) {
		entryPoints.push('source/mocks/**/*.ts');
	}

	const buildOptions = {
		entryPoints,
		bundle: true,
		platform: 'node',
		format: 'esm',
		outdir: 'dist',
		outbase: 'source',
		minify: values.production,
		packages: 'external',
		external: ['react-devtools-core'],
	};

	try {
		if (values.watch) {
			const ctx = await esbuild.context(buildOptions);
			await ctx.watch();
			console.log('Watching for changes...');
		} else {
			await esbuild.build(buildOptions);
			console.log('Build complete!');
		}
	} catch (error) {
		console.error('Build failed:', error);
		process.exit(1);
	}
}

runBuild();
