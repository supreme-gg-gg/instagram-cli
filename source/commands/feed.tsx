import React from 'react';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import FeedView from '../ui/views/feed-view.js';
import {useFeed} from '../ui/hooks/use-feed.js';

export const description = 'Fetch and display Instagram feed in TUI';

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
	const {posts, isLoading, isLoadingMore, error, loadMorePosts} = useFeed(
		args[0],
	);

	if (isLoading) {
		return <Alert variant="info">Fetching Instagram feed...</Alert>;
	}

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	return (
		<FeedView
			feed={{posts}}
			isLoadingMore={isLoadingMore}
			onEndReached={loadMorePosts}
		/>
	);
}
