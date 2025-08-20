import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import {FeedItem, CarouselMediaItem} from '../../types/instagram.js';
import open from 'open';

type Props = {
	feedItems: FeedItem[];
	asciiImages: string[];
};

type ActiveMedia = {
	feed: FeedItem;
	media: CarouselMediaItem | null;
};

export default function ListMediaDisplay({feedItems, asciiImages}: Props) {
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [carouselIndex, setCarouselIndex] = useState<number>(0);

	if (feedItems.length === 0) {
		return <Text>No posts available.</Text>;
	}

	const openMediaUrl = (activeMedia: ActiveMedia) => {
		const item = activeMedia.media ? activeMedia.media : activeMedia.feed;
		if (item.media_type === 2) {
			// If media is a video, open the video URL
			const videoUrl = item.video_versions?.[0]?.url;
			if (videoUrl) {
				open(videoUrl).catch(err => {
					console.error('Failed to open video URL:', err);
				});
			} else {
				console.error('No video URL available for this item.');
			}
		} else if (item.image_versions2?.candidates?.[0]?.url) {
			const imageUrl = item.image_versions2.candidates[0].url;
			open(imageUrl).catch(err => {
				console.error('Failed to open image URL:', err);
			});
		} else {
			console.error('No valid media URL available for this item.');
		}
	};

	const getActiveMedia = (item: FeedItem, index: number): ActiveMedia => {
		if (item.carousel_media && item.carousel_media.length > 0) {
			return {
				feed: item,
				media: item.carousel_media[index] ?? item.carousel_media[0]!,
			};
		}
		return {
			feed: item,
			media: null,
		};
	};

	useInput((input, key) => {
		if (input === 'j' || key.downArrow) {
			setSelectedIndex(prev => Math.min(prev + 1, feedItems.length - 1));
			setCarouselIndex(0);
		} else if (input === 'k' || key.upArrow) {
			setSelectedIndex(prev => Math.max(prev - 1, 0));
			setCarouselIndex(0);
		} else if (input === 'o' || key.return) {
			const selectedItem = feedItems[selectedIndex];
			if (selectedItem) {
				const baseItem = feedItems[selectedIndex];
				if (baseItem) {
					openMediaUrl(getActiveMedia(baseItem, carouselIndex));
				}
			}
		} else if (input === 'q' || key.escape) {
			process.exit(0);
		} else if (input === 'h' || key.leftArrow) {
			if (feedItems[selectedIndex]?.carousel_media) {
				setCarouselIndex(prev => Math.max(prev - 1, 0));
			}
		} else if (input === 'l' || key.rightArrow) {
			if (feedItems[selectedIndex]?.carousel_media) {
				setCarouselIndex(prev =>
												 Math.min(
													 prev + 1,
													 (feedItems[selectedIndex]?.carousel_media_count ?? 0) - 1,
												 ),
												);
			}
		}
	});

	const baseItem = feedItems[selectedIndex]!;
	const selectedItem = getActiveMedia(baseItem, carouselIndex);
	const selectedAscii = asciiImages[selectedIndex]!;

	return (
		<Box flexDirection="column" height={process.stdout.rows} width="100%">
			{/* Main row */}
			<Box flexDirection="row" gap={2} flexGrow={1}>
				{/* Left column */}
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
					{feedItems.map((item, index) => (
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

				{/* Right column */}
				<Box
					flexDirection="column"
					borderStyle="round"
					padding={1}
					flexGrow={1}
					height="100%"
					overflow="hidden"
				>
					<Box flexDirection="row">
						<Text color="green">
							👤 {selectedItem.feed.user?.username || 'Unknown user'}
						</Text>
						<Text color="gray">
							{' ('}
							{new Date(selectedItem.feed.taken_at * 1000).toLocaleString()}
							{')'}
						</Text>
					</Box>

					<Text>{'\n'}</Text>

					<Box flexDirection="row" flexGrow={1} overflow="hidden" gap={1}>
						<Box
							flexDirection="column"
							flexGrow={1}
							overflow="hidden"
							alignItems="center"
							justifyContent="flex-start"
							width={'50%'}
						>
							{selectedAscii ? (
								selectedAscii.split('\n').map((line, i) => (
									<Text key={i} wrap="truncate">

										{line}
									</Text>
								))
							) : (
								<Text color="yellow">⏳ Loading media...</Text>
							)}

							<Text>
								{selectedItem.feed.media_type === 2 || selectedItem.media?.media_type === 2
									? '▶ Video'
									: ''}
							</Text>
							<Text color="gray">
								{selectedItem.feed.carousel_media_count
									? `Carousel ${carouselIndex + 1} of ${selectedItem.feed.carousel_media_count}`
									: ''}
							</Text>

						</Box>
						<Box flexDirection="column" width={'50%'} paddingRight={3} overflow="hidden" justifyContent="flex-start">
							<Text wrap="wrap">{selectedItem.feed.caption?.text || 'No caption'}</Text>
							<Text>{'\n'}</Text>

							<Box flexDirection="row">
								<Text>
									{' '}
									♡ {selectedItem.feed.like_count ?? 0}
									{'   '}
								</Text>
								<Text>
									🗨{'  '}
									{selectedItem.feed.comment_count ?? 0}
								</Text>
							</Box>
						</Box>
					</Box>
				</Box>
			</Box>

			{/* Footer */}
			<Box marginTop={1}>
				<Text dimColor>j/k: navigate, o: open in browser, q: quit</Text>
			</Box>
		</Box>
	);
}
