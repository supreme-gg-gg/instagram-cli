import React from 'react';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import type {Post} from '../types/instagram.js';
import FeedView from '../ui/views/feed-view.js';
import {useInstagramClient} from '../ui/hooks/use-instagram-client.js';
import {createContextualLogger} from '../utils/logger.js';

export const description = 'Fetch and display your saved Instagram posts';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'username',
				description: 'Saved account to use (optional)',
			}),
		),
]);

type Properties = {
	readonly args: zod.infer<typeof args>;
};

const logger = createContextualLogger('SavedCommand');

export default function Saved({args}: Properties) {
	const {client, isLoading, error} = useInstagramClient(args[0], {
		realtime: false,
	});
	const [posts, setPosts] = React.useState<Post[]>();
	const [savedError, setSavedError] = React.useState<string | undefined>();

	React.useEffect(() => {
		if (!client) return;

		const fetchSavedPosts = async () => {
			try {
				setPosts(await client.getSavedPosts());
			} catch (error_) {
				const message =
					error_ instanceof Error ? error_.message : String(error_);
				logger.error(`Saved posts error: ${message}`);
				setSavedError(`Failed to fetch saved posts: ${message}`);
			}
		};

		void fetchSavedPosts();
	}, [client]);

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	if (savedError) {
		return <Alert variant="error">{savedError}</Alert>;
	}

	if (isLoading || posts === undefined) {
		return <Alert variant="info">Fetching saved Instagram posts...</Alert>;
	}

	if (posts.length === 0) {
		return <Alert variant="info">No saved posts to display.</Alert>;
	}

	return <FeedView feed={{posts}} title="🔖 Saved posts" />;
}
