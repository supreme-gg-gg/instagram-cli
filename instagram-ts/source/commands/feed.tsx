import React from 'react';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import {InstagramClient} from '../client.js';
import {ConfigManager} from '../config.js';
import {FeedItem} from '../types/instagram.js';
import MediaView from '../ui/views/MediaView.js';

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

const width = 80


export default function Feed({ args }: Props) {
	const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
	const [error, setError] = React.useState<string | null>(null);
	const [feedItems, setFeedItems] = React.useState<FeedItem[]>([]);


	React.useEffect(() => {
		const fetchFeed = async () => {
			try {
				const config = ConfigManager.getInstance();
				await config.initialize();

				// Determine which username to use
				let targetUsername = args[0];
				if (!targetUsername) {
					targetUsername =
						config.get<string>('login.currentUsername') ||
						config.get<string>('login.defaultUsername');
				}

				const client = new InstagramClient(targetUsername);
				await client.loginBySession();
				const ig = client.getInstagramClient();

				const timelineFeed = ig.feed.timeline();
				const items = await timelineFeed.items();
				if (items.length === 0) {
					setError('No feed items found.');
					setStatus('error');
					return;
				}
				else {
					setFeedItems(items);
					setStatus('ready');
				}
			} catch (err) {
				setError(`Feed error: ${err instanceof Error ? err.message : String(err)}`);
				setStatus('error');
			}
		};

		fetchFeed();
	}, [args]);

if (status === 'loading') {
		return <Alert variant="info">🚀 Fetching Instagram feed...</Alert>;
	}
if (status === 'error') {
		return <Alert variant="error">❌ {error}</Alert>;
	}
	return (
		<MediaView feedItems={feedItems} width={width} />
	);
}
