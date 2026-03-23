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

export const description = 'List timeline feed posts';

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
				description: 'Maximum number of posts to show',
			}),
		),
});

type Properties = {
	readonly options: zod.infer<typeof options>;
};

export default function FeedList({options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const ig = client.getInstagramClient();
			const timelineFeed = ig.feed.timeline();
			const items = await timelineFeed.items();
			const limited = items.slice(0, options.limit);

			if (options.json) {
				outputJson(
					jsonSuccess(
						limited.map(item => ({
							id: item.id,
							user: {
								username: item.user?.username,
								pk: item.user?.pk,
							},
							caption: item.caption?.text,
							likeCount: item.like_count,
							commentCount: item.comment_count,
							mediaType: item.media_type,
							takenAt: item.taken_at,
						})),
					),
				);
				return;
			}

			if (limited.length === 0) {
				outputText('No feed posts found.');
				return;
			}

			for (const item of limited) {
				const username = item.user?.username ?? 'unknown';
				const caption = item.caption?.text
					? ` — ${item.caption.text.slice(0, 80)}${item.caption.text.length > 80 ? '...' : ''}`
					: '';
				const likes = item.like_count ?? 0;
				const comments = item.comment_count ?? 0;
				const time = new Date((item.taken_at ?? 0) * 1000).toLocaleString();
				outputText(`@${username}${caption}`);
				outputText(`  ${likes} likes, ${comments} comments — ${time}`);
			}
		},
		[options.json, options.limit],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
