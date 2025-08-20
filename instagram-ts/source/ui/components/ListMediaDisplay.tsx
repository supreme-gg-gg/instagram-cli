import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import {Post, PostContainer, FeedInstance} from '../../types/instagram.js';
import open from 'open';

export default function ListMediaDisplay({posts}: FeedInstance) {
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [carouselIndex, setCarouselIndex] = useState<number>(0);

	if (posts.length === 0) {
		return <Text>No posts available.</Text>;
	}

	const openMediaUrl = (activeMedia: PostContainer) => {
		const item = activeMedia.current_media
			? activeMedia.current_media
			: activeMedia.post;
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

	const getActiveMedia = (post: Post, index: number): PostContainer => {
		if (post.carousel_media && post.carousel_media.length > 0) {
			return {
				post: post,
				current_media: post.carousel_media[index] ?? post.carousel_media[0]!,
			};
		}
		return {
			post: post,
			current_media: null,
		};
	};

	useInput((input, key) => {
		if (input === 'j' || key.downArrow) {
			setSelectedIndex(prev => Math.min(prev + 1, posts.length - 1));
			setCarouselIndex(0);
		} else if (input === 'k' || key.upArrow) {
			setSelectedIndex(prev => Math.max(prev - 1, 0));
			setCarouselIndex(0);
		} else if (input === 'o' || key.return) {
			const selectedItem = posts[selectedIndex];
			if (selectedItem) {
				const baseItem = posts[selectedIndex];
				if (baseItem) {
					openMediaUrl(getActiveMedia(baseItem, carouselIndex));
				}
			}
		} else if (input === 'q' || key.escape) {
			process.exit(0);
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
		}
	});

	const selectedPost = posts[selectedIndex]!;

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
				<Box
					flexDirection="column"
					borderStyle="round"
					padding={1}
					flexGrow={1}
					height="100%"
					overflow="hidden"
				>

					<Box flexDirection="row" flexGrow={1} overflow="hidden" gap={1}>
						{/* Media display */}
						<Box
							flexDirection="column"
							flexGrow={1}
							overflow="hidden"
							alignItems="center"
							justifyContent="flex-start"
							width={'50%'}
						>
							{selectedPost.ascii_image ? (
								selectedPost.ascii_image.split('\n').map((line, i) => (
									<Text key={i} wrap="truncate">
										{line}
									</Text>
								))
							) : (
								<Text color="yellow">⏳ Loading media...</Text>
							)}

							<Text>
								{selectedPost.media_type === 2 || selectedPost?.media_type === 2
									? '▶ Video'
									: ''}
							</Text>
							<Text color="gray">
								{selectedPost.carousel_media_count
									? `Carousel ${carouselIndex + 1} of ${
											selectedPost.carousel_media_count
									  }`
									: ''}
							</Text>
						</Box>
						{/* Caption and stats */}
						<Box
							flexDirection="column"
							width={'50%'}
							paddingRight={3}
							overflow="hidden"
							justifyContent="flex-start"
						>
							<Box flexDirection="row">
								<Text color="green">
									👤 {selectedPost.user?.username || 'Unknown user'}
								</Text>
								<Text color="gray">
									{' ('}
									{new Date(selectedPost.taken_at * 1000).toLocaleString()}
									{')'}
								</Text>
							</Box>
							<Text>{'\n'}</Text>
							<Text wrap="wrap">
								{selectedPost.caption?.text || 'No caption'}
							</Text>
							<Text>{'\n'}</Text>

							<Box flexDirection="row">
								<Text>
									{' '}
									♡ {selectedPost.like_count ?? 0}
									{'   '}
								</Text>
								<Text>
									🗨{'  '}
									{selectedPost.comment_count ?? 0}
								</Text>
							</Box>
						</Box>
					</Box>
				</Box>
			</Box>

			{/* Footer */}
			<Box marginTop={1}>
				<Text dimColor>
					j/k: navigate trough posts, h/l: navigate trough carousel, o: open in
					browser, q: quit
				</Text>
			</Box>
		</Box>
	);
}
