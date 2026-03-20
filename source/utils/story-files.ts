import fs from 'node:fs/promises';
import path from 'node:path';

export type StoryFileEntry = {
	name: string;
	path: string;
	type: 'directory' | 'file';
	size?: number;
};

const STORY_FILE_PATTERN = /\.(jpg|jpeg|png|mp4)$/i;

export function isSupportedStoryFile(name: string): boolean {
	return STORY_FILE_PATTERN.test(name);
}

export function formatFileSize(size: number): string {
	if (size < 1024) {
		return `${size} B`;
	}

	if (size < 1024 * 1024) {
		return `${(size / 1024).toFixed(1)} KB`;
	}

	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export async function listStoryFiles(
	currentPath: string,
): Promise<StoryFileEntry[]> {
	const dirEntries = await fs.readdir(currentPath, {withFileTypes: true});

	const visibleEntries = dirEntries.filter(
		entry => !entry.name.startsWith('.'),
	);
	const mappedEntries: Array<StoryFileEntry | undefined> = await Promise.all(
		visibleEntries.map(async entry => {
			const fullPath = path.join(currentPath, entry.name);

			if (entry.isDirectory()) {
				return {
					name: entry.name,
					path: fullPath,
					type: 'directory' as const,
				};
			}

			if (!isSupportedStoryFile(entry.name)) {
				return undefined;
			}

			const stats = await fs.stat(fullPath);
			return {
				name: entry.name,
				path: fullPath,
				type: 'file' as const,
				size: stats.size,
			};
		}),
	);

	return mappedEntries
		.filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
		.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === 'directory' ? -1 : 1;
			}

			return a.name.localeCompare(b.name);
		});
}
