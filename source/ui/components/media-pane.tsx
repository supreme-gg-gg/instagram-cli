import React, {useMemo} from 'react';
import {Box, Text, useStdout} from 'ink';
import Image, {type ImageProtocolName} from 'ink-picture';

type Properties = {
	readonly imageUrl?: string;
	readonly altText?: string;
	readonly protocol?: ImageProtocolName;
	readonly mediaType?: number; // 1 = image, 2 = video
	readonly isLoading?: boolean;
	readonly originalWidth?: number;
	readonly originalHeight?: number;
	readonly carouselIndex?: number;
	readonly carouselCount?: number;
};

export default function MediaPane({
	imageUrl,
	altText,
	protocol,
	mediaType,
	isLoading,
	originalWidth,
	originalHeight,
	carouselIndex,
	carouselCount,
}: Properties) {
	const {stdout} = useStdout();

	const dynamicImageSize = useMemo(
		() =>
			imageUrl && originalWidth && originalHeight
				? calculateDynamicMediaSize(
						originalWidth,
						originalHeight,
						stdout.columns,
						stdout.rows,
					)
				: undefined,
		[imageUrl, originalWidth, originalHeight, stdout.columns, stdout.rows],
	);

	return (
		<Box
			flexDirection="column"
			flexShrink={0}
			overflow="hidden"
			alignItems="center"
			justifyContent="flex-start"
			width="50%"
		>
			{isLoading ? (
				<Text color="yellow">⏳ Loading media...</Text>
			) : imageUrl && dynamicImageSize ? (
				<Box
					borderStyle="round"
					borderColor="cyan"
					width={dynamicImageSize.width}
					height={dynamicImageSize.height}
				>
					<Image src={imageUrl} alt={altText} protocol={protocol} />
				</Box>
			) : mediaType === 2 ? (
				<Text color="yellow">▶ Video (no preview)</Text>
			) : (
				<Text color="red">No media available</Text>
			)}

			<Text>{mediaType === 2 ? '▶ Video' : ''}</Text>
			{carouselCount && carouselCount > 1 ? (
				<Text color="gray">
					Carousel {(carouselIndex ?? 0) + 1} of {carouselCount}
				</Text>
			) : null}
		</Box>
	);
}

function calculateDynamicMediaSize(
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
