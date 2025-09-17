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
					'Available commands: :help, :echo <text>, :k (scroll up), :j (scroll down)',
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

export function parseAndDispatchChatCommand(
	text: string,
	context: ChatCommandContext,
): boolean {
	if (!text.startsWith(':')) return false;
	const [cmd, ...arguments_] = text.slice(1).split(/\s+/);
	const handler = chatCommands[cmd!];
	if (handler) {
		void handler(arguments_, context);
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
