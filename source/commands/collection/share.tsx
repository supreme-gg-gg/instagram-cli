import React, {useCallback} from 'react';
import zod from 'zod';
import {argument, option} from 'pastel';
import {
	OneTurnCommand,
	outputJson,
	jsonSuccess,
	outputText,
	resolveThread,
} from '../../utils/one-turn.js';
import {type InstagramClient} from '../../client.js';
import {
	splitMediaBatches,
	pickAutoPostedShares,
} from '../../utils/collection.js';

export const description =
	'Share a saved collection with a DM thread (creates a collaborative copy)';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'collection',
			description: 'Collection name or ID',
		}),
	),
	zod.string().describe(
		argument({
			name: 'thread',
			description: 'Thread ID, username, or thread title to share with',
		}),
	),
]);

export const options = zod.object({
	username: zod
		.string()
		.optional()
		.describe(option({alias: 'u', description: 'Account username to use'})),
	output: zod
		.string()
		.optional()
		.describe(option({alias: 'o', description: 'Output format (json)'})),
	name: zod
		.string()
		.optional()
		.describe(
			option({description: 'Name of the shared collection (default: same)'}),
		),
	cleanDm: zod
		.boolean()
		.default(false)
		.describe(
			option({
				description:
					'Unsend the media Instagram auto-posts in the thread for each added item',
			}),
		),
});

type Properties = {
	readonly args: zod.infer<typeof args>;
	readonly options: zod.infer<typeof options>;
};

export default function CollectionShare({
	args: commandArgs,
	options,
}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const [collectionQuery, threadQuery] = commandArgs;
			const isJson = options.output === 'json';

			const collections = await client.getSavedCollections();
			const source = collections.find(
				c =>
					c.id === collectionQuery ||
					c.name.toLowerCase() === collectionQuery.toLowerCase(),
			);
			if (!source) {
				throw new Error(`Collection not found: ${collectionQuery}`);
			}

			const {threadId} = await resolveThread(client, threadQuery);
			const mediaIds = await client.getCollectionMediaIds(source.id);
			const {initial, rest} = splitMediaBatches(mediaIds);

			const startedAt = Date.now();
			const collectionId = await client.createCollection(
				options.name ?? source.name,
				{threadId, mediaIds: initial},
			);
			for (const batch of rest) {
				// eslint-disable-next-line no-await-in-loop -- keep requests sequential to stay under rate limits
				await client.addToCollection(collectionId, batch);
			}

			// Instagram posts every media added to a collaborative collection into
			// the linked thread. Optionally unsend those auto-posts.
			let unsent = 0;
			if (options.cleanDm) {
				const items = await client.getThreadItemsSince(threadId, startedAt);
				for (const itemId of pickAutoPostedShares(
					items,
					client.viewerId,
					startedAt,
				)) {
					// eslint-disable-next-line no-await-in-loop -- sequential to avoid rate limits
					await client.unsendMessage(threadId, itemId);
					unsent++;
				}
			}

			const result = {
				collectionId,
				threadId,
				mediaCount: mediaIds.length,
				autoPostsUnsent: unsent,
			};
			if (isJson) {
				outputJson(jsonSuccess(result));
				return;
			}

			outputText(
				`Shared "${source.name}" (${mediaIds.length} items) as a collaborative collection.`,
			);
			outputText(
				options.cleanDm
					? `Unsent ${unsent} media auto-posted in the thread.`
					: `Note: Instagram posted each added item in the thread. Re-run with --clean-dm next time to unsend them automatically.`,
			);
			outputText(
				'The original collection is unchanged; collaborative collections cannot be made private again.',
			);
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
