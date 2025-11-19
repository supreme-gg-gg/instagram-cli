import {useState, useEffect, useCallback} from 'react';
import {type StoryReel} from '../../types/instagram.js';
import {createContextualLogger} from '../../utils/logger.js';
import {useInstagramClient} from './use-instagram-client.js';

const logger = createContextualLogger('useStories');

export function useStories() {
	const {client} = useInstagramClient(undefined, {realtime: false});
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
				// Optionally set an error state for the specific reel
			}
		},
		[client],
	);

	useEffect(() => {
		const fetchReelsTray = async () => {
			if (!client) {
				return;
			}

			try {
				setIsLoading(true);
				const reelsTray = await client.getReelsTray();
				if (reelsTray.length > 0) {
					setReels(reelsTray);
					// Pre-fetch stories for the first user
					await loadStoriesForReel(0, reelsTray);
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
	}, [client, loadStoriesForReel]);

	const loadMore = useCallback(
		async (index: number) => {
			await loadStoriesForReel(index, reels);
		},
		[loadStoriesForReel, reels],
	);

	return {reels, isLoading, error, loadMore, client};
}
