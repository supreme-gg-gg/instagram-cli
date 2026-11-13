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
	// Guards against firing a second page request while one is in flight
	const isFetchingRef = useRef(false);

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

	const loadMorePosts = useCallback(async () => {
		if (!client || !hasMore || isFetchingRef.current) {
			return;
		}

		isFetchingRef.current = true;
		setIsLoadingMore(true);
		try {
			const page = await client.getTimelinePosts(true);
			setPosts(previous => [...previous, ...page.posts]);
			setHasMore(page.hasMore);
		} catch (error_) {
			// Keep the posts already shown; the user can retry by scrolling again
			logger.error(`Failed to load more posts: ${getErrorMessage(error_)}`);
		} finally {
			isFetchingRef.current = false;
			setIsLoadingMore(false);
		}
	}, [client, hasMore]);

	return {
		posts,
		isLoading: isLoading || clientLoading,
		isLoadingMore,
		hasMore,
		error: clientError ?? error,
		loadMorePosts,
	};
}
