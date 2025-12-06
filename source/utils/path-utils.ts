import os from 'node:os';
import path from 'node:path';
import {cwd} from 'node:process';

/**
 * Expands a path starting with '~' to an absolute path pointing to the user's home directory.
 */
export function expandTilde(filePath: string): string {
	if (filePath === '~') {
		return os.homedir();
	}

	if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
		return path.join(os.homedir(), filePath.slice(2));
	}

	return filePath;
}

/**
 * Resolves a user-provided path to an absolute path, expanding '~' and
 * normalizing relative segments along the way.
 */
export function resolveUserPath(
	filePath: string,
	cwdPath: string = cwd(),
): string {
	const expandedPath = expandTilde(filePath);

	if (path.isAbsolute(expandedPath)) {
		return path.normalize(expandedPath);
	}

	return path.resolve(cwdPath, expandedPath);
}
