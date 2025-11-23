#!/usr/bin/env node
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readPackageUp} from 'read-package-up';
import Pastel from 'pastel';
import {initializeLogger} from './utils/logger.js';

// Initialize logger as early as possible
await initializeLogger();

// This is needed to get the correct path in ES modules
// In order to find the correct nearest package.json
// Pastel's default doesn't work when running globally where pwd is not the code path
const scriptDir = dirname(fileURLToPath(import.meta.url));
const package_ = await readPackageUp({cwd: scriptDir});

const app = new Pastel({
	importMeta: import.meta,
	version: package_?.packageJson.version,
	description: package_?.packageJson.description,
});

try {
	await app.run();
} catch {
	// eslint-disable-next-line n/prefer-global/process
	process.exit(1);
}
