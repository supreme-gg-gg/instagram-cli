import type {InstagramClient} from '../../client.js';
import type {ChatState} from '../../types/instagram.js';

export interface ChatCommandContext {
	client: InstagramClient;
	chatState: ChatState;
	setChatState: React.Dispatch<React.SetStateAction<ChatState>>;
}

export type ChatCommandHandler = (
	args: string[],
	ctx: ChatCommandContext,
) => Promise<void> | void;

function systemMessage(
	text: string,
	threadId: string,
): import('../../types/instagram.js').Message {
	return {
		id: `sys-${Date.now()}`,
		text,
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
					'Available commands: :help, :echo <text>',
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
