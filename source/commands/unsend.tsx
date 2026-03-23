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

export const description = 'Unsend a message';

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

export default function Unsend({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const [threadId, messageId] = commandArgs;

			await client.unsendMessage(threadId, messageId);

			if (options.json) {
				outputJson(jsonSuccess({threadId, messageId, unsent: true}));
			} else {
				outputText(`Message ${messageId} unsent.`);
			}
		},
		[commandArgs, options.json],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
