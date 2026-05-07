import React, {useState, useEffect} from 'react';
import {TerminalInfoProvider} from 'ink-picture';
import {
	type ListMediaItem,
	type Post,
	type PostMetadata,
} from '../../types/instagram.js';
import ListDetailDisplay from '../components/list-detail-display.js';
import TimelineMediaDisplay from '../components/timeline-media-display.js';
import {ConfigManager} from '../../config.js';
import {useImageProtocol} from '../hooks/use-image-protocol.js';

type FeedPost = Post & {
	carousel_media?: Post[];
};

type FeedData = {
	posts?: FeedPost[];
};

export default function MediaView({feed}: {readonly feed: FeedData}) {
	const [feedType, setFeedType] = useState<'timeline' | 'list'>('list');
	const imageProtocol = useImageProtocol();

	useEffect(() => {
		const config = ConfigManager.getInstance();
		const savedFeedType = config.get('feed.feedType') || 'list';
		setFeedType(savedFeedType as 'timeline' | 'list');
	}, [feed]);

	const listItems: Array<ListMediaItem<Post, PostMetadata>> = (
		feed.posts ?? []
	).map(post => ({
		pk: post.user.pk,
		label: post.user.username,
		content: post.carousel_media
			? [
					post,
					...post.carousel_media.map(item => ({
						...item,
						user: post.user,
						taken_at: post.taken_at,
					})),
				]
			: [post],
		additional_metadata: {
			caption: post.caption,
			like_count: post.like_count,
			comment_count: post.comment_count,
			carousel_media_count: post.carousel_media_count,
		},
	}));

	const posts = feed.posts ?? [];

	if (feedType === 'timeline') {
		return (
			<TerminalInfoProvider>
				<TimelineMediaDisplay posts={posts} protocol={imageProtocol} />
			</TerminalInfoProvider>
		);
	}

	return (
		<TerminalInfoProvider>
			<ListDetailDisplay
				listItems={listItems}
				loadMore={() => {}}
				protocol={imageProtocol}
				mode="post"
			/>
		</TerminalInfoProvider>
	);
}
