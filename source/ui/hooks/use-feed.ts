import {useState, useEffect, useCallback, useRef} from 'react';
import {type Post} from '../../types/instagram.js';
import {createContextualLogger} from '../../utils/logger.js';
import {useInstagramClient as useInstagramClientImpl} from './use-instagram-client.js';

type UseInstagramClientHook = typeof useInstagramClientImpl;

const logger = createContextualLogger('useFeed');

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function useFeed(
	username?: string,
	useInstagramClient: UseInstagramClientHook = useInstagramClientImpl,
) {
	const {
		client,
		error: clientError,
		isLoading: clientLoading,
	} = useInstagramClient(username, {realtime: false});
	const [posts, setPosts] = useState<Post[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [error, setError] = useState<string | undefined>();
	const [loadMoreError, setLoadMoreError] = useState<string | undefined>();
	// Guards against firing a second page request while one is in flight
	const isFetchingRef = useRef(false);
	const postsRef = useRef(posts);
	postsRef.current = posts;

	useEffect(() => {
		const fetchFirstPage = async () => {
			if (!client || clientError) {
				setIsLoading(false);
				return;
			}

			isFetchingRef.current = true;
			try {
				setIsLoading(true);
				const page = await client.getTimelinePosts();
				setPosts(page.posts);
				setHasMore(page.hasMore);
			} catch (error_) {
				const errorMessage = getErrorMessage(error_);
				logger.error(`Feed error: ${errorMessage}`);
				setError(`Failed to fetch feed: ${errorMessage}`);
			} finally {
				isFetchingRef.current = false;
				setIsLoading(false);
			}
		};

		void fetchFirstPage();
	}, [client, clientError]);

	const fetchNextPage = useCallback(async () => {
		if (!client || !hasMore || isFetchingRef.current) {
			return;
		}

		isFetchingRef.current = true;
		setIsLoadingMore(true);
		setLoadMoreError(undefined);
		try {
			const page = await client.getTimelinePosts(true);
			const seenIds = new Set(postsRef.current.map(post => post.id));
			const newPosts = page.posts.filter(post => !seenIds.has(post.id));
			setPosts(previous => [...previous, ...newPosts]);
			// A page with nothing new would never move the selection closer to
			// the end, so treat it as the end of the feed instead of stalling.
			setHasMore(page.hasMore && newPosts.length > 0);
		} catch (error_) {
			// Keep the posts already shown and let the user retry explicitly
			const errorMessage = getErrorMessage(error_);
			logger.error(`Failed to load more posts: ${errorMessage}`);
			setLoadMoreError(errorMessage);
		} finally {
			isFetchingRef.current = false;
			setIsLoadingMore(false);
		}
	}, [client, hasMore]);

	// Automatic requests (scrolling near the end) stop after a failure, so a
	// broken connection doesn't retry on every keypress; retryLoadMore resumes.
	const loadMorePosts = useCallback(async () => {
		if (loadMoreError === undefined) {
			await fetchNextPage();
		}
	}, [fetchNextPage, loadMoreError]);

	return {
		posts,
		isLoading: isLoading || clientLoading,
		isLoadingMore,
		hasMore,
		error: clientError ?? error,
		loadMoreError,
		loadMorePosts,
		retryLoadMore: fetchNextPage,
	};
}
