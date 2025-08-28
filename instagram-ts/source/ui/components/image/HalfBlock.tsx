import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, Newline, measureElement, type DOMElement} from 'ink';
import chalk from 'chalk';
import sharp from 'sharp';
import {type ImageProps} from './protocol.js';
import {fetchImage, calculateImageSize} from '../../../utils/image.js';
import {useTerminalCapabilities} from '../../context/TerminalInfo.js';

/**
 * Half-Block Image Rendering Component
 *
 * Renders images using Unicode half-block characters (▄) with colored backgrounds and foregrounds.
 * This method provides higher resolution than ASCII art by utilizing both the character color
 * and background color to represent two pixels per character cell.
 *
 * Features:
 * - Higher resolution than ASCII (2 pixels per character)
 * - Full color support using terminal RGB colors
 * - Requires Unicode and color support
 * - Good balance between quality and compatibility
 *
 * Technical Details:
 * - Uses Unicode half-block character (U+2584 ▄)
 * - Top pixel represented by background color
 * - Bottom pixel represented by foreground color
 * - Requires terminal color and Unicode support
 * - Processes images in pairs of vertical pixels
 *
 * @param props - Image rendering properties
 * @returns JSX element containing half-block representation of the image
 */
function HalfBlockImage(props: ImageProps) {
	const [imageOutput, setImageOutput] = useState<string | null>(null);
	const [hasError, setHasError] = useState<boolean>(false);
	const containerRef = useRef<DOMElement | null>(null);
	const terminalCapabilities = useTerminalCapabilities();

	// Detect support and notify parent
	useEffect(() => {
		if (!terminalCapabilities) return;

		const isSupported =
			terminalCapabilities.supportsColor &&
			terminalCapabilities.supportsUnicode;
		props.onSupportDetected(isSupported);
	}, [props.onSupportDetected, terminalCapabilities]);

	useEffect(() => {
		const generateImageOutput = async () => {
			const image = await fetchImage(props.src);
			if (!image) {
				setHasError(true);
				return;
			}
			setHasError(false);

			const metadata = await image.metadata();

			if (!containerRef.current) return;
			const {width: maxWidth, height: maxHeight} = measureElement(
				containerRef.current,
			);
			const {width, height} = calculateImageSize({
				maxWidth: maxWidth,
				maxHeight: maxHeight * 2,
				originalAspectRatio: metadata.width / metadata.height,
				specifiedWidth: props.width,
				specifiedHeight: props.height ? props.height * 2 : undefined,
			});

			const resizedImage = await image
				.resize(width, height)
				.raw()
				.toBuffer({resolveWithObject: true});

			const output = await toHalfBlocks(resizedImage);
			setImageOutput(output);
		};
		generateImageOutput();
	}, [props.src, props.width, props.height, containerRef.current]);

	return (
		<Box ref={containerRef} flexDirection="column" flexGrow={1}>
			{imageOutput ? (
				imageOutput
					.split('\n')
					.map((line, index) => <Text key={index}>{line}</Text>)
			) : (
				<Box flexDirection="column" alignItems="center" justifyContent="center">
					{hasError && (
						<Text color="red">
							X<Newline />
							Load failed
						</Text>
					)}
					<Text color="gray">{props.alt || 'Loading...'}</Text>
				</Box>
			)}
		</Box>
	);
}

/** Unicode half-block character (▄) used for rendering */
const HALF_BLOCK = '\u2584';

/**
 * Converts image data to half-block representation.
 *
 * This function processes the image by:
 * 1. Iterating through pixels in pairs (top and bottom)
 * 2. Using the top pixel color as background
 * 3. Using the bottom pixel color as foreground
 * 4. Rendering a half-block character with these colors
 * 5. Handling transparency by using spaces for transparent pixels
 *
 * The half-block character (▄) fills the bottom half of the character cell,
 * so the background color shows through the top half, effectively displaying
 * two pixels per character position.
 *
 * Adapted from https://github.com/sindresorhus/terminal-image
 *
 * @param imageData - Raw image data from Sharp with buffer and metadata
 * @returns Promise resolving to formatted string with colored half-block characters
 */
async function toHalfBlocks(imageData: {data: Buffer; info: sharp.OutputInfo}) {
	const {data, info} = imageData;
	const {width, height, channels} = info;

	let result = '';
	for (let y = 0; y < height - 1; y += 2) {
		for (let x = 0; x < width; x++) {
			const topPixelIndex = (y * width + x) * channels;
			const bottomPixelIndex = ((y + 1) * width + x) * channels;

			const r = data[topPixelIndex] as number;
			const g = data[topPixelIndex + 1] as number;
			const b = data[topPixelIndex + 2] as number;
			const a = channels === 4 ? (data[topPixelIndex + 3] as number) : 255;

			const r2 = data[bottomPixelIndex] as number;
			const g2 = data[bottomPixelIndex + 1] as number;
			const b2 = data[bottomPixelIndex + 2] as number;

			result +=
				a === 0
					? chalk.reset(' ')
					: chalk.bgRgb(r, g, b).rgb(r2, g2, b2)(HALF_BLOCK);
		}

		result += '\n';
	}

	return result;
}

export default HalfBlockImage;
