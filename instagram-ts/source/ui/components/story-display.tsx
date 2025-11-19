import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp, useStdout} from 'ink';
import open from 'open';
import Image, {type ImageProtocolName} from 'ink-picture';
import TextInput from 'ink-text-input';
import {
	type Story,
	type MediaCandidate,
	type StoryReel,
} from '../../types/instagram.js';
import {createContextualLogger} from '../../utils/logger.js';
import {type InstagramClient} from '../../client.js';
import AltScreen from './alt-screen.js';
import FullScreen from './full-screen.js';

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

// Helper function to calculate dynamic media size (adapted from list-media-display)
function calculateDynamicStoryMediaSize(
	imageWidth: number,
	imageHeight: number,
	termWidth: number,
	termHeight: number,
): {width: number; height: number} {
	let width = Math.min(Math.floor(termWidth / 3), 80); // Adjusted for story panel width

	const aspectRatio = imageWidth / imageHeight;

	// Stories are often vertical, so adjust width for aspect ratio
	if (aspectRatio < 0.8) {
		width = Math.floor(width * 0.7);
	} else if (aspectRatio > 1.5) {
		width = Math.floor(width * 1.1);
	}

	const height = Math.max(termHeight, Math.floor((width / aspectRatio) * 0.5));
	return {width, height};
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

	const {exit} = useApp();
	const {stdout} = useStdout();

	useEffect(() => {
		setCombinedReels(initialReels);
	}, [initialReels]);

	const currentReel = combinedReels[selectedIndex];
	const currentStory = currentReel?.stories[carouselIndex];

	// Trigger lazy loading when the user selects a new reel
	useEffect(() => {
		if (selectedIndex >= 0 && selectedIndex < combinedReels.length) {
			const reel = combinedReels[selectedIndex];
			if (reel && reel.stories.length === 0) {
				loadMore(selectedIndex);
			}
		}
	}, [selectedIndex, combinedReels, loadMore]);

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

	useEffect(() => {
		setCarouselIndex(0);
	}, [selectedIndex]);

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

	const currentImage = currentStory ? getCurrentImage(currentStory) : undefined;
	const dynamicImageSize = currentImage
		? calculateDynamicStoryMediaSize(
				currentImage.width,
				currentImage.height,
				stdout.columns,
				stdout.rows,
			)
		: undefined;

	return (
		<AltScreen>
			<FullScreen>
				<Box flexDirection="column" height="100%" width="100%">
					<Box flexDirection="row" gap={2} flexGrow={1}>
						{/* Stories list (Left panel) */}
						<Box
							flexDirection="column"
							borderStyle="round"
							paddingY={1}
							paddingX={1}
							width={30} // Fixed width for the list panel
							flexShrink={0}
							height="100%"
						>
							<Text color="cyan">✨ Stories</Text>
							<Box height={1} />
							{combinedReels.map((reel, index) => (
								<Text
									key={reel.user.pk}
									color={index === selectedIndex ? 'blue' : undefined}
								>
									{index === selectedIndex ? '➜ ' : '   '}
									{reel.user?.username || 'Unknown'}
								</Text>
							))}
						</Box>

						{/* Right panel: Media display and details */}
						<Box
							flexDirection="column"
							borderStyle="round"
							padding={1}
							flexGrow={1}
							height="100%"
							overflow="hidden"
						>
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
								<Box flexDirection="row" flexGrow={1} overflow="hidden" gap={1}>
									{/* Media display */}
									<Box
										flexDirection="column"
										flexGrow={1}
										overflow="hidden"
										alignItems="center"
										justifyContent="flex-start"
										width="50%" // Allocate width based on layout
									>
										{currentStory &&
										getBestImage(
											currentStory.image_versions2?.candidates,
											stdout.columns,
										) ? (
											<Box
												borderStyle="round"
												borderColor="cyan"
												width={dynamicImageSize!.width + 2}
												height={dynamicImageSize!.height + 2}
											>
												<Image
													src={
														getBestImage(
															currentStory.image_versions2?.candidates,
															stdout.columns,
														)!
													}
													alt={
														currentStory?.caption?.text ??
														`Story by ${currentStory?.user?.username}`
													}
													protocol={protocol}
												/>
											</Box>
										) : currentStory?.media_type === 2 ? (
											<Text color="yellow">▶ Video Story (no preview)</Text>
										) : (
											<Text color="yellow">⏳ Loading media...</Text>
										)}

										<Text>
											{currentStory?.media_type === 2 ? '▶ Video' : ''}
										</Text>
										{currentReel && currentReel.stories.length > 1 && (
											<Text color="gray">
												Story {carouselIndex + 1} of{' '}
												{currentReel.stories.length}
											</Text>
										)}
									</Box>

									{/* Caption and stats */}
									<Box
										flexDirection="column"
										width="50%" // Allocate width based on layout
										paddingRight={3}
										overflow="hidden"
										justifyContent="flex-start"
									>
										<Box flexDirection="row" marginBottom={1}>
											<Text color="green">
												👤 {currentStory?.user?.username ?? 'Unknown user'}
											</Text>
											{currentStory?.taken_at && (
												<Text color="gray">
													{' ('}
													{new Date(
														currentStory.taken_at * 1000,
													).toLocaleString()}
													)
												</Text>
											)}
										</Box>
										<Text wrap="wrap">
											{currentStory?.caption?.text ?? 'No caption'}
										</Text>
									</Box>
								</Box>
							)}
						</Box>
					</Box>

					{/* Footer */}
					<Box marginTop={1}>
						<Text dimColor>
							j/k: users, h/l: stories, o: open, s: search, Esc: quit
						</Text>
					</Box>
				</Box>
			</FullScreen>
		</AltScreen>
	);
}
