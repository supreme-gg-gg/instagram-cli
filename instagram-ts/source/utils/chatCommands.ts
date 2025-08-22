import type {InstagramClient} from '../client.js';
import type {ChatState, Message} from '../types/instagram.js';

export interface ChatCommandContext {
	client: InstagramClient;
	chatState: ChatState;
	setChatState: React.Dispatch<React.SetStateAction<ChatState>>;
	height: number;
}

export type ChatCommandHandler = (
	args: string[],
	ctx: ChatCommandContext,
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
	help: async (_args, ctx) => {
		ctx.setChatState(prev => ({
			...prev,
			messages: [
				...prev.messages,
				systemMessage(
					'Available commands: :help, :echo <text>, :k (scroll up), :j (scroll down)',
					prev.currentThread?.id ?? '',
				),
			],
		}));
	},
	echo: async (args, ctx) => {
		ctx.setChatState(prev => ({
			...prev,
			messages: [
				...prev.messages,
				systemMessage(args.join(' '), prev.currentThread?.id ?? ''),
			],
		}));
	},
	k: async (_args, {client, chatState, setChatState, height}) => {
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
				setChatState(prev => ({...prev, loading: true}));
				const {messages, cursor} = await client.getMessages(
					chatState.currentThread.id,
					chatState.messageCursor,
				);
				setChatState(prev => ({
					...prev,
					messages: [...messages, ...prev.messages],
					loading: false,
					messageCursor: cursor,
					// Keep the user roughly at the same message
					visibleMessageOffset: prev.visibleMessageOffset + messages.length,
				}));
			} catch (error) {
				setChatState(prev => ({
					...prev,
					error:
						error instanceof Error ? error.message : 'Failed to load messages',
					loading: false,
				}));
			}
		} else {
			setChatState(prev => ({
				...prev,
				visibleMessageOffset: Math.min(
					maxOffset,
					// move up by 5 messages
					prev.visibleMessageOffset + 5,
				),
			}));
		}
	},
	j: async (_args, {setChatState}) => {
		setChatState(prev => ({
			...prev,
			// move down by 5 messages, but not below 0
			visibleMessageOffset: Math.max(0, prev.visibleMessageOffset - 5),
		}));
	},
};

export function parseAndDispatchChatCommand(
	text: string,
	ctx: ChatCommandContext,
): boolean {
	if (!text.startsWith(':')) return false;
	const [cmd, ...args] = text.slice(1).split(/\s+/);
	const handler = chatCommands[cmd as keyof typeof chatCommands];
	if (handler) {
		handler(args, ctx);
	} else {
		ctx.setChatState(prev => ({
			...prev,
			messages: [
				...prev.messages,
				systemMessage(`Unknown command: :${cmd}`, prev.currentThread?.id ?? ''),
			],
		}));
	}
	return true;
}
