import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process, {cwd} from 'node:process';

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

// XDG Base Directory spec defaults, used when the variable is unset or empty.
const xdgDefaults: Record<string, string[]> = {
	XDG_CONFIG_HOME: ['.config'],
	XDG_DATA_HOME: ['.local', 'share'],
	XDG_STATE_HOME: ['.local', 'state'],
	XDG_CACHE_HOME: ['.cache'],
};

/**
 * Expands '~' and `$VAR` / `${VAR}` environment variables in a path.
 * Unset XDG base directory variables fall back to their spec defaults
 * (e.g. `$XDG_DATA_HOME` becomes `~/.local/share`); other unset variables
 * are left as written.
 */
export function expandPathVariables(
	filePath: string,
	env: NodeJS.ProcessEnv = process.env,
): string {
	const expanded = filePath.replaceAll(
		/\$(?:{(\w+)}|(\w+))/g,
		(match, braced?: string, bare?: string) => {
			const name = (braced ?? bare)!;
			const value = env[name];
			if (value) return value;
			const xdgDefault = xdgDefaults[name];
			return xdgDefault ? path.join(os.homedir(), ...xdgDefault) : match;
		},
	);

	return expandTilde(expanded);
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
 * file path into the existing `#path` syntax handled by preprocessMessage.
 * Terminals insert the path either with spaces escaped as `\ ` (Ghostty,
 * Terminal.app) or wrapped in quotes (VS Code). Anything else, including paths
 * inside other text and paths that are not existing files, is returned
 * unchanged.
 */
export async function normalizeDroppedPath(text: string): Promise<string> {
	const quotedPath = (/^'(\/[^']*)'$/.exec(text) ??
		/^"(\/[^"]*)"$/.exec(text))?.[1];
	if (quotedPath === undefined && !/^\/(?:\\ |\S)*$/.test(text)) return text;

	const filePath = quotedPath ?? text.replaceAll(String.raw`\ `, ' ');
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
