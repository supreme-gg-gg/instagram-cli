import React, {useState, useMemo, useEffect} from 'react';
import {Box, Text, useInput} from 'ink';
import open from 'open';
import {type ImageProtocolName} from 'ink-picture';
import {type Post, type MediaCandidate} from '../../types/instagram.js';
import {createContextualLogger} from '../../utils/logger.js';
import MediaPane from './media-pane.js';
import FullScreen from './full-screen.js';

type Properties = {
	readonly post: Post;
	readonly protocol?: ImageProtocolName;
	readonly onClose: () => void;
};

const logger = createContextualLogger('SinglePostView');

/**
 * A component to display a single shared post in a fullscreen view.
 */
export default function SinglePostView({post, protocol, onClose}: Properties) {
	const [carouselIndex, setCarouselIndex] = useState<number>(0);

	const carouselCount = useMemo(
		() => post.carousel_media?.length ?? post.carousel_media_count ?? 0,
		[post],
	);

	const clampedIndex = useMemo(
		() => Math.min(carouselIndex, Math.max(carouselCount - 1, 0)),
		[carouselCount, carouselIndex],
	);

	useEffect(() => {
		setCarouselIndex(previous =>
			Math.min(previous, Math.max(carouselCount - 1, 0)),
		);
	}, [carouselCount]);

	const currentImage = useMemo((): MediaCandidate | undefined => {
		if (post.carousel_media) {
			const carouselItem = post.carousel_media[clampedIndex];
			return carouselItem?.image_versions2?.candidates?.[0] ?? undefined;
		}

		return post.image_versions2?.candidates?.[0] ?? undefined;
	}, [post, clampedIndex]);

	const resolveMediaUrl = (): string | undefined => {
		if (post.media_type === 1) {
			return post.image_versions2?.candidates?.[0]?.url;
		}

		if (post.media_type === 2) {
			return post.video_versions?.[0]?.url;
		}

		if (post.carousel_media) {
			const carouselItem = post.carousel_media[clampedIndex];
			return (
				carouselItem?.image_versions2?.candidates?.[0]?.url ??
				carouselItem?.video_versions?.[0]?.url
			);
		}

		return undefined;
	};

	const openMediaUrl = async () => {
		const mediaUrl = resolveMediaUrl();
		if (!mediaUrl) {
			logger.error('No media URL available for this item.');
			return;
		}

		try {
			await open(mediaUrl);
		} catch (error) {
			logger.error('Failed to open media URL:', error);
		}
	};

	useInput((input, key) => {
		const hasCarousel = carouselCount > 0;

		if ((input === 'h' || key.leftArrow) && hasCarousel) {
			setCarouselIndex(previous => Math.max(previous - 1, 0));
		} else if ((input === 'l' || key.rightArrow) && hasCarousel) {
			setCarouselIndex(previous =>
				Math.min(previous + 1, Math.max(carouselCount - 1, 0)),
			);
		} else if (input === 'o' || key.return) {
			void openMediaUrl();
		} else if (key.escape || input === 'q') {
			onClose();
		}
	});

	return (
		<FullScreen>
			<Box flexDirection="column" height="100%" width="100%">
				<Box borderStyle="single" borderColor="blue">
					<Text bold color="blue">
						Shared post by @{post.user.username}
					</Text>
				</Box>

				<Box flexDirection="row" flexGrow={1} overflow="hidden" gap={1}>
					<MediaPane
						imageUrl={currentImage?.url}
						altText={post.caption?.text ?? `Post by ${post.user.username}`}
						protocol={protocol}
						mediaType={post.media_type}
						isLoading={false}
						originalWidth={currentImage?.width}
						originalHeight={currentImage?.height}
						carouselIndex={clampedIndex}
						carouselCount={carouselCount}
					/>

					<Box flexDirection="column" justifyContent="flex-start">
						<Box flexDirection="row">
							<Text color="green">{post.user.username}</Text>
							{post.taken_at && (
								<Text color="gray">
									{' ('}
									{new Date(post.taken_at * 1000).toLocaleString()})
								</Text>
							)}
						</Box>
						<Text wrap="wrap">{post.caption?.text ?? 'No caption'}</Text>

						<Box flexDirection="row" marginTop={1}>
							<Text>♡ {post.like_count ?? 0} </Text>
							<Text>🗨 {post.comment_count ?? 0}</Text>
						</Box>
					</Box>
				</Box>

				<Box marginTop={1}>
					<Text dimColor>
						h/l: navigate carousel, o: open in browser, Esc/q: close
					</Text>
				</Box>
			</Box>
		</FullScreen>
	);
}
