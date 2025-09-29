import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Expands a path starting with '~/' to an absolute path.
 * @param filePath The path to expand.
 * @returns The expanded path.
 */
function expandTilde(filePath: string): string {
	if (filePath.startsWith('~/')) {
		return path.join(os.homedir(), filePath.slice(2));
	}

	return filePath;
}

/**
 * Provides file path suggestions for autocomplete.
 * @param query The partial path input by the user.
 * @returns A promise that resolves to an array of matching file/directory paths.
 */
export async function getFilePathSuggestions(query: string): Promise<string[]> {
	try {
		const resolvedQueryPath = expandTilde(query);

		const isQueryDirectory =
			query.endsWith('/') || query === '.' || query === '..';

		const searchDir = isQueryDirectory
			? resolvedQueryPath
			: path.dirname(resolvedQueryPath);
		const filterPrefix = isQueryDirectory
			? ''
			: path.basename(resolvedQueryPath);

		const entries = await fs.readdir(searchDir, {withFileTypes: true});

		const suggestions = entries
			.filter(
				entry =>
					!entry.name.startsWith('.') &&
					entry.name.toLowerCase().startsWith(filterPrefix.toLowerCase()),
			)
			.map(entry => {
				const base = isQueryDirectory
					? query
					: query.slice(0, query.length - filterPrefix.length);
				if (entry.isDirectory()) {
					return `${base}${entry.name}/`;
				}

				return `${base}${entry.name}`;
			});

		return suggestions;
	} catch {
		// Errors are common (e.g., directory doesn't exist), so we just return no suggestions.
		return [];
	}
}
