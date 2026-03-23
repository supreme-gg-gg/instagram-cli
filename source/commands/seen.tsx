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
			description: 'Thread ID to mark as read',
		}),
	),
	zod.string().describe(
		argument({
			name: 'item-id',
			description: 'Item ID to mark as seen',
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

export default function Seen({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const [threadId, itemId] = commandArgs;

			await client.markThreadAsSeen(threadId, itemId);

			if (options.json) {
				outputJson(jsonSuccess({threadId, itemId, seen: true}));
			} else {
				outputText(`Thread ${threadId} marked as seen.`);
			}
		},
		[commandArgs, options.json],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
