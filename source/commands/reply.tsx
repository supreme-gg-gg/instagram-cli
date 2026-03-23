import React, {useCallback} from 'react';
import zod from 'zod';
import {argument, option} from 'pastel';
import {
	OneTurnCommand,
	outputJson,
	jsonSuccess,
	outputText,
} from '../utils/one-turn.js';
import {type InstagramClient} from '../client.js';

export const description = 'Reply to a specific message in a thread';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'thread-id',
			description: 'Thread ID containing the message',
		}),
	),
	zod.string().describe(
		argument({
			name: 'message-id',
			description: 'ID of the message to reply to',
		}),
	),
	zod.string().describe(
		argument({
			name: 'text',
			description: 'Reply text',
		}),
	),
]);

export const options = zod.object({
	username: zod
		.string()
		.optional()
		.describe(
			option({
				alias: 'u',
				description: 'Account username to use',
			}),
		),
	json: zod
		.boolean()
		.default(false)
		.describe(
			option({
				description: 'Output as JSON',
			}),
		),
});

type Properties = {
	readonly args: zod.infer<typeof args>;
	readonly options: zod.infer<typeof options>;
};

export default function Reply({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const [threadId, messageId, text] = commandArgs;

			let replyToMessage;
			let cursor: string | undefined;
			do {
				// eslint-disable-next-line no-await-in-loop
				const result = await client.getMessages(threadId, cursor);
				replyToMessage = result.messages.find(m => m.id === messageId);
				if (replyToMessage) break;
				cursor = result.cursor;
			} while (cursor);

			if (!replyToMessage) {
				throw new Error(`Message ${messageId} not found in thread ${threadId}`);
			}

			const replyMessageId = await client.sendReply(
				threadId,
				text,
				replyToMessage,
			);

			if (options.json) {
				outputJson(
					jsonSuccess({
						threadId,
						replyToMessageId: messageId,
						messageId: replyMessageId,
						sent: true,
					}),
				);
			} else {
				outputText(`Reply sent in thread ${threadId}`);
			}
		},
		[commandArgs, options.json],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
