import React, {useCallback} from 'react';
import zod from 'zod';
import {argument, option} from 'pastel';
import {
	OneTurnCommand,
	outputJson,
	jsonSuccess,
	outputText,
	resolveThread,
} from '../utils/one-turn.js';
import {type InstagramClient} from '../client.js';

export const description = 'Reply to a specific message in a thread';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'thread',
			description: 'Username or thread title',
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
	output: zod
		.string()
		.optional()
		.describe(
			option({
				alias: 'o',
				description: 'Output format (json)',
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
			const [threadQuery, messageId, text] = commandArgs;
			const isJson = options.output === 'json';

			const threadId = await resolveThread(client, threadQuery);

			let replyToMessage;
			let cursor: string | undefined;
			const maxPages = 10;
			let pages = 0;
			do {
				// eslint-disable-next-line no-await-in-loop
				const result = await client.getMessages(threadId, cursor);
				replyToMessage = result.messages.find(m => m.id === messageId);
				if (replyToMessage) break;
				cursor = result.cursor;
				pages++;
			} while (cursor && pages < maxPages);

			if (!replyToMessage) {
				throw new Error(
					`Message ${messageId} not found within ${maxPages} pages. The message may be too old or the ID may be invalid.`,
				);
			}

			const replyMessageId = await client.sendReply(
				threadId,
				text,
				replyToMessage,
			);

			if (isJson) {
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
		[commandArgs, options],
	);

	return (
		<OneTurnCommand
			username={options.username}
			output={options.output}
			run={run}
		/>
	);
}
