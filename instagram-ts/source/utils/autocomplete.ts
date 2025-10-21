import fs from 'node:fs/promises';
import path from 'node:path';
import {chatCommands} from './chat-commands.js';
import {expandTilde} from './path-utils.js';

export type CommandSuggestion = {
	readonly name: string;
	readonly description: string;
};

export function getCommandSuggestions(
	query: string,
): readonly CommandSuggestion[] {
	const suggestions: CommandSuggestion[] = [];
	for (const name in chatCommands) {
		if (name.startsWith(query)) {
			suggestions.push({
				name,
				description: chatCommands[name]!.description,
			});
		}
	}

	return suggestions;
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
		const lowerCasePrefix = filterPrefix.toLowerCase();
		const includeHidden =
			filterPrefix.startsWith('.') ||
			query.startsWith('.') ||
			filterPrefix === '';

		const suggestions = entries
			.filter(entry => {
				if (!includeHidden && entry.name.startsWith('.')) {
					return false;
				}

				return entry.name.toLowerCase().startsWith(lowerCasePrefix);
			})
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
