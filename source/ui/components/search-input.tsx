import React from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';

type SearchMode = 'username' | 'title';

type SearchInputProps = {
	readonly mode: SearchMode;
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly onSubmit: (value: string) => void;
	readonly onCancel: () => void;
	readonly isSearching?: boolean;
	readonly resultCount?: number;
};

export default function SearchInput({
	mode,
	value,
	onChange,
	onSubmit,
	onCancel,
	isSearching = false,
	resultCount = 0,
}: SearchInputProps) {
	const placeholder =
		mode === 'username'
			? 'Enter username to search...'
			: 'Enter chat title to search...';

	const prefix = mode === 'username' ? '@' : '/';

	useInput((_input, key) => {
		if (key.escape) {
			onCancel();
		}
	});

	// Handle text input submit
	const handleSubmit = (submittedValue: string) => {
		if (submittedValue.trim()) {
			onSubmit(submittedValue.trim());
		}
	};

	return (
		<Box borderStyle="round" flexDirection="column" paddingX={1}>
			<Box>
				<Text bold color="cyan">
					{prefix}
				</Text>
				<TextInput
					showCursor
					placeholder={placeholder}
					value={value}
					onChange={onChange}
					onSubmit={handleSubmit}
				/>
				{isSearching && (
					<Text dimColor color="yellow">
						{' '}
						Searching...
					</Text>
				)}
				{!isSearching && value.length > 0 && (
					<Text dimColor>
						{' '}
						({resultCount} result{resultCount === 1 ? '' : 's'})
					</Text>
				)}
			</Box>
		</Box>
	);
}
