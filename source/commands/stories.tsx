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

export const description =
	'List users with active stories, or view stories for a specific user';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'username',
				description:
					'Username to view stories for (omit to list all users with stories)',
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
				description: 'Maximum number of users to show (list mode only)',
			}),
		),
});

type Properties = {
	readonly args: zod.infer<typeof args>;
	readonly options: zod.infer<typeof options>;
};

export default function Stories({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const targetUser = commandArgs[0];
			const isJson = options.output === 'json';

			if (targetUser) {
				// View mode: show stories for a specific user
				const stories = await client.getStoriesForUser(undefined, targetUser);

				if (isJson) {
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

				return;
			}

			// List mode: show all users with active stories
			const reels = await client.getReelsTray();
			const limited = reels.slice(0, options.limit);

			if (isJson) {
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
