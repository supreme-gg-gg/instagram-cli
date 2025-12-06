import React from 'react';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import {type FeedInstance} from '../types/instagram.js';
import MediaView from '../ui/views/media-view.js';
import {useInstagramClient} from '../ui/hooks/use-instagram-client.js';
import {createContextualLogger} from '../utils/logger.js';

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

const logger = createContextualLogger('FeedCommand');

export default function Feed({args}: Properties) {
	const {client, isLoading, error} = useInstagramClient(args[0], {
		realtime: false,
	});
	const [feed, setFeed] = React.useState<FeedInstance>({posts: []});
	const [feedError, setFeedError] = React.useState<string | undefined>();

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
				const errorMessage =
					error_ instanceof Error ? error_.message : String(error_);
				logger.error(`Feed error: ${errorMessage}`);
				setFeedError(`Failed to fetch feed: ${errorMessage}`);
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

	if (feedError) {
		return <Alert variant="error">{feedError}</Alert>;
	}

	return <MediaView feed={feed} />;
}
