import React, {useState, useEffect} from 'react';
import {Box, Text, useInput} from 'ink';
import fs from 'node:fs';
import path from 'node:path';

const SUPPORTED_EXTENSIONS = /\.(jpg|jpeg|png|mp4)$/i;

type Entry = {
	name: string;
	isDirectory: boolean;
	size?: number; // bytes; undefined for directories
};

type FileBrowserProps = {
	initialPath?: string;
	onSelect: (filePath: string) => void;
	onExit: () => void;
};

function formatSize(bytes: number): string {
	if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${bytes} B`;
}

export default function FileBrowser({
	initialPath,
	onSelect,
	onExit,
}: FileBrowserProps) {
	const [currentPath, setCurrentPath] = useState(initialPath ?? process.cwd());
	const [entries, setEntries] = useState<Entry[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [dirError, setDirError] = useState<string | undefined>();

	useEffect(() => {
		const loadEntries = async () => {
			setIsLoading(true);
			setDirError(undefined);
			try {
				const dirents = await fs.promises.readdir(currentPath, {
					withFileTypes: true,
				});
				const filtered: Entry[] = dirents
					.filter(d => {
						if (d.name.startsWith('.')) return false;
						if (d.isDirectory()) return true;
						return SUPPORTED_EXTENSIONS.test(d.name);
					})
					.map(d => ({name: d.name, isDirectory: d.isDirectory()}));

				// Directories first, then files, both alphabetically
				filtered.sort((a, b) => {
					if (a.isDirectory && !b.isDirectory) return -1;
					if (!a.isDirectory && b.isDirectory) return 1;
					return a.name.localeCompare(b.name);
				});

				// Fetch file sizes for non-directory entries
				const withStats = await Promise.all(
					filtered.map(async entry => {
						if (entry.isDirectory) return entry;
						try {
							const stat = await fs.promises.stat(
								path.join(currentPath, entry.name),
							);
							return {...entry, size: stat.size};
						} catch {
							return entry;
						}
					}),
				);

				setEntries(withStats);
				setSelectedIndex(0);
			} catch (error) {
				setDirError(error instanceof Error ? error.message : String(error));
			} finally {
				setIsLoading(false);
			}
		};

		void loadEntries();
	}, [currentPath]);

	useInput((input, key) => {
		if (key.downArrow || input === 'j') {
			setSelectedIndex(i => Math.min(i + 1, entries.length - 1));
		} else if (key.upArrow || input === 'k') {
			setSelectedIndex(i => Math.max(i - 1, 0));
		} else if (key.return) {
			const entry = entries[selectedIndex];
			if (!entry) return;
			if (entry.isDirectory) {
				setCurrentPath(path.join(currentPath, entry.name));
			} else {
				onSelect(path.join(currentPath, entry.name));
			}
		} else if (key.backspace || key.delete || input === 'h' || key.leftArrow) {
			const parent = path.dirname(currentPath);
			if (parent !== currentPath) {
				setCurrentPath(parent);
			}
		} else if (input === 'q' || key.escape) {
			onExit();
		}
	});

	if (isLoading) {
		return <Text color="gray">Loading…</Text>;
	}

	if (dirError) {
		return (
			<Box flexDirection="column">
				<Text color="red">Error reading directory: {dirError}</Text>
				<Text color="gray">Press 'h' or ← to go up</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text color="cyan" bold>
				{currentPath}
			</Text>
			{entries.length === 0 ? (
				<Text color="gray">No compatible files found in this directory.</Text>
			) : (
				entries.map((entry, index) => (
					<Box key={entry.name}>
						<Text
							color={index === selectedIndex ? 'black' : undefined}
							backgroundColor={index === selectedIndex ? 'white' : undefined}
						>
							{entry.isDirectory ? `${entry.name}/` : entry.name}
						</Text>
						{!entry.isDirectory && entry.size !== undefined && (
							<Text color="gray" dimColor>
								{'  '}
								{formatSize(entry.size)}
							</Text>
						)}
					</Box>
				))
			)}
			<Text dimColor>
				↑↓ / jk navigate · Enter select · ← / h / Backspace up · q quit
			</Text>
		</Box>
	);
}
