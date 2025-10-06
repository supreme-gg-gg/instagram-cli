import React, {useState, useEffect} from 'react';
import {Box, useInput} from 'ink';
import TextInput from 'ink-text-input';
import {
	getFilePathSuggestions,
	getCommandSuggestions,
} from '../../utils/autocomplete.js';
import {AutocompleteView} from './autocomplete-view.js';

type InputBoxProperties = {
	readonly onSend: (message: string) => void;
	readonly isDisabled?: boolean;
};

type AutocompleteState = {
	readonly type: 'command' | 'filePath' | undefined;
	readonly isActive: boolean;
	readonly suggestions: readonly string[];
	readonly selectedIndex: number;
	readonly triggerIndex: number; // Position where the trigger starts
	readonly query: string;
};

const initialAutocompleteState: AutocompleteState = {
	type: undefined,
	isActive: false,
	suggestions: [],
	selectedIndex: 0,
	triggerIndex: -1,
	query: '',
};

export default function InputBox({
	onSend,
	isDisabled = false,
}: InputBoxProperties) {
	const [message, setMessage] = useState('');
	const [autocomplete, setAutocomplete] = useState<AutocompleteState>(
		initialAutocompleteState,
	);

	// By changing the key, we force the TextInput to re-mount, which resets its internal state (including cursor position after autocomplete selection)
	const [inputKey, setInputKey] = useState(0);

	const handleSubmit = (value: string) => {
		if (value.trim()) {
			onSend(value.trim());
			setMessage('');
		}

		setAutocomplete(initialAutocompleteState); // Reset on submit
	};

	const handleAutocompleteSelection = (suggestion: string) => {
		if (autocomplete.type === 'command') {
			const commandName = suggestion.split(' ')[0];
			const newMessage = `:${commandName} `;
			setMessage(newMessage);
		} else if (autocomplete.type === 'filePath') {
			const textBefore = message.slice(0, autocomplete.triggerIndex);
			// If triggerIndex is 0, we're at the start of the message
			const newMessage =
				autocomplete.triggerIndex === 0
					? `#${suggestion}`
					: `${textBefore}#${suggestion}`;
			setMessage(newMessage);
		}

		setAutocomplete(initialAutocompleteState);
		// Force re-mount of TextInput to ensure cursor is at the end
		setInputKey(previous => previous + 1);
	};

	// Effect to fetch suggestions for file paths (async)
	useEffect(() => {
		if (!autocomplete.isActive || autocomplete.type !== 'filePath') {
			return;
		}

		let isCancelled = false;

		const fetchSuggestions = async () => {
			const newSuggestions = await getFilePathSuggestions(autocomplete.query);
			if (!isCancelled) {
				setAutocomplete(previous => ({
					...previous,
					suggestions: newSuggestions,
					selectedIndex: 0,
				}));
			}
		};

		void fetchSuggestions();

		// Cleanup function to cancel stale requests
		return () => {
			isCancelled = true;
		};
	}, [autocomplete.isActive, autocomplete.type, autocomplete.query]);

	const handleInputChange = (value: string) => {
		setMessage(value);

		const commandMatch = /^:(\w*)$/.exec(value);
		// Updated regex to match # at the beginning of string or after whitespace
		const filePathMatch = /(^#(\S*)$)|(\s#(\S*)$)/.exec(value);

		if (commandMatch) {
			const query = commandMatch[1] ?? '';
			// This is sync, so no need for useEffect
			const commandSuggestions = getCommandSuggestions(query);
			setAutocomplete({
				type: 'command',
				isActive: true,
				suggestions: commandSuggestions.map(
					s => `${s.name} - ${s.description}`,
				),
				query,
				triggerIndex: 0,
				selectedIndex: 0,
			});
		} else if (filePathMatch && typeof filePathMatch.index === 'number') {
			// Handle both cases: #path at start (group 2) or after space (group 4)
			const query = filePathMatch[2] ?? filePathMatch[4] ?? '';
			const triggerIndex = filePathMatch[2] ? 0 : filePathMatch.index + 1;
			setAutocomplete(previous => ({
				...previous, // Preserve existing suggestions while typing
				type: 'filePath',
				isActive: true,
				query,
				triggerIndex,
				selectedIndex: 0,
			}));
		} else if (autocomplete.isActive) {
			setAutocomplete(initialAutocompleteState);
		}
	};

	// This single useInput hook handles all key presses, creating a clear priority
	useInput((_input, key) => {
		if (isDisabled) {
			return;
		}

		// Priority 1: Autocomplete handling
		if (autocomplete.isActive && autocomplete.suggestions.length > 0) {
			if (key.upArrow) {
				setAutocomplete(previous => ({
					...previous,
					selectedIndex:
						(previous.selectedIndex - 1 + previous.suggestions.length) %
						previous.suggestions.length,
				}));
				return; // Consume event
			}

			if (key.downArrow) {
				setAutocomplete(previous => ({
					...previous,
					selectedIndex:
						(previous.selectedIndex + 1) % previous.suggestions.length,
				}));
				return; // Consume event
			}

			if (key.escape) {
				setAutocomplete(initialAutocompleteState);
				return; // Consume event
			}

			if (key.tab || key.return) {
				const selectedSuggestion =
					autocomplete.suggestions[autocomplete.selectedIndex];
				if (selectedSuggestion) {
					handleAutocompleteSelection(selectedSuggestion);
				}

				return; // Consume event, preventing submission
			}
		}

		// Priority 2: Default submission on Enter

		if (key.return) {
			handleSubmit(message);
		}
	});

	return (
		<Box flexDirection="column">
			<Box borderStyle="round" paddingX={1}>
				<TextInput
					key={inputKey}
					showCursor={!isDisabled}
					value={message}
					placeholder={
						isDisabled
							? 'Selection mode active - use j/k to navigate, Esc to exit'
							: 'Type a message, : for commands, or # for files'
					}
					onChange={isDisabled ? () => {} : handleInputChange}
					// OnSubmit is now handled by the master useInput hook
					onSubmit={() => {}}
				/>
			</Box>
			{autocomplete.isActive && (
				<AutocompleteView
					suggestions={autocomplete.suggestions}
					selectedIndex={autocomplete.selectedIndex}
				/>
			)}
		</Box>
	);
}
