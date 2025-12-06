import React, {useState, useEffect, useMemo} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import open from 'open';
import {type ImageProtocolName} from 'ink-picture';
import {
	type Post,
	type FeedInstance,
	type MediaCandidate,
} from '../../types/instagram.js';
import {createContextualLogger} from '../../utils/logger.js';
import SplitView from './split-view.js';
import MediaPane from './media-pane.js';

type Properties = {
	readonly feed: FeedInstance;
	readonly protocol?: ImageProtocolName;
};

const logger = createContextualLogger('ListMediaView');

export default function ListMediaDisplay({feed, protocol}: Properties) {
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [carouselIndex, setCarouselIndex] = useState<number>(0);
	const {exit} = useApp();

	const posts = feed.posts || [];

	// Memoized current image based on selection and carousel index
	const currentImage = useMemo((): MediaCandidate | undefined => {
		const currentPost = posts[selectedIndex];
		if (!currentPost) return undefined;

		if (currentPost.carousel_media) {
			const carouselItem = currentPost.carousel_media[carouselIndex];
			return carouselItem?.image_versions2?.candidates?.[0] ?? undefined;
		}

		return currentPost.image_versions2?.candidates?.[0] ?? undefined;
	}, [posts, selectedIndex, carouselIndex]);

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

	const currentPost = posts[selectedIndex];

	const sidebarContent = (
		<>
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
		</>
	);

	const mainContent =
		posts.length === 0 ? (
			<Box flexGrow={1} justifyContent="center" alignItems="center">
				<Text>⏳ Loading posts...</Text>
			</Box>
		) : (
			<Box flexDirection="row" flexGrow={1} overflow="hidden" gap={1}>
				<MediaPane
					imageUrl={currentImage?.url}
					altText={
						currentPost?.caption?.text ??
						`Post by ${currentPost?.user?.username}`
					}
					protocol={protocol}
					mediaType={currentPost?.media_type}
					isLoading={!currentPost}
					originalWidth={currentImage?.width}
					originalHeight={currentImage?.height}
					carouselIndex={carouselIndex}
					carouselCount={currentPost?.carousel_media_count ?? 0}
				/>

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
							👤 {currentPost?.user?.username ?? 'Unknown user'}
						</Text>
						{currentPost?.taken_at && (
							<Text color="gray">
								{' ('}
								{new Date(currentPost.taken_at * 1000).toLocaleString()})
							</Text>
						)}
					</Box>
					<Text wrap="wrap">{currentPost?.caption?.text ?? 'No caption'}</Text>

					<Box flexDirection="row" marginTop={1}>
						<Text>♡ {currentPost?.like_count ?? 0} </Text>
						<Text>🗨 {currentPost?.comment_count ?? 0}</Text>
					</Box>
				</Box>
			</Box>
		);

	return (
		<SplitView
			sidebarTitle="📜 Feed"
			sidebarContent={sidebarContent}
			mainContent={mainContent}
			footerText="j/k: navigate through posts, h/l: navigate through carousel, o: open in browser, Esc: quit"
		/>
	);
}
