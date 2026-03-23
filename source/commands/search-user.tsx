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

export const description = 'Search users by username';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'query',
			description: 'Username to search for',
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
	exact: zod
		.boolean()
		.default(false)
		.describe(
			option({
				description: 'Search for exact username match',
			}),
		),
});

type Properties = {
	readonly args: zod.infer<typeof args>;
	readonly options: zod.infer<typeof options>;
};

export default function SearchUser({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const query = commandArgs[0];
			const results = await client.searchThreadByUsername(query, {
				forceExact: options.exact,
			});

			if (options.json) {
				outputJson(
					jsonSuccess(
						results.map(r => ({
							id: r.thread.id,
							title: r.thread.title,
							users: r.thread.users,
							score: r.score,
						})),
					),
				);
				return;
			}

			if (results.length === 0) {
				outputText(`No users matching "${query}".`);
				return;
			}

			for (const r of results) {
				const user = r.thread.users[0];
				const verified = user?.isVerified ? ' [verified]' : '';
				const fullName = user?.fullName ? ` (${user.fullName})` : '';
				outputText(`@${user?.username ?? 'unknown'}${fullName}${verified}`);
				outputText(`  PK: ${user?.pk ?? 'unknown'}`);
			}
		},
		[commandArgs, options.json, options.exact],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
