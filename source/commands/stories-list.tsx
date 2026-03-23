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

export const description = 'List users with active stories';

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
				description: 'Maximum number of users to show',
			}),
		),
});

type Properties = {
	readonly options: zod.infer<typeof options>;
};

export default function StoriesList({options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const reels = await client.getReelsTray();
			const limited = reels.slice(0, options.limit);

			if (options.json) {
				outputJson(
					jsonSuccess(
						limited.map(r => ({
							username: r.user.username,
							userId: r.user.pk,
							profilePicUrl: r.user.profilePicUrl,
						})),
					),
				);
				return;
			}

			if (limited.length === 0) {
				outputText('No active stories found.');
				return;
			}

			outputText(`${limited.length} users with active stories:\n`);
			for (const r of limited) {
				outputText(`  @${r.user.username}`);
			}
		},
		[options.json, options.limit],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
