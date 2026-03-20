import path from 'node:path';
import process from 'node:process';
import React, {useEffect, useState} from 'react';
import {Box, Text, useInput} from 'ink';
import {
	type StoryFileEntry as FileBrowserEntry,
	formatFileSize,
	listStoryFiles,
} from '../../utils/story-files.js';

type FileBrowserProps = {
	readonly initialPath?: string;
	readonly onSelect: (filePath: string) => void;
	readonly onExit: () => void;
};

export default function FileBrowser({
	initialPath = process.cwd(),
	onSelect,
	onExit,
}: FileBrowserProps) {
	const [currentPath, setCurrentPath] = useState(initialPath);
	const [entries, setEntries] = useState<FileBrowserEntry[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();

	useEffect(() => {
		let mounted = true;

		const loadEntries = async () => {
			setIsLoading(true);
			setError(undefined);

			try {
				const nextEntries = await listStoryFiles(currentPath);
				if (!mounted) {
					return;
				}

				setEntries(nextEntries);
				setSelectedIndex(0);
			} catch (error_) {
				if (!mounted) {
					return;
				}

				setEntries([]);
				setError(error_ instanceof Error ? error_.message : String(error_));
			} finally {
				if (mounted) {
					setIsLoading(false);
				}
			}
		};

		void loadEntries();

		return () => {
			mounted = false;
		};
	}, [currentPath]);

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			onExit();
			return;
		}

		if (input === 'q') {
			onExit();
			return;
		}

		if (key.upArrow || input === 'k') {
			setSelectedIndex(previous => Math.max(0, previous - 1));
			return;
		}

		if (key.downArrow || input === 'j') {
			setSelectedIndex(previous =>
				Math.min(previous + 1, Math.max(entries.length - 1, 0)),
			);
			return;
		}

		if (key.backspace || key.leftArrow || input === 'h') {
			const parentPath = path.dirname(currentPath);
			if (parentPath !== currentPath) {
				setCurrentPath(parentPath);
			}

			return;
		}

		if (!key.return) {
			return;
		}

		const selectedEntry = entries[selectedIndex];
		if (!selectedEntry) {
			return;
		}

		if (selectedEntry.type === 'directory') {
			setCurrentPath(selectedEntry.path);
			return;
		}

		onSelect(selectedEntry.path);
	});

	return (
		<Box flexDirection="column" gap={1}>
			<Text color="cyan">Current directory: {currentPath}</Text>

			{isLoading ? <Text color="yellow">Loading files...</Text> : null}
			{error ? (
				<Text color="red">Failed to read directory: {error}</Text>
			) : null}

			{!isLoading && !error && entries.length === 0 ? (
				<Text color="yellow">No compatible files found in this directory.</Text>
			) : null}

			<Box flexDirection="column">
				{entries.map((entry, index) => (
					<Text
						key={entry.path}
						color={index === selectedIndex ? 'green' : undefined}
					>
						{index === selectedIndex ? '➜ ' : '  '}
						{entry.type === 'directory'
							? `${entry.name}/`
							: `${entry.name} (${formatFileSize(entry.size ?? 0)})`}
					</Text>
				))}
			</Box>

			<Text dimColor>
				j/k or arrows: move, Enter: open/select, Backspace/h/←: up, q: quit
			</Text>
		</Box>
	);
}
