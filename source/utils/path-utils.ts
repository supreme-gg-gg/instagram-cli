import fs from 'node:fs/promises';
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

/**
 * Converts a message that consists solely of a raw drag-and-dropped absolute
 * file path (spaces escaped as `\ ` by the terminal) into the existing `#path`
 * syntax handled by preprocessMessage. Anything else, including paths inside
 * other text and paths that are not existing files, is returned unchanged.
 */
export async function normalizeDroppedPath(text: string): Promise<string> {
	if (!/^\/(?:\\ |\S)*$/.test(text)) return text;

	const filePath = text.replaceAll(String.raw`\ `, ' ');
	try {
		const stats = await fs.stat(filePath);
		if (!stats.isFile()) return text;
	} catch {
		return text;
	}

	// Pick the existing #path form that can represent this path.
	if (filePath.includes('#')) return text;
	if (!filePath.includes('"')) return `#"${filePath}"`;
	if (!filePath.includes("'")) return `#'${filePath}'`;
	if (!/\s/.test(filePath)) return `#${filePath}`;
	return text;
}
