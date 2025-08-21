import React from 'react';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import {FeedItem} from '../types/instagram.js';
import MediaView from '../ui/views/MediaView.js';
import {useInstagramClient} from '../ui/hooks/useInstagramClient.js';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'username',
				description: 'Username to fetch feed for (optional)',
			}),
		),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function Feed({args}: Props) {
	const {client, isLoading, error} = useInstagramClient(args[0]);
	const [feedItems, setFeedItems] = React.useState<FeedItem[]>([]);

	React.useEffect(() => {
		const fetchFeed = async () => {
			if (!client) {
				return;
			}

			try {
				const ig = client.getInstagramClient();
				const timelineFeed = ig.feed.timeline();
				const items = await timelineFeed.items();
				if (items.length === 0) {
					// If no items, set an error or handle appropriately
					// setError('No feed items found.'); // This would require adding setError to the hook or handling it here
				} else {
					setFeedItems(items);
				}
			} catch (err) {
				// setError(`Feed error: ${err instanceof Error ? err.message : String(err)}`);
				console.error(
					`Feed error: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		};

		fetchFeed();
	}, [client]);

	if (isLoading) {
		return <Alert variant="info">Fetching Instagram feed...</Alert>;
	}
	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}
	return <MediaView feedItems={feedItems} />;
}
