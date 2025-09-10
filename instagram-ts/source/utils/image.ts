import fetch from 'node-fetch';
import sharp from 'sharp';

export async function fetchImage(
	src: string,
): Promise<sharp.Sharp | undefined> {
	try {
		let imageBuffer: Buffer;
		if (src.startsWith('http')) {
			const response = await fetch(src);
			if (!response.ok) {
				throw new Error(`Failed to fetch image: ${response.statusText}`);
			}
			imageBuffer = Buffer.from(await response.arrayBuffer());
		} else {
			// Assume local file path
			imageBuffer = await sharp(src).toBuffer();
		}

		return sharp(imageBuffer);
	} catch (error) {
		// console.error('Failed to fetch image:', error);
		return undefined;
	}
}

export function calculateImageSize({
	maxWidth,
	maxHeight,
	originalAspectRatio,
	specifiedWidth,
	specifiedHeight,
}: {
	maxWidth: number;
	maxHeight: number;
	originalAspectRatio: number;
	specifiedWidth?: number;
	specifiedHeight?: number;
}): {width: number; height: number} {
	// Both width and height specified
	if (specifiedWidth && specifiedHeight) {
		const width = Math.min(specifiedWidth, maxWidth);
		const height = Math.min(specifiedHeight, maxHeight);
		return {width: Math.round(width), height: Math.round(height)};
	}

	// Only width specified
	if (specifiedWidth) {
		let width = Math.min(specifiedWidth, maxWidth);
		let height = width / originalAspectRatio;

		if (height > maxHeight) {
			height = maxHeight;
			width = height * originalAspectRatio;
		}

		return {width: Math.round(width), height: Math.round(height)};
	}

	// Only height specified
	if (specifiedHeight) {
		let height = Math.min(specifiedHeight, maxHeight);
		let width = height * originalAspectRatio;

		if (width > maxWidth) {
			width = maxWidth;
			height = width / originalAspectRatio;
		}

		return {width: Math.round(width), height: Math.round(height)};
	}

	// No dimensions specified - scale to fit while maintaining aspect ratio
	let height = maxHeight;
	let width = height * originalAspectRatio;

	if (width > maxWidth) {
		width = maxWidth;
		height = width / originalAspectRatio;
	}

	if (height > maxHeight) {
		height = maxHeight;
		width = height * originalAspectRatio;
	}

	return {width: Math.round(width), height: Math.round(height)};
}
