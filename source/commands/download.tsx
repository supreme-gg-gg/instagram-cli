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
			description: 'ID of the message with media to download',
		}),
	),
	zod.string().describe(
		argument({
			name: 'output-path',
			description: 'File path to save the downloaded media',
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

export default function Download({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const [threadId, messageId, outputPath] = commandArgs;

			const {messages} = await client.getMessages(threadId);
			const message = messages.find(m => m.id === messageId);

			if (!message) {
				throw new Error(`Message ${messageId} not found in thread ${threadId}`);
			}

			const savedPath = await client.downloadMediaFromMessage(
				message,
				outputPath,
			);

			if (options.json) {
				outputJson(
					jsonSuccess({threadId, messageId, path: savedPath, downloaded: true}),
				);
			} else {
				outputText(`Media downloaded to ${savedPath}`);
			}
		},
		[commandArgs, options.json],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
