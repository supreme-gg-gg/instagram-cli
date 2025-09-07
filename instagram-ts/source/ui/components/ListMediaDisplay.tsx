import React, {useState, useEffect} from 'react';
import {Box, Text, useInput} from 'ink';
import {Post, FeedInstance} from '../../types/instagram.js';
import open from 'open';
import Image from './image/index.js';

type Props = {
	feed: FeedInstance;
	protocol?: string;
};

export default function ListMediaDisplay({feed, protocol}: Props) {
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [carouselIndex, setCarouselIndex] = useState<number>(0);

	const posts = feed.posts || [];

	// Helper function to get current image URL based on selection and carousel index
	const getCurrentImageUrl = (): string | null => {
		const currentPost = posts[selectedIndex];
		if (!currentPost) return null;

		if (currentPost.carousel_media) {
			const carouselItem = currentPost.carousel_media[carouselIndex];
			return carouselItem?.image_versions2?.candidates?.[0]?.url || null;
		}

		return currentPost.image_versions2?.candidates?.[0]?.url || null;
	};

	const openMediaUrl = (activePost: Post) => {
		if (activePost.media_type === 1) {
			// If media is an image, open the image URL
			const imageUrl = activePost.image_versions2?.candidates?.[0]?.url;
			if (imageUrl) {
				open(imageUrl).catch(err => {
					console.error('Failed to open image URL:', err);
				});
			} else {
				console.error('No image URL available for this item.');
			}
		} else if (activePost.media_type === 2) {
			// If media is a video, open the video URL
			const videoUrl = activePost.video_versions?.[0]?.url;
			if (videoUrl) {
				open(videoUrl).catch(err => {
					console.error('Failed to open video URL:', err);
				});
			} else {
				console.error('No video URL available for this item.');
			}
		} else if (activePost.carousel_media) {
			// If media is a carousel, open the URL of the selected carousel item
			const carouselItem = activePost.carousel_media[carouselIndex];
			if (carouselItem) {
				const carouselUrl =
					carouselItem.image_versions2?.candidates?.[0]?.url ||
					carouselItem.video_versions?.[0]?.url;
				if (carouselUrl) {
					open(carouselUrl).catch(err => {
						console.error('Failed to open carousel item URL:', err);
					});
				}
			}
		} else {
			console.error('Unsupported media type or no media available.');
		}
	};

	useInput((input, key) => {
		//Post navigation
		if (input === 'j' || key.downArrow) {
			setSelectedIndex(prev => Math.min(prev + 1, posts.length - 1));
		} else if (input === 'k' || key.upArrow) {
			setSelectedIndex(prev => Math.max(prev - 1, 0));
			//Carousel navigation
		} else if (input === 'h' || key.leftArrow) {
			if (posts[selectedIndex]?.carousel_media) {
				setCarouselIndex(prev => Math.max(prev - 1, 0));
			}
		} else if (input === 'l' || key.rightArrow) {
			if (posts[selectedIndex]?.carousel_media) {
				setCarouselIndex(prev =>
					Math.min(
						prev + 1,
						(posts[selectedIndex]?.carousel_media_count ?? 0) - 1,
					),
				);
			}
			//Open in browser
		} else if (input === 'o' || key.return) {
			const selectedItem = posts[selectedIndex];
			if (selectedItem) {
				const baseItem = posts[selectedIndex];
				if (baseItem) {
					openMediaUrl(baseItem);
				}
			}
			//Quit
		} else if (input === 'q' || key.escape) {
			process.exit(0);
		}
	});

	useEffect(() => {
		setCarouselIndex(0);
	}, [selectedIndex]);

	return (
		<Box flexDirection="column" height={process.stdout.rows} width="100%">
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
								{posts[selectedIndex] && getCurrentImageUrl() ? (
									<Box
										borderStyle="round"
										borderColor="cyan"
										width={32}
										height={17}
									>
										<Image
											src={getCurrentImageUrl()!}
											alt={
												posts[selectedIndex]?.caption?.text ||
												`Post by ${posts[selectedIndex]?.user?.username}`
											}
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
								<Box flexDirection="row">
									<Text color="green">
										👤 {posts[selectedIndex]?.user?.username || 'Unknown user'}
									</Text>
									{posts[selectedIndex]?.taken_at && (
										<Text color="gray">
											{' ('}
											{new Date(
												posts[selectedIndex].taken_at * 1000,
											).toLocaleString()}
											{')'}
										</Text>
									)}
								</Box>
								<Text>{'\n'}</Text>
								<Text wrap="wrap">
									{posts[selectedIndex]?.caption?.text || 'No caption'}
								</Text>
								<Text>{'\n'}</Text>

								<Box flexDirection="row">
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
					j/k: navigate through posts, h/l: navigate through carousel, o: open
					in browser, q: quit
				</Text>
			</Box>
		</Box>
	);
}
