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

export const description =
	'Read messages from a thread, optionally marking as seen or downloading media';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'thread',
			description: 'Thread ID, username, or thread title',
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
	markSeen: zod
		.boolean()
		.default(false)
		.describe(
			option({
				description: 'Mark thread as seen after reading',
			}),
		),
	download: zod
		.string()
		.optional()
		.describe(
			option({
				description: 'Download media from a message to this file path',
			}),
		),
	messageId: zod
		.string()
		.optional()
		.describe(
			option({
				description: 'Message ID to download (use with --download)',
			}),
		),
	maxPages: zod
		.number()
		.optional()
		.describe(
			option({
				description:
					'Maximum pagination pages when searching for a message (use with --download)',
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
			const isJson = options.output === 'json';

			const {threadId} = await resolveThread(client, query);

			// Download mode: find a specific message and download its media
			if (options.download) {
				if (!options.messageId) {
					throw new Error(
						'--message-id <id> is required when using --download',
					);
				}

				let message;
				let cursor: string | undefined;
				let pages = 0;
				const maxPages = options.maxPages ?? 10;

				do {
					// eslint-disable-next-line no-await-in-loop
					const result = await client.getMessages(threadId, cursor);
					message = result.messages.find(m => m.id === options.messageId);
					if (message) break;
					cursor = result.cursor;
					pages++;
				} while (cursor && pages < maxPages);

				if (!message) {
					throw new Error(
						`Message ${options.messageId} not found within ${maxPages} pages. The message may be too old or the ID may be invalid.`,
					);
				}

				const savedPath = await client.downloadMediaFromMessage(
					message,
					options.download,
				);

				if (isJson) {
					outputJson(
						jsonSuccess({
							threadId,
							messageId: options.messageId,
							path: savedPath,
							downloaded: true,
						}),
					);
				} else {
					outputText(`Media downloaded to ${savedPath}`);
				}

				return;
			}

			// Read mode: fetch and display messages
			const {messages, cursor: nextCursor} = await client.getMessages(
				threadId,
				options.cursor,
			);
			const limited = messages.slice(0, options.limit);

			// Mark as seen using the most recent message
			if (options.markSeen && limited.length > 0) {
				const mostRecentId = limited[0]!.id;
				await client.markThreadAsSeen(threadId, mostRecentId);
			}

			if (isJson) {
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
						markedSeen: options.markSeen && limited.length > 0,
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

			if (options.markSeen && limited.length > 0) {
				outputText(`Thread marked as seen.`);
			}

			if (nextCursor) {
				outputText(`\nMore messages available. Use --cursor=${nextCursor}`);
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
