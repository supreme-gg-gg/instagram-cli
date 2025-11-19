import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp, useStdout} from 'ink';
import open from 'open';
import Image, {type ImageProtocolName} from 'ink-picture';
import {
	type Post,
	type FeedInstance,
	type MediaCandidate,
} from '../../types/instagram.js';
import {createContextualLogger} from '../../utils/logger.js';
import AltScreen from './alt-screen.js';
import FullScreen from './full-screen.js';

type Properties = {
	readonly feed: FeedInstance;
	readonly protocol?: ImageProtocolName;
};

const logger = createContextualLogger('ListMediaView');

export default function ListMediaDisplay({feed, protocol}: Properties) {
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [carouselIndex, setCarouselIndex] = useState<number>(0);
	const {exit} = useApp();
	const {stdout} = useStdout();

	const posts = feed.posts || [];

	// Helper function to get current image based on selection and carousel index
	const getCurrentImage = (): MediaCandidate | undefined => {
		const currentPost = posts[selectedIndex];
		if (!currentPost) return undefined;

		if (currentPost.carousel_media) {
			const carouselItem = currentPost.carousel_media[carouselIndex];
			return carouselItem?.image_versions2?.candidates?.[0] ?? undefined;
		}

		return currentPost.image_versions2?.candidates?.[0] ?? undefined;
	};

	const openMediaUrl = async (activePost: Post) => {
		if (activePost.media_type === 1) {
			// If media is an image, open the image URL
			const imageUrl = activePost.image_versions2?.candidates?.[0]?.url;
			if (imageUrl) {
				try {
					await open(imageUrl);
				} catch (error) {
					logger.error('Failed to open image URL:', error);
				}
			} else {
				logger.error('No image URL available for this item.');
			}
		} else if (activePost.media_type === 2) {
			// If media is a video, open the video URL
			const videoUrl = activePost.video_versions?.[0]?.url;
			if (videoUrl) {
				try {
					await open(videoUrl);
				} catch (error) {
					logger.error('Failed to open video URL:', error);
				}
			} else {
				logger.error('No video URL available for this item.');
			}
		} else if (activePost.carousel_media) {
			// If media is a carousel, open the URL of the selected carousel item
			const carouselItem = activePost.carousel_media[carouselIndex];
			if (carouselItem) {
				const carouselUrl =
					carouselItem.image_versions2?.candidates?.[0]?.url ??
					carouselItem.video_versions?.[0]?.url;
				if (carouselUrl) {
					try {
						await open(carouselUrl);
					} catch (error) {
						logger.error('Failed to open carousel item URL:', error);
					}
				}
			}
		} else {
			logger.error('Unsupported media type or no media available.');
		}
	};

	useInput((input, key) => {
		// Post navigation
		if (input === 'j' || key.downArrow) {
			setSelectedIndex(previous => Math.min(previous + 1, posts.length - 1));
		} else if (input === 'k' || key.upArrow) {
			setSelectedIndex(previous => Math.max(previous - 1, 0));
			// Carousel navigation
		} else if (input === 'h' || key.leftArrow) {
			if (posts[selectedIndex]?.carousel_media) {
				setCarouselIndex(previous => Math.max(previous - 1, 0));
			}
		} else if (input === 'l' || key.rightArrow) {
			if (posts[selectedIndex]?.carousel_media) {
				setCarouselIndex(previous =>
					Math.min(
						previous + 1,
						(posts[selectedIndex]?.carousel_media_count ?? 0) - 1,
					),
				);
			}
			// Open in browser
		} else if (input === 'o' || key.return) {
			const selectedItem = posts[selectedIndex];
			if (selectedItem) {
				const baseItem = posts[selectedIndex];
				if (baseItem) {
					void openMediaUrl(baseItem);
				}
			}
			// Quit
		} else if (key.escape) {
			exit();
		}
	});

	useEffect(() => {
		setCarouselIndex(0);
	}, [selectedIndex]);

	const currentImage = getCurrentImage();
	const dynamicImageSize = currentImage
		? calculateDynamicPostMediaSize(
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
						{/* Users list */}
						<Box
							flexDirection="column"
							borderStyle="round"
							paddingX={1}
							width={30}
							flexShrink={0}
							height="100%"
						>
							<Text color="cyan">📜 Feed</Text>
							<Box height={1} />
							{posts.map((item, index) => (
								<Text
									key={item.id}
									color={index === selectedIndex ? 'blue' : undefined}
									wrap="truncate"
								>
									{index === selectedIndex ? '➜ ' : '   '}
									{item.user?.username || 'Unknown'}
								</Text>
							))}
						</Box>

						{/* Right panel */}
						<Box
							flexDirection="column"
							borderStyle="round"
							padding={1}
							flexGrow={1}
							height="100%"
							overflow="hidden"
						>
							{posts.length === 0 ? (
								<Box flexGrow={1} justifyContent="center" alignItems="center">
									<Text>⏳ Loading posts...</Text>
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
										width="50%"
									>
										{posts[selectedIndex] && getCurrentImage() ? (
											<Box
												borderStyle="round"
												borderColor="cyan"
												width={dynamicImageSize!.width + 2}
												height={dynamicImageSize!.height + 2}
											>
												<Image
													src={getCurrentImage()!.url}
													alt={
														posts[selectedIndex]?.caption?.text ??
														`Post by ${posts[selectedIndex]?.user?.username}`
													}
													// When protocol is undefined, the component will use "auto" by default
													protocol={protocol}
												/>
											</Box>
										) : (
											<Text color="yellow">⏳ Loading media...</Text>
										)}

										<Text>
											{posts[selectedIndex]?.media_type === 2 ? '▶ Video' : ''}
										</Text>
										<Text color="gray">
											{posts[selectedIndex]?.carousel_media_count
												? `Carousel ${carouselIndex + 1} of ${
														posts[selectedIndex].carousel_media_count
													}`
												: ''}
										</Text>
									</Box>

									{/* Caption and stats */}
									<Box
										flexDirection="column"
										width="50%"
										paddingRight={3}
										overflow="hidden"
										justifyContent="flex-start"
									>
										<Box flexDirection="row" marginBottom={1}>
											<Text color="green">
												👤{' '}
												{posts[selectedIndex]?.user?.username ?? 'Unknown user'}
											</Text>
											{posts[selectedIndex]?.taken_at && (
												<Text color="gray">
													{' ('}
													{new Date(
														posts[selectedIndex].taken_at * 1000,
													).toLocaleString()}
													)
												</Text>
											)}
										</Box>
										<Text wrap="wrap">
											{posts[selectedIndex]?.caption?.text ?? 'No caption'}
										</Text>

										<Box flexDirection="row" marginTop={1}>
											<Text>♡ {posts[selectedIndex]?.like_count ?? 0} </Text>
											<Text>🗨 {posts[selectedIndex]?.comment_count ?? 0}</Text>
										</Box>
									</Box>
								</Box>
							)}
						</Box>
					</Box>

					{/* Footer */}
					<Box marginTop={1}>
						<Text dimColor>
							j/k: navigate through posts, h/l: navigate through carousel, o:
							open in browser, Esc: quit
						</Text>
					</Box>
				</Box>
			</FullScreen>
		</AltScreen>
	);
}

function calculateDynamicPostMediaSize(
	imageWidth: number,
	imageHeight: number,
	termWidth: number,
	termHeight: number,
): {width: number; height: number} {
	let width = Math.min(Math.floor(termWidth / 3), 80);

	const aspectRatio = imageWidth / imageHeight;

	if (aspectRatio < 0.8) {
		width = Math.floor(width * 0.7);
	} else if (aspectRatio > 1.5) {
		width = Math.floor(width * 1.1);
	}

	const height = Math.max(termHeight, Math.floor((width / aspectRatio) * 0.5));
	return {width, height};
}
