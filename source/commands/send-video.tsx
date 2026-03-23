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
			name: 'recipient',
			description: 'Username of the recipient',
		}),
	),
	zod.string().describe(
		argument({
			name: 'filepath',
			description: 'Path to the video file',
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

export default function SendVideo({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const [recipient, filepath] = commandArgs;

			const results = await client.searchThreadByUsername(recipient, {
				forceExact: true,
			});
			if (results.length === 0 || !results[0]) {
				throw new Error(`User "${recipient}" not found`);
			}

			const {thread} = results[0];
			let threadId = thread.id;
			if (threadId.startsWith('PENDING_')) {
				const userPk = threadId.replace('PENDING_', '');
				const realThread = await client.ensureThread(userPk);
				threadId = realThread.id;
			}

			await client.sendVideo(threadId, filepath);

			if (options.json) {
				outputJson(jsonSuccess({threadId, recipient, filepath, sent: true}));
			} else {
				outputText(`Video sent to @${recipient}`);
			}
		},
		[commandArgs, options.json],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
