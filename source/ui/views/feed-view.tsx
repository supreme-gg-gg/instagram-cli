import React from 'react';
import {TerminalInfoProvider} from 'ink-picture';
import {
	type ListMediaItem,
	type Post,
	type PostMetadata,
} from '../../types/instagram.js';
import ListDetailDisplay from '../components/list-detail-display.js';
import {useImageProtocol} from '../hooks/use-image-protocol.js';

export type FeedData = {
	posts?: Post[];
};

export default function FeedView({feed}: {readonly feed: FeedData}) {
	const imageProtocol = useImageProtocol();

	const listItems: Array<ListMediaItem<Post, PostMetadata>> = (
		feed.posts ?? []
	).map(post => ({
		pk: post.user.pk,
		label: post.user.username,
		content: post.carousel_media
			? (post.carousel_media.map(item => ({
					...item,
					user: post.user,
					taken_at: post.taken_at,
					like_count: post.like_count,
					comment_count: post.comment_count,
				})) as Post[])
			: [post],
		additional_metadata: {
			caption: post.caption,
			like_count: post.like_count,
			comment_count: post.comment_count,
			carousel_media_count: post.carousel_media_count,
		},
	}));

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
