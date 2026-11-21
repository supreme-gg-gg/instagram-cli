import {useState, useEffect, useCallback, useRef} from 'react';
import {type ListMediaItem, type Story} from '../../types/instagram.js';
import {createContextualLogger} from '../../utils/logger.js';
import {SeenStoriesManager} from '../../utils/seen-stories.js';
import {ConfigManager} from '../../config.js';
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
	const [seenUserPks, setSeenUserPks] = useState<Set<string>>(new Set());
	const [latestReelMediaByUser, setLatestReelMediaByUser] = useState<
		ReadonlyMap<string, number>
	>(new Map());
	const [reelSeenByUser, setReelSeenByUser] = useState<
		ReadonlyMap<string, number>
	>(new Map());
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const seenStoriesManager = useRef<SeenStoriesManager | undefined>(undefined);

	const markAsSeen = ConfigManager.getInstance().get<boolean>(
		'stories.markAsSeen',
		false,
	);

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
		if (client && !seenStoriesManager.current) {
			const username = client.getUsername();
			if (username) {
				const manager = new SeenStoriesManager(username, undefined, markAsSeen);
				seenStoriesManager.current = manager;
				if (!markAsSeen) {
					void manager.load();
				}
			}
		}
	}, [client, markAsSeen]);

	useEffect(() => {
		const fetchReelsTray = async () => {
			if (!client || clientError) {
				setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);
				const {
					items: listItems,
					latestReelMediaByUser: latestByUser,
					reelSeenByUser: apiSeenByUser,
				} = await client.getReelsTray();
				setLatestReelMediaByUser(latestByUser);
				setReelSeenByUser(apiSeenByUser);

				const seenPks = new Set<string>();
				if (seenStoriesManager.current) {
					if (markAsSeen) {
						for (const [pk, seen] of apiSeenByUser) {
							seenStoriesManager.current.registerSeenTimestamp(pk, seen);
						}
					}

					const currentUserPks = listItems.map(item => item.pk);
					seenStoriesManager.current.syncUsers(currentUserPks);

					for (const item of listItems) {
						const latestReelMedia = latestByUser.get(item.pk);
						if (
							latestReelMedia &&
							seenStoriesManager.current.areAllStoriesSeen(
								item.pk,
								latestReelMedia,
							)
						) {
							seenPks.add(item.pk);
						}
					}

					setSeenUserPks(seenPks);
				}

				const unseenItems: Array<ListMediaItem<Story>> = [];
				const seenItems: Array<ListMediaItem<Story>> = [];

				for (const item of listItems) {
					if (seenPks.has(item.pk)) {
						seenItems.push(item);
					} else {
						unseenItems.push(item);
					}
				}

				const orderedItems = [...unseenItems, ...seenItems];

				if (orderedItems.length > 0) {
					setReels(orderedItems);
					await loadStoriesForReel(0, orderedItems);

					if (orderedItems.length > 1) {
						void loadStoriesForReel(1, orderedItems).catch(
							(error_: unknown) => {
								const errorMessage =
									error_ instanceof Error ? error_.message : String(error_);
								logger.error(
									`Failed to load stories for reel 1: ${errorMessage}`,
								);
							},
						);
					}

					if (orderedItems.length > 2) {
						void loadStoriesForReel(2, orderedItems).catch(
							(error_: unknown) => {
								const errorMessage =
									error_ instanceof Error ? error_.message : String(error_);
								logger.error(
									`Failed to load stories for reel 2: ${errorMessage}`,
								);
							},
						);
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
	}, [client, clientError, loadStoriesForReel, markAsSeen]);

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
		seenUserPks,
		latestReelMediaByUser,
		reelSeenByUser,
		markAsSeen,
		isLoading: isLoading || clientLoading,
		error: clientError ?? error,
		loadMore,
		client,
	};
}
