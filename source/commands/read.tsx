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

export const description = 'Read messages from a thread';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'thread',
			description: 'Username or thread title to read messages from',
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
	limit: zod
		.number()
		.default(20)
		.describe(
			option({
				alias: 'l',
				description: 'Maximum number of messages to show',
			}),
		),
	cursor: zod
		.string()
		.optional()
		.describe(
			option({
				description: 'Pagination cursor from a previous request',
			}),
		),
});

type Properties = {
	readonly args: zod.infer<typeof args>;
	readonly options: zod.infer<typeof options>;
};

export default function Read({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const query = commandArgs[0];
			let threadId: string | undefined;

			try {
				const resolved = await resolveRecipient(client, query);
				threadId = resolved.threadId;
			} catch {
				// resolveRecipient throws when username not found — fall through to title search
			}

			if (!threadId) {
				const titleResults = await client.searchThreadsByTitle(query);
				if (titleResults.length > 0 && titleResults[0]) {
					threadId = titleResults[0].thread.id;
				}
			}

			if (!threadId) {
				throw new Error(`No thread found matching "${query}"`);
			}

			const {messages, cursor: nextCursor} = await client.getMessages(
				threadId,
				options.cursor,
			);
			const limited = messages.slice(0, options.limit);

			if (options.json) {
				outputJson(
					jsonSuccess({
						threadId,
						messages: limited.map(m => ({
							id: m.id,
							itemType: m.itemType,
							text: 'text' in m ? m.text : undefined,
							media:
								m.itemType === 'media' && 'media' in m
									? {id: m.media.id, mediaType: m.media.media_type}
									: undefined,
							userId: m.userId,
							username: m.username,
							timestamp: m.timestamp,
							isOutgoing: m.isOutgoing,
						})),
						cursor: nextCursor,
					}),
				);
				return;
			}

			if (limited.length === 0) {
				outputText('No messages found.');
				return;
			}

			for (const m of limited) {
				const time = m.timestamp.toLocaleTimeString();
				const text = 'text' in m ? m.text : `[${m.itemType}]`;
				outputText(`[${time}] ${m.username}: ${text}`);
			}

			if (nextCursor) {
				outputText(`\nMore messages available. Use --cursor=${nextCursor}`);
			}
		},
		[commandArgs, options.json, options.limit, options.cursor],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
