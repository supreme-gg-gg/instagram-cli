import React, {useState, useEffect, useMemo, useRef} from 'react';
import {
	Box,
	Text,
	useInput,
	useApp,
	useStdout,
	type DOMElement,
	useBoxMetrics,
} from 'ink';
import open from 'open';
import {type ImageProtocolName} from 'ink-picture';
import {
	type ListMediaItem,
	type MediaCandidate,
	type Story,
	type PostMetadata,
	type ReelMention,
	type BaseMedia,
	type MediaItemMetadata,
} from '../../types/instagram.js';
import {createContextualLogger} from '../../utils/logger.js';
import {type InstagramClient} from '../../client.js';
import SplitView from './split-view.js';
import MediaPane from './media-pane.js';
import TextInput from './text-input.js';

type Properties<T extends BaseMedia & MediaItemMetadata, M = undefined> = {
	readonly listItems: Array<ListMediaItem<T, M>>;
	readonly loadMore: (index: number) => void;
	readonly protocol?: ImageProtocolName;
	readonly client?: InstagramClient | undefined;
	readonly mode: 'story' | 'post';
	readonly handleSearchSubmit?: (
		query: string,
	) => Promise<ListMediaItem<T, M> | undefined>;
};

function getBestImage(
	candidates: MediaCandidate[] | undefined,
	containerWidth: number,
): string | undefined {
	if (!candidates || candidates.length === 0) {
		return undefined;
	}

	let bestCandidate = candidates[0];
	if (!bestCandidate) {
		return undefined;
	}

	for (const candidate of candidates) {
		if (
			candidate.width > bestCandidate.width &&
			candidate.width < containerWidth
		) {
			bestCandidate = candidate;
		}
	}

	return bestCandidate.url;
}

function getPostMetadata(metadata: unknown): PostMetadata {
	return metadata as PostMetadata;
}

const logger = createContextualLogger('ListDetailDisplay');

export default function ListDetailDisplay<
	T extends BaseMedia & MediaItemMetadata,
	M = undefined,
>({
	listItems: initialItems,
	loadMore,
	protocol,
	client,
	mode,
	handleSearchSubmit,
}: Properties<T, M>) {
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [carouselIndex, setCarouselIndex] = useState<number>(0);
	const [isSearchMode, setIsSearchMode] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchError, setSearchError] = useState<string | undefined>();
	const [combinedItems, setCombinedItems] =
		useState<Array<ListMediaItem<T, M>>>(initialItems);
	const seenStories = useRef(new Set<string>());
	const sidebarRef = useRef<DOMElement>(null as unknown as DOMElement);
	const combinedItemsRef = useRef(combinedItems);
	combinedItemsRef.current = combinedItems;

	const {exit} = useApp();
	const {stdout} = useStdout();

	const {height: sidebarHeight, hasMeasured} = useBoxMetrics(sidebarRef);
	const viewportSize = hasMeasured
		? Math.max(1, Math.floor(sidebarHeight))
		: 30;

	useEffect(() => {
		const seen = new Set<(typeof initialItems)[number]['pk']>();
		setCombinedItems(
			initialItems.filter(item => {
				if (seen.has(item.pk)) {
					return false;
				}

				seen.add(item.pk);
				return true;
			}),
		);
	}, [initialItems]);

	useEffect(() => {
		const clampedIndex = Math.min(
			selectedIndex,
			Math.max(0, combinedItems.length - 1),
		);
		const maxOffset = Math.max(0, combinedItems.length - viewportSize);
		let newOffset = Math.min(scrollOffset, maxOffset);

		if (clampedIndex < newOffset) {
			newOffset = clampedIndex;
		} else if (clampedIndex >= newOffset + viewportSize && viewportSize > 0) {
			newOffset = clampedIndex - viewportSize + 1;
		}

		setSelectedIndex(clampedIndex);
		setScrollOffset(newOffset);
	}, [combinedItems.length, viewportSize, scrollOffset, selectedIndex]);

	const currentItem = combinedItems[selectedIndex];
	const currentContentItem = currentItem?.content[carouselIndex];

	// Trigger lazy loading and reset carousel when the user selects a new item
	useEffect(() => {
		if (selectedIndex >= 0 && selectedIndex < combinedItems.length) {
			const item = combinedItems[selectedIndex];
			if (item?.content.length === 0) {
				loadMore(selectedIndex);
			}
		}

		// Reset carousel index when changing items
		setCarouselIndex(0);
	}, [selectedIndex, combinedItems, loadMore]);

	useEffect(() => {
		if (
			mode === 'story' &&
			currentContentItem &&
			client &&
			'id' in currentContentItem &&
			!seenStories.current.has((currentContentItem as Story).id)
		) {
			// Fire and forget: explicitly ignore the promise result
			void client
				.markStoriesAsSeen([currentContentItem as Story])
				.then(() => {
					seenStories.current.add((currentContentItem as Story).id);
				})
				.catch((error: unknown) => {
					logger.error('Failed to mark story as seen:', error);
				});
		}
	}, [currentContentItem, client, mode]);

	const getCurrentImage = (item: BaseMedia): MediaCandidate | undefined => {
		if (!item) return undefined;
		return item.image_versions2?.candidates?.[0] ?? undefined;
	};

	const openMediaUrl = async (activeItem: BaseMedia) => {
		if (!activeItem) return;

		let urlToOpen: string | undefined;

		if (activeItem.media_type === 1) {
			// Image
			urlToOpen = activeItem.image_versions2?.candidates?.[0]?.url;
		} else if (activeItem.media_type === 2) {
			// Video
			urlToOpen = activeItem.video_versions?.[0]?.url;
		}

		if (urlToOpen) {
			try {
				await open(urlToOpen);
			} catch (error: unknown) {
				logger.error('Failed to open media URL:', error);
			}
		} else {
			logger.error('No media URL available for this item.');
		}
	};

	const handleSearch = () => {
		if (!handleSearchSubmit) {
			return;
		}

		if (!client || !searchQuery.trim()) {
			setSearchError('Search query cannot be empty.');
			return;
		}

		setSearchError(undefined);
		void handleSearchSubmit(searchQuery.trim())
			.then(result => {
				if (result) {
					const currentItems = combinedItemsRef.current;
					const existingIndex = currentItems.findIndex(
						item => item.pk === result.pk,
					);
					const isExisting = existingIndex !== -1;
					if (isExisting) {
						setSelectedIndex(existingIndex);
						setScrollOffset(
							Math.max(
								0,
								Math.min(
									existingIndex - Math.floor(viewportSize / 2),
									Math.max(0, currentItems.length - viewportSize),
								),
							),
						);
					} else {
						setCombinedItems(prev => [result, ...prev]);
						setSelectedIndex(0);
						setScrollOffset(0);
					}
				} else {
					setSearchError(`No stories found for user "${searchQuery.trim()}".`);
				}

				setSearchQuery('');
				setIsSearchMode(false);
			})
			.catch((error: unknown) => {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				logger.error(`Search failed: ${errorMessage}`);
				setSearchError(`Search failed: ${errorMessage}`);
			});
	};

	useInput((input, key) => {
		if (isSearchMode) {
			if (key.escape) {
				setIsSearchMode(false);
				setSearchQuery('');
				setSearchError(undefined);
			} else if (key.return) {
				handleSearch();
			}
			// Input component handles other keys when focused
		} else if (input === 's' && mode === 'story') {
			setIsSearchMode(true);
		} else if (key.upArrow || input === 'k') {
			const margin = Math.floor(viewportSize / 2);

			setSelectedIndex(prev => {
				const newIndex = Math.max(0, prev - 1);

				setScrollOffset(prevScroll => {
					if (newIndex < prevScroll + margin) {
						return Math.max(0, prevScroll - 1);
					}

					return prevScroll;
				});

				return newIndex;
			});
		} else if (key.downArrow || input === 'j') {
			const margin = Math.floor(viewportSize / 2);
			const maxScroll = Math.max(0, combinedItems.length - viewportSize);

			setSelectedIndex(prev => {
				const newIndex = Math.min(prev + 1, combinedItems.length - 1);

				setScrollOffset(prevScroll => {
					if (newIndex >= prevScroll + margin) {
						return Math.min(prevScroll + 1, maxScroll);
					}

					return prevScroll;
				});

				return newIndex;
			});
		} else if (key.leftArrow || input === 'h') {
			if (currentItem && currentItem.content.length > 1) {
				setCarouselIndex(prev => Math.max(0, prev - 1));
			}
		} else if (key.rightArrow || input === 'l') {
			if (currentItem && currentItem.content.length > 1) {
				setCarouselIndex(prev =>
					Math.min(prev + 1, currentItem.content.length - 1),
				);
			}
		} else if (input === 'o') {
			if (currentContentItem) {
				void openMediaUrl(currentContentItem);
			}
		} else if (key.escape || (key.ctrl && input === 'c')) {
			exit();
		}
	});
	const currentImageCandidate = currentContentItem
		? getCurrentImage(currentContentItem)
		: undefined;
	const bestImageUrl = useMemo(
		() =>
			currentContentItem
				? getBestImage(
						currentContentItem.image_versions2?.candidates,
						stdout.columns,
					)
				: undefined,
		[currentContentItem, stdout.columns],
	);

	const visibleItems = combinedItems.slice(
		scrollOffset,
		scrollOffset + viewportSize,
	);

	const sidebarContent = (
		<Box ref={sidebarRef} flexDirection="column" flexGrow={1}>
			{visibleItems.map((item, index) => {
				const absoluteIndex = scrollOffset + index;
				return (
					<Box key={item.pk} height={1} flexShrink={0}>
						<Text
							color={absoluteIndex === selectedIndex ? 'blue' : undefined}
							wrap="truncate-end"
						>
							{absoluteIndex === selectedIndex ? '➜ ' : '   '}
							{item.label}
						</Text>
					</Box>
				);
			})}
		</Box>
	);

	const mainContent = (
		<>
			{mode === 'story' && isSearchMode ? (
				<Box flexDirection="row" alignItems="center" marginBottom={1}>
					<Text>Search user: </Text>
					<TextInput
						focus
						placeholder="Enter username..."
						value={searchQuery}
						onChange={setSearchQuery}
					/>
				</Box>
			) : mode === 'story' ? (
				<Box marginBottom={1}>
					<Text dimColor>
						Press &apos;s&apos; to search for a user&apos;s stories
					</Text>
				</Box>
			) : null}
			{searchError && (
				<Box marginBottom={1}>
					<Text color="red">{searchError}</Text>
				</Box>
			)}

			{combinedItems.length === 0 ? (
				<Box flexGrow={1} justifyContent="center" alignItems="center">
					<Text>⏳ Loading {mode === 'story' ? 'stories' : 'posts'}...</Text>
				</Box>
			) : (
				<Box flexDirection="row" flexGrow={1} gap={1}>
					<MediaPane
						imageUrl={bestImageUrl}
						altText={
							currentContentItem ? `Media by ${currentItem?.label}` : undefined
						}
						protocol={protocol}
						mediaType={currentContentItem?.media_type}
						isLoading={!currentContentItem}
						originalWidth={currentImageCandidate?.width}
						originalHeight={currentImageCandidate?.height}
						carouselIndex={carouselIndex}
						carouselCount={currentItem?.content.length ?? 0}
					/>

					{/* Caption and stats */}
					<Box
						flexDirection="column"
						width="50%"
						paddingRight={3}
						overflow="hidden"
						justifyContent="flex-start"
					>
						<Box flexDirection="column" gap={1} marginBottom={1}>
							<Text color="green">👤 {currentItem?.label ?? 'Unknown'}</Text>

							{currentContentItem && 'taken_at' in currentContentItem && (
								<Text color="gray">
									{new Date(
										(currentContentItem as Story).taken_at * 1000,
									).toLocaleString()}
								</Text>
							)}

							{/* Story-specific: mentions */}
							{mode === 'story' &&
								currentContentItem &&
								'reel_mentions' in currentContentItem &&
								(() => {
									const mentions: ReelMention[] =
										(currentContentItem as Story).reel_mentions ?? [];

									if (mentions.length === 0) {
										return null;
									}

									return (
										<>
											<Text bold>Mentions:</Text>
											{mentions.map((mention, index) => (
												<Text key={index} color="blue">
													@{mention.user.username} ({mention.user.full_name})
												</Text>
											))}
										</>
									);
								})()}

							{/* Post-specific: caption, likes, comments */}
							{mode === 'post' &&
								currentItem?.additional_metadata &&
								(() => {
									const metadata = getPostMetadata(
										currentItem.additional_metadata,
									);
									return (
										<>
											{currentItem.additional_metadata && metadata.caption && (
												<Text wrap="wrap">{metadata.caption.text}</Text>
											)}
											<Box flexDirection="row" marginTop={1}>
												<Text>♡ {metadata.like_count ?? 0} </Text>
												<Text>🗨 {metadata.comment_count ?? 0}</Text>
											</Box>
										</>
									);
								})()}
						</Box>
					</Box>
				</Box>
			)}
		</>
	);

	return (
		<SplitView
			sidebarTitle={mode === 'story' ? '✨ Stories' : '📜 Feed'}
			sidebarContent={sidebarContent}
			mainContent={mainContent}
			footerText={
				mode === 'story'
					? 'j/k: users, h/l: stories, o: open, s: search, Esc: quit'
					: 'j/k: navigate posts, h/l: navigate carousel, o: open, Esc: quit'
			}
		/>
	);
}
