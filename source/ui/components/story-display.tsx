import React, {useState, useEffect, useMemo, useRef} from 'react';
import {Box, Text, useInput, useApp, useStdout} from 'ink';
import open from 'open';
import {type ImageProtocolName} from 'ink-picture';
import TextInput from 'ink-text-input';
import {
	type Story,
	type MediaCandidate,
	type StoryReel,
	type ReelMention,
} from '../../types/instagram.js';
import {createContextualLogger} from '../../utils/logger.js';
import {type InstagramClient} from '../../client.js';
import SplitView from './split-view.js';
import MediaPane from './media-pane.js';

type Properties = {
	readonly reels: StoryReel[];
	readonly loadMore: (index: number) => void;
	readonly protocol?: ImageProtocolName;
	readonly client: InstagramClient | undefined;
};

// Helper function to get the best image candidate
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

const logger = createContextualLogger('StoryDisplay');

export default function StoryDisplay({
	reels: initialReels,
	loadMore,
	protocol,
	client,
}: Properties) {
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [carouselIndex, setCarouselIndex] = useState<number>(0);
	const [isSearchMode, setIsSearchMode] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchError, setSearchError] = useState<string | undefined>();
	const [combinedReels, setCombinedReels] = useState<StoryReel[]>(initialReels);
	const seenStories = useRef(new Set<string>());

	const {exit} = useApp();
	const {stdout} = useStdout();

	useEffect(() => {
		setCombinedReels(initialReels);
	}, [initialReels]);

	const currentReel = combinedReels[selectedIndex];
	const currentStory = currentReel?.stories[carouselIndex];

	// Trigger lazy loading and reset carousel when the user selects a new reel
	useEffect(() => {
		if (selectedIndex >= 0 && selectedIndex < combinedReels.length) {
			const reel = combinedReels[selectedIndex];
			if (reel?.stories.length === 0) {
				loadMore(selectedIndex);
			}
		}

		// Reset carousel index when changing reels
		setCarouselIndex(0);
	}, [selectedIndex, combinedReels, loadMore]);

	useEffect(() => {
		if (currentStory && client && !seenStories.current.has(currentStory.id)) {
			// Fire and forget: explicitly ignore the promise result
			void client
				.markStoriesAsSeen([currentStory])
				.then(() => {
					seenStories.current.add(currentStory.id);
				})
				.catch((error: unknown) => {
					logger.error('Failed to mark story as seen:', error);
				});
		}
	}, [currentStory, client]);

	// Helper function to get current image based on selection
	const getCurrentImage = (story: Story): MediaCandidate | undefined => {
		if (!story) return undefined;
		return story.image_versions2?.candidates?.[0] ?? undefined;
	};

	const openMediaUrl = async (activeStory: Story) => {
		if (!activeStory) return;

		let urlToOpen: string | undefined;

		if (activeStory.media_type === 1) {
			// Image story
			urlToOpen = activeStory.image_versions2?.candidates?.[0]?.url;
		} else if (activeStory.media_type === 2) {
			// Video story
			urlToOpen = activeStory.video_versions?.[0]?.url;
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
				const newReel: StoryReel = {user: stories[0].user, stories};
				setCombinedReels(prev => [newReel, ...prev]);
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
		} else if (input === 's') {
			setIsSearchMode(true);
		} else if (key.upArrow || input === 'k') {
			setSelectedIndex(prev => Math.max(0, prev - 1));
		} else if (key.downArrow || input === 'j') {
			setSelectedIndex(prev => Math.min(prev + 1, combinedReels.length - 1));
		} else if (key.leftArrow || input === 'h') {
			if (currentReel && currentReel.stories.length > 1) {
				setCarouselIndex(prev => Math.max(0, prev - 1));
			}
		} else if (key.rightArrow || input === 'l') {
			if (currentReel && currentReel.stories.length > 1) {
				setCarouselIndex(prev =>
					Math.min(prev + 1, currentReel.stories.length - 1),
				);
			}
		} else if (input === 'o') {
			if (currentStory) {
				void openMediaUrl(currentStory);
			}
		} else if (key.escape) {
			exit();
		}
	});

	const currentImageCandidate = currentStory
		? getCurrentImage(currentStory)
		: undefined;
	const bestImageUrl = useMemo(
		() =>
			currentStory
				? getBestImage(currentStory.image_versions2?.candidates, stdout.columns)
				: undefined,
		[currentStory, stdout.columns],
	);

	const sidebarContent = (
		<>
			{combinedReels.map((reel, index) => (
				<Box key={reel.user.pk} height={1} flexShrink={0}>
					<Text
						color={index === selectedIndex ? 'blue' : undefined}
						wrap="truncate-end"
					>
						{index === selectedIndex ? '➜ ' : '   '}
						{reel.user?.username || 'Unknown'}
					</Text>
				</Box>
			))}
		</>
	);

	const mainContent = (
		<>
			{isSearchMode ? (
				<Box flexDirection="row" alignItems="center" marginBottom={1}>
					<Text>Search user: </Text>
					<TextInput
						focus
						placeholder="Enter username..."
						value={searchQuery}
						onChange={setSearchQuery}
					/>
				</Box>
			) : (
				<Box marginBottom={1}>
					<Text dimColor>
						Press &apos;s&apos; to search for a user&apos;s stories
					</Text>
				</Box>
			)}
			{searchError && (
				<Box marginBottom={1}>
					<Text color="red">{searchError}</Text>
				</Box>
			)}

			{combinedReels.length === 0 ? (
				<Box flexGrow={1} justifyContent="center" alignItems="center">
					<Text>⏳ Loading stories...</Text>
				</Box>
			) : (
				<Box flexDirection="row" flexGrow={1} gap={1}>
					<MediaPane
						imageUrl={bestImageUrl}
						altText={`Story by ${currentStory?.user?.username}`}
						protocol={protocol}
						mediaType={currentStory?.media_type}
						isLoading={!currentStory}
						originalWidth={currentImageCandidate?.width}
						originalHeight={currentImageCandidate?.height}
						carouselIndex={carouselIndex}
						carouselCount={currentReel?.stories.length ?? 0}
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
							<Text color="green">
								👤 {currentStory?.user?.username ?? 'Unknown user'}
							</Text>

							{currentStory?.taken_at && (
								<Text color="gray">
									{new Date(currentStory.taken_at * 1000).toLocaleString()}
								</Text>
							)}

							{(() => {
								const mentions: ReelMention[] =
									currentStory?.reel_mentions ?? [];

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
						</Box>
					</Box>
				</Box>
			)}
		</>
	);

	return (
		<SplitView
			sidebarTitle="✨ Stories"
			sidebarContent={sidebarContent}
			mainContent={mainContent}
			footerText="j/k: users, h/l: stories, o: open, s: search, Esc: quit"
		/>
	);
}
