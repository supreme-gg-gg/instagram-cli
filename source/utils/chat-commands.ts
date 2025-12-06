import type {InstagramClient} from '../client.js';
import type {ChatState} from '../types/instagram.js';
import type {ScrollViewRef} from '../ui/components/scroll-view.js';
import {preprocessMessage} from './preprocess.js';
import {createContextualLogger} from './logger.js';
import {getEmojiByName} from './emoji.js';

const logger = createContextualLogger('ChatCommands');

export type ChatCommandContext = {
	readonly client: InstagramClient;
	readonly chatState: ChatState;
	readonly setChatState: React.Dispatch<React.SetStateAction<ChatState>>;
	readonly height: number;
	readonly scrollViewRef: React.RefObject<ScrollViewRef | undefined>;
};

// Handler will return a system message when needed, or void otherwise
export type ChatCommandHandler = (
	arguments_: readonly string[],
	context: ChatCommandContext,
) => Promise<string | void> | string | void;

export type ChatCommand = {
	readonly description: string;
	readonly handler: ChatCommandHandler;
};

export const chatCommands: Record<string, ChatCommand> = {
	select: {
		description:
			'Enter message selection mode to react or unsend. Usage: :select',
		handler(_arguments, {setChatState, chatState}) {
			if (chatState.messages.length === 0) {
				return 'No messages to select from.';
			}

			setChatState(previous => ({
				...previous,
				isSelectionMode: true,
				selectedMessageIndex: previous.messages.length - 1,
			}));
			return 'Entered selection mode. Use j/k to navigate.';
		},
	},
	reply: {
		description: 'Reply to the selected message. Usage: :reply [text]',
		async handler(
			arguments_,
			{client, chatState, setChatState, scrollViewRef},
		) {
			if (chatState.selectedMessageIndex === undefined) {
				return 'Usage: select message to reply to first with :select command.';
			}

			const text = arguments_.join(' ');
			if (!text) {
				return 'Usage: :reply <text>';
			}

			const messageToReplyTo =
				chatState.messages[chatState.selectedMessageIndex];
			if (!messageToReplyTo || !chatState.currentThread) {
				return;
			}

			// Preprocess the reply text to handle emojis and file references
			const processedText = await preprocessMessage(text, {
				client,
				threadId: chatState.currentThread.id,
			});

			if (processedText) {
				await client.sendReply(
					chatState.currentThread.id,
					processedText,
					messageToReplyTo,
				);
			}

			// Scroll to bottom after sending a reply
			if (scrollViewRef.current) {
				scrollViewRef.current.scrollToEnd(true);
			}

			setChatState(previous => ({
				...previous,
				selectedMessageIndex: undefined,
			}));

			return;
		},
	},
	react: {
		description:
			'React to the selected message. Usage: :react [emoji|:emoji_name:]',
		async handler(arguments_, {client, chatState, setChatState}) {
			let [emojiInput = '❤️'] = arguments_;

			if (chatState.selectedMessageIndex === undefined) {
				return 'Usage: :select to enter selection mode first.';
			}

			const messageToReactTo =
				chatState.messages[chatState.selectedMessageIndex];
			if (!messageToReactTo || !chatState.currentThread) {
				return;
			}

			// Check if input is in :emoji_name: format and convert it
			if (emojiInput.startsWith(':') && emojiInput.endsWith(':')) {
				const emojiName = emojiInput.slice(1, -1);
				const convertedEmoji = getEmojiByName(emojiName);
				if (convertedEmoji) {
					emojiInput = convertedEmoji;
				} else {
					return `Unknown emoji name: ${emojiName}`;
				}
			}

			await client.sendReaction(
				chatState.currentThread.id,
				messageToReactTo.id,
				emojiInput,
			);

			setChatState(previous => ({
				...previous,
				selectedMessageIndex: undefined,
			}));

			return;
		},
	},
	upload: {
		description:
			'Upload a photo or video to the current thread. Usage: :upload <path>',
		async handler(arguments_, {client, chatState}) {
			let [path] = arguments_;
			if (!path) {
				return 'Usage: :upload <path-to-file>';
			}

			// Remove '#' prefix if present (from autocomplete)
			if (path.startsWith('#')) {
				path = path.slice(1);
			}

			const lowerPath = path.toLowerCase();
			const isImage = /\.(jpg|jpeg|png|gif)$/.test(lowerPath);
			const isVideo = /\.(mp4|mov|avi|mkv)$/.test(lowerPath);

			if (!chatState.currentThread) {
				return;
			}

			if (isImage) {
				await client.sendPhoto(chatState.currentThread.id, path);
				return `Image uploaded: ${path}`;
			}

			if (isVideo) {
				await client.sendVideo(chatState.currentThread.id, path);
				return `Video uploaded: ${path}`;
			}

			return 'Unsupported file type. Please upload an image or video.';
		},
	},
	unsend: {
		description: 'Unsend the selected message. Usage: :unsend',
		async handler(_arguments, {client, chatState, setChatState}) {
			if (chatState.selectedMessageIndex === undefined) {
				return 'Usage: :select to enter selection mode first.';
			}

			const messageToUnsend =
				chatState.messages[chatState.selectedMessageIndex];

			if (!messageToUnsend?.isOutgoing) {
				return 'You can only unsend your own messages.';
			}

			if (!chatState.currentThread) {
				return;
			}

			await client.unsendMessage(
				chatState.currentThread.id,
				messageToUnsend.id,
			);
			setChatState(previous => ({
				...previous,
				messages: previous.messages.filter(m => m.id !== messageToUnsend.id),
				selectedMessageIndex: undefined,
			}));
			return;
		},
	},
	k: {
		description: 'Scroll up in the message history. Usage: :k',
		async handler(_arguments, {height, scrollViewRef}) {
			if (!scrollViewRef.current) {
				return 'ScrollView not available.';
			}

			const scrollAmount = Math.max(1, height * 0.75);
			scrollViewRef.current.scrollTo(curr => curr - scrollAmount);

			return;
		},
	},
	j: {
		description: 'Scroll down in the message history. Usage: :j',
		handler(_arguments, {height, scrollViewRef}) {
			if (!scrollViewRef.current) {
				return 'ScrollView not available.';
			}

			const scrollAmount = Math.max(1, height * 0.75);

			scrollViewRef.current.scrollTo(curr => curr + scrollAmount);

			return;
		},
	},
	K: {
		description: 'Scroll to the top of the message history. Usage: :K',
		handler(_arguments, {scrollViewRef}) {
			if (!scrollViewRef.current) {
				return 'ScrollView not available.';
			}

			scrollViewRef.current.scrollToStart(false); // Don't load earlier messages

			return;
		},
	},
	J: {
		description: 'Scroll to the bottom of the message history. Usage: :J',
		handler(_arguments, {scrollViewRef}) {
			if (!scrollViewRef.current) {
				return 'ScrollView not available.';
			}

			scrollViewRef.current.scrollToEnd(false); // Don't show scroll to bottom message

			return;
		},
	},
};

export async function parseAndDispatchChatCommand(
	text: string,
	context: ChatCommandContext,
): Promise<{
	isCommand: boolean;
	systemMessage: string | undefined;
	processedText?: string;
}> {
	if (!text.startsWith(':')) {
		return {isCommand: false, systemMessage: undefined};
	}

	// Allow sending a literal ':' by escaping with '::'
	// Convert '::text' to ':text' and treat as a regular message
	if (text.startsWith('::')) {
		return {
			isCommand: false,
			systemMessage: undefined,
			processedText: text.slice(1), // Strip one ':'
		};
	}

	const [cmd, ...arguments_] = text.slice(1).split(/\s+/);
	const command = chatCommands[cmd!];
	let systemMessage: string | undefined;

	if (command) {
		logger.debug(`Executing chat command: ${cmd}`);
		try {
			const result = await command.handler(arguments_, context);
			if (typeof result === 'string') {
				systemMessage = result;
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'An unknown error occurred';
			logger.error(`Command :${cmd} failed: ${errorMessage}`, error);
			systemMessage = `Error in command :${cmd}: ${errorMessage}`;
		}
	} else {
		systemMessage = `Unknown command: :${cmd}`;
	}

	return {isCommand: true, systemMessage};
}
