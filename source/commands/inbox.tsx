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

export const description = 'List inbox threads, or search threads by title';

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
				description: 'Maximum number of threads to show',
			}),
		),
	search: zod
		.string()
		.optional()
		.describe(
			option({
				description: 'Fuzzy search thread titles instead of listing inbox',
			}),
		),
});

type Properties = {
	readonly options: zod.infer<typeof options>;
};

export default function Inbox({options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const isJson = options.output === 'json';

			if (options.search) {
				// Combined search: username + title, dedup by thread ID
				const [usernameResults, titleResults] = await Promise.all([
					client.searchThreadByUsername(options.search).catch(() => []),
					client.searchThreadsByTitle(options.search, {
						maxThreadsToSearch: options.limit * 4,
					}),
				]);

				const seen = new Set<string>();
				const merged = [...usernameResults, ...titleResults].filter(r => {
					if (seen.has(r.thread.id)) return false;
					seen.add(r.thread.id);
					return true;
				});
				merged.sort((a, b) => b.score - a.score);
				const limited = merged.slice(0, options.limit);

				if (isJson) {
					outputJson(
						jsonSuccess(
							limited.map(r => ({
								id: r.thread.id,
								title: r.thread.title,
								users: r.thread.users.map(u => u.username),
								score: r.score,
								lastActivity: r.thread.lastActivity,
							})),
						),
					);
					return;
				}

				if (limited.length === 0) {
					outputText(`No threads matching "${options.search}".`);
					return;
				}

				for (const r of limited) {
					const score = Math.round(r.score * 100);
					outputText(`${r.thread.title} (${score}% match)`);
					outputText(`  ID: ${r.thread.id}`);
				}

				return;
			}

			const {threads} = await client.getThreads();
			const limited = threads.slice(0, options.limit);

			if (isJson) {
				outputJson(
					jsonSuccess(
						limited.map(t => ({
							id: t.id,
							title: t.title,
							users: t.users.map(u => u.username),
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
		[options],
	);

	return (
		<OneTurnCommand
			username={options.username}
			output={options.output}
			run={run}
		/>
	);
}
