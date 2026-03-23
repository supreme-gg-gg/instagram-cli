import React, {useCallback} from 'react';
import zod from 'zod';
import {argument, option} from 'pastel';
import {
	OneTurnCommand,
	outputJson,
	jsonSuccess,
	outputText,
	resolveRecipient,
} from '../utils/one-turn.js';
import {type InstagramClient} from '../client.js';

export const description = 'Send a text message to a user';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'recipient',
			description: 'Username of the recipient',
		}),
	),
	zod.string().describe(
		argument({
			name: 'message',
			description: 'Message text to send',
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

export default function Send({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const [recipient, message] = commandArgs;

			const {threadId} = await resolveRecipient(client, recipient);
			const messageId = await client.sendMessage(threadId, message);

			if (options.json) {
				outputJson(jsonSuccess({threadId, recipient, messageId, sent: true}));
			} else {
				outputText(`Message sent to @${recipient}`);
			}
		},
		[commandArgs, options.json],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
