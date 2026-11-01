import React from 'react';
import {InkPictureProvider} from 'ink-picture';
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

type Properties = {
	readonly feed: FeedData;
	readonly title?: string;
};

export default function FeedView({feed, title}: Properties) {
	const imageProtocol = useImageProtocol();

	const listItems: Array<ListMediaItem<Post, PostMetadata>> = (
		feed.posts ?? []
	).map(post => ({
		pk: post.id,
		label: post.user.username,
		fullName: post.user.full_name,
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
		<InkPictureProvider>
			<ListDetailDisplay
				listItems={listItems}
				loadMore={() => {}}
				protocol={imageProtocol}
				mode="post"
				sidebarTitle={title}
			/>
		</InkPictureProvider>
	);
}
