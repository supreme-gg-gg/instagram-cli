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
import {formatUsernamesInText} from '../utils/notifications.js';

export const description = 'List recent notifications';

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
	readonly options: zod.infer<typeof options>;
};

export default function Notifications({options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const ig = client.getInstagramClient();
			const newsInbox = await ig.news.inbox();

			const newStories = (newsInbox?.new_stories ?? []) as Array<{
				args: {rich_text: string; timestamp: string};
			}>;
			const oldStories = (newsInbox?.old_stories ?? []) as Array<{
				args: {rich_text: string; timestamp: string};
			}>;

			if (options.json) {
				outputJson(
					jsonSuccess({
						newNotifications: newStories.map(n => ({
							text: formatUsernamesInText(n.args.rich_text),
							timestamp: Number(n.args.timestamp),
						})),
						oldNotifications: oldStories.map(n => ({
							text: formatUsernamesInText(n.args.rich_text),
							timestamp: Number(n.args.timestamp),
						})),
					}),
				);
				return;
			}

			const allNotifications = [
				...newStories.map(n => ({...n, isNew: true})),
				...oldStories.map(n => ({...n, isNew: false})),
			];

			if (allNotifications.length === 0) {
				outputText('No recent notifications.');
				return;
			}

			for (const n of allNotifications) {
				const tag = n.isNew ? '[NEW] ' : '';
				const text = formatUsernamesInText(n.args.rich_text);
				const time = new Date(Number(n.args.timestamp) * 1000).toLocaleString();
				outputText(`${tag}${text}`);
				outputText(`  ${time}`);
			}
		},
		[options.json],
	);

	return (
		<OneTurnCommand username={options.username} json={options.json} run={run} />
	);
}
