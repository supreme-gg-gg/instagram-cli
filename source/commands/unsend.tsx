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

export const description = 'Unsend a message';

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
			description: 'ID of the message to unsend',
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

export default function Unsend({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const [threadQuery, messageId] = commandArgs;
			const isJson = options.output === 'json';

			const threadId = await resolveThread(client, threadQuery);

			await client.unsendMessage(threadId, messageId);

			if (isJson) {
				outputJson(jsonSuccess({threadId, messageId, unsent: true}));
			} else {
				outputText(`Message ${messageId} unsent.`);
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
