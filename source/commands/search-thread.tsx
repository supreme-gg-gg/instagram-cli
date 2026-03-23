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

export const description = 'Search threads by title';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'query',
			description: 'Search query for thread titles',
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
		.default(10)
		.describe(
			option({
				alias: 'l',
				description: 'Maximum number of results',
			}),
		),
});

type Properties = {
	readonly args: zod.infer<typeof args>;
	readonly options: zod.infer<typeof options>;
};

export default function SearchThread({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const query = commandArgs[0];
			const results = await client.searchThreadsByTitle(query, {
				maxThreadsToSearch: options.limit * 4,
			});
			const limited = results.slice(0, options.limit);

			if (options.json) {
				outputJson(
					jsonSuccess(
						limited.map(r => ({
							id: r.thread.id,
							title: r.thread.title,
							users: r.thread.users,
							score: r.score,
							lastActivity: r.thread.lastActivity,
						})),
					),
				);
				return;
			}

			if (limited.length === 0) {
				outputText(`No threads matching "${query}".`);
				return;
			}

			for (const r of limited) {
				const score = Math.round(r.score * 100);
				outputText(`${r.thread.title} (${score}% match)`);
				outputText(`  ID: ${r.thread.id}`);
			}
		},
		[commandArgs, options.json, options.limit],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
