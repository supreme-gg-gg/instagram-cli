import {useState, useEffect, useCallback} from 'react';
import {type StoryReel} from '../../types/instagram.js';
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
	const [reels, setReels] = useState<StoryReel[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();

	const loadStoriesForReel = useCallback(
		async (index: number, currentReels: StoryReel[]) => {
			if (!client || index < 0 || index >= currentReels.length) {
				return;
			}

			const reel = currentReels[index];
			// Don't re-fetch if stories are already loaded
			if (!reel || reel.stories.length > 0) {
				return;
			}

			try {
				const stories = await client.getStoriesForUser(reel.user.pk);
				if (stories.length > 0) {
					setReels(previousReels => {
						const newReels = [...previousReels];
						const targetReel = newReels[index];
						if (targetReel) {
							targetReel.stories = stories;
						}

						return newReels;
					});
				}
			} catch (error_) {
				const errorMessage =
					error_ instanceof Error ? error_.message : String(error_);
				logger.error(
					`Failed to load stories for user ${reel.user.username}: ${errorMessage}`,
				);
			}
		},
		[client],
	);

	useEffect(() => {
		const fetchReelsTray = async () => {
			// Don't try to fetch if client failed to initialize
			if (!client || clientError) {
				setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);
				const reelsTray = await client.getReelsTray();
				if (reelsTray.length > 0) {
					setReels(reelsTray);
					// Pre-fetch stories for the first 3 users (0, 1, 2)
					await loadStoriesForReel(0, reelsTray);
					// Pre-fetch next 2 in background
					if (reelsTray.length > 1) {
						// Fire and forget: explicitly ignore the promise result
						void loadStoriesForReel(1, reelsTray).catch((error_: unknown) => {
							const errorMessage =
								error_ instanceof Error ? error_.message : String(error_);
							logger.error(
								`Failed to load stories for reel 1: ${errorMessage}`,
							);
						});
					}

					if (reelsTray.length > 2) {
						// Fire and forget: explicitly ignore the promise result
						void loadStoriesForReel(2, reelsTray).catch((error_: unknown) => {
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
