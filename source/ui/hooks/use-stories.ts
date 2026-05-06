import {useState, useEffect, useCallback} from 'react';
import {
	type ListMediaItem,
	type Story,
	type StoryReel,
} from '../../types/instagram.js';
import {createContextualLogger} from '../../utils/logger.js';
import {useInstagramClient as useInstagramClientImpl} from './use-instagram-client.js';

type UseInstagramClientHook = typeof useInstagramClientImpl;

const logger = createContextualLogger('useStories');

export function useStories(
	useInstagramClient: UseInstagramClientHook = useInstagramClientImpl,
) {
	const {
		client,
		error: clientError,
		isLoading: clientLoading,
	} = useInstagramClient(undefined, {realtime: false});
	const [reels, setReels] = useState<Array<ListMediaItem<Story>>>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();

	const loadStoriesForReel = useCallback(
		async (index: number, currentItems: Array<ListMediaItem<Story>>) => {
			if (!client || index < 0 || index >= currentItems.length) {
				return;
			}

			const item = currentItems[index];
			if (!item || item.content.length > 0) {
				return;
			}

			try {
				const stories = await client.getStoriesForUser(item.pk);
				if (stories.length > 0) {
					setReels(previousItems => {
						const newItems = [...previousItems];
						const targetItem = newItems[index];
						if (targetItem) {
							newItems[index] = {
								...targetItem,
								content: stories,
							};
						}

						return newItems;
					});
				}
			} catch (error_) {
				const errorMessage =
					error_ instanceof Error ? error_.message : String(error_);
				logger.error(
					`Failed to load stories for user ${item.pk}: ${errorMessage}`,
				);
			}
		},
		[client],
	);

	useEffect(() => {
		const fetchReelsTray = async () => {
			if (!client || clientError) {
				setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);
				const reelsTray = await client.getReelsTray();
				if (reelsTray.length > 0) {
					const listItems: Array<ListMediaItem<Story>> = reelsTray.map(
						reel => ({
							pk: reel.user.pk,
							label: reel.user.username,
							content: reel.stories,
						}),
					);

					setReels(listItems);
					await loadStoriesForReel(0, listItems);

					if (listItems.length > 1) {
						void loadStoriesForReel(1, listItems).catch((error_: unknown) => {
							const errorMessage =
								error_ instanceof Error ? error_.message : String(error_);
							logger.error(
								`Failed to load stories for reel 1: ${errorMessage}`,
							);
						});
					}

					if (listItems.length > 2) {
						void loadStoriesForReel(2, listItems).catch((error_: unknown) => {
							const errorMessage =
								error_ instanceof Error ? error_.message : String(error_);
							logger.error(
								`Failed to load stories for reel 2: ${errorMessage}`,
							);
						});
					}
				}
			} catch (error_) {
				const errorMessage =
					error_ instanceof Error ? error_.message : String(error_);
				logger.error(`Failed to fetch reels tray: ${errorMessage}`);
				setError(`Failed to fetch stories: ${errorMessage}`);
			} finally {
				setIsLoading(false);
			}
		};

		void fetchReelsTray();
	}, [client, clientError, loadStoriesForReel]);

	const loadMore = useCallback(
		async (index: number) => {
			// Load the requested reel
			await loadStoriesForReel(index, reels);

			// Pre-fetch next 1-2 reels in the background (non-blocking)
			// The loadStoriesForReel function already has a check to avoid re-fetching
			const indicesToPrefetch = [index + 1, index + 2].filter(
				i => i >= 0 && i < reels.length,
			);

			for (const i of indicesToPrefetch) {
				void (async () => {
					try {
						await loadStoriesForReel(i, reels);
					} catch (error_: unknown) {
						const errorMessage =
							error_ instanceof Error ? error_.message : String(error_);
						logger.error(
							`Failed to load stories for reel ${i}: ${errorMessage}`,
						);
					}
				})();
			}
		},
		[loadStoriesForReel, reels],
	);

	return {
		reels,
		isLoading: isLoading || clientLoading,
		error: clientError ?? error,
		loadMore,
		client,
	};
}
