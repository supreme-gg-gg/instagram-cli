import React, {useState, useEffect, useMemo, useRef} from 'react';
import {Box, Text, useInput, useApp, useStdout} from 'ink';
import open from 'open';
import TextInput from 'ink-text-input';
import {type ImageProtocolName} from 'ink-picture';
import {
	type ListMediaItem,
	type MediaCandidate,
	type Story,
	type PostMetadata,
	type ReelMention,
	type BaseMedia,
} from '../../types/instagram.js';
import {createContextualLogger} from '../../utils/logger.js';
import {type InstagramClient} from '../../client.js';
import SplitView from './split-view.js';
import MediaPane from './media-pane.js';

type Properties = {
	readonly listItems: ListMediaItem[];
	readonly loadMore: (index: number) => void;
	readonly protocol?: ImageProtocolName;
	readonly client: InstagramClient | undefined;
	readonly mode: 'story' | 'post';
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

const logger = createContextualLogger('ListDetailDisplay');

export default function ListDetailDisplay({
	listItems: initialItems,
	loadMore,
	protocol,
	client,
	mode,
}: Properties) {
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [carouselIndex, setCarouselIndex] = useState<number>(0);
	const [isSearchMode, setIsSearchMode] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchError, setSearchError] = useState<string | undefined>();
	const [combinedItems, setCombinedItems] =
		useState<ListMediaItem[]>(initialItems);
	const seenStories = useRef(new Set<string>());

	const {exit} = useApp();
	const {stdout} = useStdout();

	useEffect(() => {
		setCombinedItems(initialItems);
	}, [initialItems]);

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
			!seenStories.current.has((currentContentItem as unknown as Story).id)
		) {
			// Fire and forget: explicitly ignore the promise result
			void client
				.markStoriesAsSeen([currentContentItem as unknown as Story])
				.then(() => {
					seenStories.current.add((currentContentItem as unknown as Story).id);
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

	// TODO: check that
	const handleSearchSubmit = async () => {
		if (!client || !searchQuery.trim()) {
			setSearchError('Search query cannot be empty.');
			return;
		}

		setSearchError(undefined);
		try {
			const stories = await client.getStoriesForUser(
				undefined,
				searchQuery.trim(),
			);
			if (stories.length > 0 && stories[0]?.user) {
				const newItem: ListMediaItem<Story> = {
					label: stories[0].user.username,
					content: stories,
				};
				setCombinedItems(prev => [newItem, ...prev]);
				setSelectedIndex(0);
			} else {
				setSearchError(`No stories found for user "${searchQuery.trim()}".`);
			}

			setSearchQuery('');
			setIsSearchMode(false);
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			logger.error(`Search failed: ${errorMessage}`);
			setSearchError(`Search failed: ${errorMessage}`);
		}
	};

	useInput((input, key) => {
		if (isSearchMode) {
			if (key.escape) {
				setIsSearchMode(false);
				setSearchQuery('');
				setSearchError(undefined);
			} else if (key.return) {
				void handleSearchSubmit();
			}
			// Input component handles other keys when focused
		} else if (input === 's' && mode === 'story') {
			setIsSearchMode(true);
		} else if (key.upArrow || input === 'k') {
			setSelectedIndex(prev => Math.max(0, prev - 1));
		} else if (key.downArrow || input === 'j') {
			setSelectedIndex(prev => Math.min(prev + 1, combinedItems.length - 1));
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

	const sidebarContent = (
		<>
			{combinedItems.map((item, index) => (
				<Box key={item.pk} height={1} flexShrink={0}>
					<Text
						color={index === selectedIndex ? 'blue' : undefined}
						wrap="truncate-end"
					>
						{index === selectedIndex ? '➜ ' : '   '}
						{item.label}
					</Text>
				</Box>
			))}
		</>
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
										(currentContentItem as unknown as Story).taken_at * 1000,
									).toLocaleString()}
								</Text>
							)}

							{/* Story-specific: mentions */}
							{mode === 'story' &&
								currentContentItem &&
								'reel_mentions' in currentContentItem &&
								(() => {
									const mentions: ReelMention[] =
										(currentContentItem as unknown as Story).reel_mentions ??
										[];

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
									const metadata =
										currentItem.additional_metadata as PostMetadata;
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
