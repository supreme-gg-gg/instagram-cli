import type {InstagramClient} from '../client.js';
import type {ChatState, Message} from '../types/instagram.js';

export type ChatCommandContext = {
	client: InstagramClient;
	chatState: ChatState;
	setChatState: React.Dispatch<React.SetStateAction<ChatState>>;
	height: number;
};

export type ChatCommandHandler = (
	arguments_: string[],
	context: ChatCommandContext,
) => Promise<void> | void;

// This message is added to the messages list
// in the future we will implement an overlay screen like python client
// NOTE: system messages will disappear after a few seconds because of client refetch
function systemMessage(text: string, threadId: string): Message {
	return {
		id: `sys-${Date.now()}`,
		text,
		itemType: 'text',
		userId: 'system',
		username: 'System',
		isOutgoing: false,
		threadId,
		timestamp: new Date(),
	};
}

export const chatCommands: Record<string, ChatCommandHandler> = {
	async help(_arguments, context) {
		context.setChatState(previous => ({
			...previous,
			messages: [
				...previous.messages,
				systemMessage(
					'Available commands: :help, :react, :upload, :unsend, :k (scroll up), :j (scroll down)',
					previous.currentThread?.id ?? '',
				),
			],
		}));
	},
	async echo(arguments_, context) {
		context.setChatState(previous => ({
			...previous,
			messages: [
				...previous.messages,
				systemMessage(arguments_.join(' '), previous.currentThread?.id ?? ''),
			],
		}));
	},

	// If you try to send reaction without MQTT connected, it will show you the error message
	async react(arguments_, {client, chatState, setChatState}) {
		const [indexString, emoji = '❤️'] = arguments_;
		const index = Number.parseInt(indexString!, 10) - 1;

		if (
			Number.isNaN(index) ||
			index < 0 ||
			index >= chatState.messages.length
		) {
			setChatState(previous => ({
				...previous,
				messages: [
					...previous.messages,
					systemMessage(
						'Usage: :react <message-index> [emoji], 0 is the latest message',
						previous.currentThread?.id ?? '',
					),
				],
			}));
			return;
		}

		const messageToReactTo =
			chatState.messages[chatState.messages.length - 1 - index];
		if (!messageToReactTo || !chatState.currentThread) return;

		try {
			await client.sendReaction(
				chatState.currentThread.id,
				messageToReactTo.id,
				emoji,
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Could not send reaction.';
			setChatState(previous => ({
				...previous,
				messages: [
					...previous.messages,
					systemMessage(errorMessage, previous.currentThread?.id ?? ''),
				],
			}));
		}
	},

	async upload(arguments_, {client, chatState, setChatState}) {
		const [path] = arguments_;
		if (!path) {
			setChatState(previous => ({
				...previous,
				messages: [
					...previous.messages,
					systemMessage(
						'Usage: :upload <path-to-file>',
						previous.currentThread?.id ?? '',
					),
				],
			}));
			return;
		}

		// Detect the file type to determine if we should send as photo or video
		const lowerPath = path.toLowerCase();
		const isImage = /\.(jpg|jpeg|png|gif)$/.test(lowerPath);
		const isVideo = /\.(mp4|mov|avi|mkv)$/.test(lowerPath);

		if (chatState.currentThread) {
			if (isImage) {
				await client.sendPhoto(chatState.currentThread.id, path);
			} else if (isVideo) {
				await client.sendVideo(chatState.currentThread.id, path);
			} else {
				setChatState(previous => ({
					...previous,
					messages: [
						...previous.messages,
						systemMessage(
							'Unsupported file type. Please upload an image or video.',
							previous.currentThread?.id ?? '',
						),
					],
				}));
			}
		}
	},

	async unsend(arguments_, {client, chatState, setChatState}) {
		const [indexString] = arguments_;
		const index = Number.parseInt(indexString!, 10) - 1;

		if (
			Number.isNaN(index) ||
			index < 0 ||
			index >= chatState.messages.length
		) {
			setChatState(previous => ({
				...previous,
				messages: [
					...previous.messages,
					systemMessage(
						'Usage: :unsend <message-index>, 0 is the latest message',
						previous.currentThread?.id ?? '',
					),
				],
			}));
			return;
		}

		const messageToUnsend =
			chatState.messages[chatState.messages.length - 1 - index];

		if (!messageToUnsend?.isOutgoing) {
			setChatState(previous => ({
				...previous,
				messages: [
					...previous.messages,
					systemMessage(
						'You can only unsend your own messages.',
						previous.currentThread?.id ?? '',
					),
				],
			}));
			return;
		}

		if (chatState.currentThread) {
			await client.unsendMessage(
				chatState.currentThread.id,
				messageToUnsend.id,
			);
			// Optimistic update
			setChatState(previous => ({
				...previous,
				messages: previous.messages.filter(m => m.id !== messageToUnsend.id),
			}));
		}
	},

	async k(_arguments, {client, chatState, setChatState, height}) {
		const messageLines = 3; // Approximate lines per message
		const visibleMessageCount = Math.max(
			0,
			Math.floor((height - 8) / messageLines),
		);
		const totalMessages = chatState.messages.length;
		const maxOffset = Math.max(0, totalMessages - visibleMessageCount);

		// If we are at the bottom of the chat, load more messages
		if (chatState.visibleMessageOffset >= maxOffset) {
			if (!client || !chatState.currentThread || !chatState.messageCursor) {
				return; // No more messages to load
			}

			try {
				setChatState(previous => ({...previous, loading: true}));
				const {messages, cursor} = await client.getMessages(
					chatState.currentThread.id,
					chatState.messageCursor,
				);
				setChatState(previous => ({
					...previous,
					messages: [...messages, ...previous.messages],
					loading: false,
					messageCursor: cursor,
					// Keep the user roughly at the same message
					visibleMessageOffset: previous.visibleMessageOffset + messages.length,
				}));
			} catch (error) {
				setChatState(previous => ({
					...previous,
					error:
						error instanceof Error ? error.message : 'Failed to load messages',
					loading: false,
				}));
			}
		} else {
			setChatState(previous => ({
				...previous,
				visibleMessageOffset: Math.min(
					maxOffset,
					// Move up by 5 messages
					previous.visibleMessageOffset + 5,
				),
			}));
		}
	},
	async j(_arguments, {setChatState}) {
		setChatState(previous => ({
			...previous,
			// Move down by 5 messages, but not below 0
			visibleMessageOffset: Math.max(0, previous.visibleMessageOffset - 5),
		}));
	},
};

export async function parseAndDispatchChatCommand(
	text: string,
	context: ChatCommandContext,
): Promise<boolean> {
	if (!text.startsWith(':')) return false;

	const [cmd, ...arguments_] = text.slice(1).split(/\s+/);
	const handler = chatCommands[cmd!];

	if (handler) {
		try {
			await handler(arguments_, context);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'An unknown error occurred';
			context.setChatState(previous => ({
				...previous,
				messages: [
					...previous.messages,
					systemMessage(
						`Error in command :${cmd}: ${errorMessage}`,
						previous.currentThread?.id ?? '',
					),
				],
			}));
		}
	} else {
		context.setChatState(previous => ({
			...previous,
			messages: [
				...previous.messages,
				systemMessage(
					`Unknown command: :${cmd}`,
					previous.currentThread?.id ?? '',
				),
			],
		}));
	}

	return true;
}
