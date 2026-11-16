import React, {useMemo} from 'react';
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
	readonly isLoadingMore?: boolean;
	readonly loadMoreError?: string;
	readonly onEndReached?: () => void;
	readonly onRetryLoadMore?: () => void;
};

// Feed posts arrive with their content, so there is nothing to lazy-load
const noLazyLoad = () => {};

export default function FeedView({
	feed,
	isLoadingMore,
	loadMoreError,
	onEndReached,
	onRetryLoadMore,
}: Properties) {
	const imageProtocol = useImageProtocol();

	const listItems: Array<ListMediaItem<Post, PostMetadata>> = useMemo(
		() =>
			(feed.posts ?? []).map(post => ({
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
			})),
		[feed.posts],
	);

	return (
		<InkPictureProvider>
			<ListDetailDisplay
				listItems={listItems}
				loadMore={noLazyLoad}
				protocol={imageProtocol}
				mode="post"
				isLoadingMore={isLoadingMore}
				loadMoreError={loadMoreError}
				onEndReached={onEndReached}
				onRetryLoadMore={onRetryLoadMore}
			/>
		</InkPictureProvider>
	);
}
