import React, {useState, useEffect} from 'react';
import {Box, useInput} from 'ink';
import TextInput from 'ink-text-input';
import {getFilePathSuggestions} from '../../utils/autocomplete.js';
import {AutocompleteView} from './autocomplete-view.js';

type InputBoxProperties = {
	readonly onSend: (message: string) => void;
	readonly isDisabled?: boolean;
};

type AutocompleteState = {
	readonly isActive: boolean;
	readonly suggestions: readonly string[];
	readonly selectedIndex: number;
	readonly triggerIndex: number; // Position where the trigger starts
	readonly query: string;
};

const initialAutocompleteState: AutocompleteState = {
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
		const textBefore = message.slice(0, autocomplete.triggerIndex);
		const newMessage = `${textBefore}@${suggestion}`;
		setMessage(newMessage);
		setAutocomplete(initialAutocompleteState);
		// Force re-mount of TextInput to ensure cursor is at the end
		setInputKey(previous => previous + 1);
	};

	// Effect to fetch suggestions when the query changes
	useEffect(() => {
		if (!autocomplete.isActive) {
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
	}, [autocomplete.isActive, autocomplete.query]);

	const handleInputChange = (value: string) => {
		setMessage(value);

		// Regex to find " @<query>" at the end of the string
		const triggerRegex = /\s@(\S*)$/;
		const match = triggerRegex.exec(value);

		if (match && typeof match.index === 'number') {
			const query = match[1] ?? '';
			// The trigger index is the position of the '@'
			const triggerIndex = match.index + 1;
			setAutocomplete({
				isActive: true,
				query,
				triggerIndex,
				suggestions: autocomplete.suggestions, // Keep existing suggestions for a moment
				selectedIndex: 0,
			});
		} else if (autocomplete.isActive) {
			// If the pattern no longer matches, deactivate autocomplete
			setAutocomplete(initialAutocompleteState);
		}
	};

	// This single useInput hook handles all key presses, creating a clear priority
	useInput((_input, key) => {
		if (isDisabled) {
			return;
		}

		// Priority 1: Autocomplete handling, consumes events if active
		if (autocomplete.isActive && autocomplete.suggestions.length > 0) {
			if (key.upArrow) {
				setAutocomplete(previous => ({
					...previous,
					selectedIndex:
						(previous.selectedIndex - 1 + previous.suggestions.length) %
						previous.suggestions.length,
				}));
				return;
			}

			if (key.downArrow) {
				setAutocomplete(previous => ({
					...previous,
					selectedIndex:
						(previous.selectedIndex + 1) % previous.suggestions.length,
				}));
				return;
			}

			if (key.escape) {
				setAutocomplete(initialAutocompleteState);
				return;
			}

			if (key.tab || key.return) {
				const selectedSuggestion =
					autocomplete.suggestions[autocomplete.selectedIndex];
				if (selectedSuggestion) {
					handleAutocompleteSelection(selectedSuggestion);
				}

				return;
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
							: 'Type a message and press Enter to send... (try " @<path>")'
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
