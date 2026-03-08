import React, {useState, useEffect, useRef, useCallback} from 'react';
import {Box, useInput, type DOMElement, useApp} from 'ink';
import {
	getFilePathSuggestions,
	getCommandSuggestions,
} from '../../utils/autocomplete.js';
import {useMouse} from '../context/mouse-context.js';
import {measureAbsoluteLayout} from '../hooks/use-content-size.js';
import {AutocompleteView} from './autocomplete-view.js';
import TextInput from './text-input.js';

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
	const {exit} = useApp();
	const [message, setMessage] = useState('');
	const [autocomplete, setAutocomplete] = useState<AutocompleteState>(
		initialAutocompleteState,
	);

	// Ref for measuring our own layout for mouse click-to-cursor
	// eslint-disable-next-line @typescript-eslint/no-restricted-types
	const boxRef = useRef<DOMElement | null>(null);

	// Cursor offset state driven by mouse clicks
	const [cursorOffset, setCursorOffset] = useState<
		{offset: number; timestamp: number} | undefined
	>(undefined);

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
			// added auto append of quots.
			const newMessage =
				autocomplete.triggerIndex === 0
					? `#"${suggestion}"`
					: `${textBefore}#"${suggestion}"`;
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
		// modified regex to match files which contains spaces.
		const filePathMatch = /(^(#"|#)([^"#]*)(")?$)|(\s(#"|#)([^#"]*)(")?$)/.exec(
			value,
		);

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
			const query = filePathMatch[3] ?? filePathMatch[7] ?? '';
			const triggerIndex = filePathMatch[3] ? 0 : filePathMatch.index + 1;
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

		// Ctrl+C: clear the input if it has text, otherwise exit the app
		if (key.ctrl && _input === 'c') {
			if (message.length > 0) {
				setMessage('');
				setAutocomplete(initialAutocompleteState);
				setInputKey(previous => previous + 1);
			} else {
				exit();
			}

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

	// Handle mouse click-to-cursor internally
	useMouse(
		useCallback(
			event => {
				if (isDisabled) return false;
				if (event.name !== 'left-press') return false;

				const node = boxRef.current;
				if (!node) return false;

				const clickX = event.col - 1;
				const clickY = event.row - 1;
				const layout = measureAbsoluteLayout(node);

				// The text line is 1 row below the box top (border row)
				const inputTextY = layout.y + 1;
				if (clickY !== inputTextY) return false;

				// Text starts 2 columns in (border + padding)
				const inputTextX = layout.x + 2;
				const cursorPos = Math.max(0, clickX - inputTextX);
				setCursorOffset({offset: cursorPos, timestamp: Date.now()});
				return true;
			},
			[isDisabled],
		),
	);

	return (
		<Box ref={boxRef} flexDirection="column">
			<Box borderStyle="round" paddingX={1}>
				<TextInput
					key={inputKey}
					cursorOffset={cursorOffset}
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
