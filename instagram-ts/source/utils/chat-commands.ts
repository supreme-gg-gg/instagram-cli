import type {InstagramClient} from '../client.js';
import type {ChatState} from '../types/instagram.js';
import type {ScrollViewRef} from '../ui/components/scroll-view.js';

export type ChatCommandContext = {
	readonly client: InstagramClient;
	readonly chatState: ChatState;
	readonly setChatState: React.Dispatch<React.SetStateAction<ChatState>>;
	readonly height: number;
	readonly scrollViewRef: React.RefObject<ScrollViewRef>;
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
	help: {
		description: 'Show available commands. Usage: :help',
		handler() {
			return 'Available commands: :help, :select, :react, :unsend, :upload, :k, :j';
		},
	},
	echo: {
		description:
			'Prints the given arguments back as a system message. Usage: :echo [text]',
		handler(arguments_) {
			return arguments_.join(' ');
		},
	},
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
	react: {
		description: 'React to the selected message. Usage: :react [emoji]',
		async handler(arguments_, {client, chatState, setChatState}) {
			const [emoji = '❤️'] = arguments_;

			if (chatState.selectedMessageIndex === undefined) {
				return 'Usage: :select to enter selection mode first.';
			}

			const messageToReactTo =
				chatState.messages[chatState.selectedMessageIndex];
			if (!messageToReactTo || !chatState.currentThread) {
				return;
			}

			await client.sendReaction(
				chatState.currentThread.id,
				messageToReactTo.id,
				emoji,
			);

			setChatState(previous => ({
				...previous,
				selectedMessageIndex: undefined,
			}));

			// eslint-disable-next-line no-useless-return
			return;
		},
	},
	upload: {
		description:
			'Upload a photo or video to the current thread. Usage: :upload <path>',
		async handler(arguments_, {client, chatState}) {
			const [path] = arguments_;
			if (!path) {
				return 'Usage: :upload <path-to-file>';
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
			// eslint-disable-next-line no-useless-return
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

			// eslint-disable-next-line no-useless-return
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

			// eslint-disable-next-line no-useless-return
			return;
		},
	},
};

export async function parseAndDispatchChatCommand(
	text: string,
	context: ChatCommandContext,
): Promise<{isCommand: boolean; systemMessage: string | undefined}> {
	if (!text.startsWith(':')) {
		return {isCommand: false, systemMessage: undefined};
	}

	const [cmd, ...arguments_] = text.slice(1).split(/\s+/);
	const command = chatCommands[cmd!];
	let systemMessage: string | undefined;

	if (command) {
		try {
			const result = await command.handler(arguments_, context);
			if (typeof result === 'string') {
				systemMessage = result;
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'An unknown error occurred';
			systemMessage = `Error in command :${cmd}: ${errorMessage}`;
		}
	} else {
		systemMessage = `Unknown command: :${cmd}`;
	}

	return {isCommand: true, systemMessage};
}
