import React, {useState, useEffect} from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import type {InstagramClient} from '../../client.js';
import type {ChatState} from '../../types/instagram.js';
import {
	getFilePathSuggestions,
	getCommandSuggestions,
} from '../../utils/autocomplete.js';
import {parseAndDispatchChatCommand} from '../../utils/chat-commands.js';
import {preprocessMessage} from '../../utils/preprocess.js';
import {AutocompleteView} from './autocomplete-view.js';

type InputBoxProperties = {
	readonly isDisabled?: boolean;
	readonly client: InstagramClient;
	readonly chatState: ChatState;
	readonly setChatState: React.Dispatch<React.SetStateAction<ChatState>>;
	readonly height: number;
};

type AutocompleteState = {
	readonly type: 'command' | 'filePath' | undefined;
	readonly isActive: boolean;
	readonly suggestions: readonly string[];
	readonly selectedIndex: number;
	readonly triggerIndex: number;
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
	isDisabled = false,
	client,
	chatState,
	setChatState,
	height,
}: InputBoxProperties) {
	const [message, setMessage] = useState('');
	const [autocomplete, setAutocomplete] = useState<AutocompleteState>(
		initialAutocompleteState,
	);
	const [systemMessage, setSystemMessage] = useState<string | undefined>(
		undefined,
	);
	const [inputKey, setInputKey] = useState(0);

	// Effect to clear system messages after a delay
	useEffect(() => {
		if (systemMessage) {
			const timer = setTimeout(() => {
				setSystemMessage(undefined);
			}, 3000); // Clear after 3 seconds
			return () => {
				clearTimeout(timer);
			};
		}
	}, [systemMessage]);

	const handleSubmit = async (text: string) => {
		if (!text.trim() || !client || !chatState.currentThread) {
			return;
		}

		// Reset UI state first
		setMessage('');
		setAutocomplete(initialAutocompleteState);

		const {isCommand, systemMessage: cmdSystemMessage} =
			await parseAndDispatchChatCommand(text, {
				client,
				chatState,
				setChatState,
				height,
			});

		if (cmdSystemMessage) {
			setSystemMessage(cmdSystemMessage);
		}

		if (isCommand) {
			return; // Command was handled
		}

		try {
			const processedText = await preprocessMessage(text, {
				client,
				threadId: chatState.currentThread.id,
			});

			if (processedText) {
				await client.sendMessage(chatState.currentThread.id, processedText);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to send message';
			setSystemMessage(errorMessage);
		}
	};

	const handleAutocompleteSelection = (suggestion: string) => {
		if (autocomplete.type === 'command') {
			const commandName = suggestion.split(' ')[0];
			const newMessage = `:${commandName} `;
			setMessage(newMessage);
		} else if (autocomplete.type === 'filePath') {
			const textBefore = message.slice(0, autocomplete.triggerIndex);
			const newMessage = `${textBefore}#${suggestion}`;
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
		const filePathMatch = /\s#(\S*)$/.exec(value);

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
			const query = filePathMatch[1] ?? '';
			const triggerIndex = filePathMatch.index + 1;
			setAutocomplete(previous => ({
				...previous,
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
			void handleSubmit(message);
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
			{systemMessage ? (
				<Box marginTop={1}>
					<Text color="yellow">{systemMessage}</Text>
				</Box>
			) : (
				autocomplete.isActive && (
					<AutocompleteView
						suggestions={autocomplete.suggestions}
						selectedIndex={autocomplete.selectedIndex}
					/>
				)
			)}
		</Box>
	);
}
