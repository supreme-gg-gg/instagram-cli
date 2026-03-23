import React, {useCallback} from 'react';
import zod from 'zod';
import {option} from 'pastel';
import {
	OneTurnCommand,
	outputJson,
	jsonSuccess,
	outputText,
} from '../utils/one-turn.js';
import {type InstagramClient} from '../client.js';

export const description = 'List inbox threads';

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
	limit: zod
		.number()
		.default(20)
		.describe(
			option({
				alias: 'l',
				description: 'Maximum number of threads to show',
			}),
		),
});

type Properties = {
	readonly options: zod.infer<typeof options>;
};

export default function Inbox({options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const {threads} = await client.getThreads();
			const limited = threads.slice(0, options.limit);

			if (options.json) {
				outputJson(
					jsonSuccess(
						limited.map(t => ({
							id: t.id,
							title: t.title,
							users: t.users,
							lastMessage: t.lastMessage
								? {
										id: t.lastMessage.id,
										itemType: t.lastMessage.itemType,
										text:
											'text' in t.lastMessage ? t.lastMessage.text : undefined,
										timestamp: t.lastMessage.timestamp,
									}
								: undefined,
							lastActivity: t.lastActivity,
							unread: t.unread,
						})),
					),
				);
				return;
			}

			if (limited.length === 0) {
				outputText('No threads found.');
				return;
			}

			for (const t of limited) {
				const unreadTag = t.unread ? ' [UNREAD]' : '';
				const preview =
					t.lastMessage && 'text' in t.lastMessage
						? ` — ${t.lastMessage.text}`
						: '';
				outputText(`${t.title}${unreadTag}${preview}`);
				outputText(`  ID: ${t.id}`);
			}
		},
		[options.json, options.limit],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
