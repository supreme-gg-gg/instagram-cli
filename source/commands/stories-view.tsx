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
			name: 'username',
			description: 'Username whose stories to view',
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

export default function StoriesView({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const targetUser = commandArgs[0];
			const stories = await client.getStoriesForUser(undefined, targetUser);

			if (options.json) {
				outputJson(
					jsonSuccess(
						stories.map(s => ({
							id: s.id,
							mediaType: s.media_type === 1 ? 'image' : 'video',
							takenAt: s.taken_at,
							user: s.user,
							imageUrl: s.image_versions2?.candidates?.[0]?.url,
							videoUrl: s.video_versions?.[0]?.url,
						})),
					),
				);
				return;
			}

			if (stories.length === 0) {
				outputText(`No active stories for @${targetUser}.`);
				return;
			}

			outputText(`${stories.length} stories from @${targetUser}:\n`);
			for (const [index, s] of stories.entries()) {
				const type = s.media_type === 1 ? 'Photo' : 'Video';
				const time = new Date(s.taken_at * 1000).toLocaleString();
				outputText(`  ${index + 1}. ${type} — ${time}`);
			}
		},
		[commandArgs, options.json],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
