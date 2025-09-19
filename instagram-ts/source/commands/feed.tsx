import React from 'react';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import {type FeedInstance} from '../types/instagram.js';
import MediaView from '../ui/views/media-view.js';
import {useInstagramClient} from '../ui/hooks/use-instagram-client.js';

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

type Properties = {
	readonly args: zod.infer<typeof args>;
};

export default function Feed({args}: Properties) {
	const {client, isLoading, error} = useInstagramClient(args[0]);
	const [feed, setFeed] = React.useState<FeedInstance>({posts: []});

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
					setFeed({posts: items});
				}
			} catch (error_) {
				// SetError(`Feed error: ${err instanceof Error ? err.message : String(err)}`);
				console.error(
					`Feed error: ${
						error_ instanceof Error ? error_.message : String(error_)
					}`,
				);
			}
		};

		void fetchFeed();
	}, [client]);

	if (isLoading) {
		return <Alert variant="info">Fetching Instagram feed...</Alert>;
	}

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	return <MediaView feed={feed} />;
}
