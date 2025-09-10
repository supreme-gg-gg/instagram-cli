import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, Newline, measureElement, type DOMElement} from 'ink';
import sharp from 'sharp';
import {type ImageProps} from './protocol.js';
import {fetchImage, calculateImageSize} from '../../../utils/image.js';
import {useTerminalCapabilities} from '../../context/TerminalInfo.js';

/**
 * Braille Image Rendering Component
 *
 * Renders images using Unicode Braille patterns to create high-resolution monochrome representations.
 * Each Braille character can represent 8 pixels (2x4 grid), providing higher resolution than
 * other text-based rendering methods.
 *
 * Features:
 * - High resolution monochrome rendering (8 pixels per character)
 * - Uses Unicode Braille patterns (U+2800-U+28FF)
 * - Requires only Unicode support (no color needed)
 * - Good for detailed images and line art
 * - Works well for images with clear contrast
 *
 * Technical Details:
 * - Each Braille character represents a 2x4 pixel grid
 * - Uses luminance-based threshold for black/white conversion
 * - Handles transparency by treating transparent pixels as white
 * - Braille patterns are constructed using bit manipulation
 *
 * Braille Pattern Layout:
 * ```
 * 1 4
 * 2 5
 * 3 6
 * 7 8
 * ```
 *
 * @param props - Image rendering properties
 * @returns JSX element containing Braille pattern representation of the image
 */
function BrailleImage(props: ImageProps) {
	const [imageOutput, setImageOutput] = useState<string | null>(null);
	const [hasError, setHasError] = useState<boolean>(false);
	const containerRef = useRef<DOMElement | null>(null);
	const terminalCapabilities = useTerminalCapabilities();

	// Detect support and notify parent
	useEffect(() => {
		if (!terminalCapabilities) return;

		// Braille rendering requires Unicode support for braille characters
		const isSupported = terminalCapabilities.supportsUnicode;
		props.onSupportDetected?.(isSupported);
	}, [terminalCapabilities, props.onSupportDetected]);

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
				maxWidth: maxWidth * 2,
				maxHeight: maxHeight * 4,
				originalAspectRatio: metadata.width / metadata.height,
				specifiedWidth: props.width ? props.width * 2 : undefined,
				specifiedHeight: props.height ? props.height * 4 : undefined,
			});

			const resizedImage = await image
				.resize(width, height)
				.raw()
				.toBuffer({resolveWithObject: true});

			const output = await toBraille(resizedImage);
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

/**
 * Converts image data to Braille pattern representation.
 *
 * This function processes the image by:
 * 1. Grouping pixels into 2x4 grids (8 pixels per Braille character)
 * 2. Converting each pixel to black or white based on luminance threshold
 * 3. Mapping the 8 pixels to corresponding Braille dot positions
 * 4. Constructing Unicode Braille characters using bit manipulation
 *
 * How Braille patterns work:
 * - Each character represents 8 dots in a 2x4 arrangement
 * - Dot positions are numbered 1-8 as shown in the component description
 * - A raised dot (1) represents a white/bright pixel
 * - A flat dot (0) represents a black/dark pixel
 * - Unicode range U+2800-U+28FF covers all 256 possible combinations
 *
 * Reference: https://en.wikipedia.org/wiki/Braille_Patterns#Identifying,_naming_and_ordering
 *
 * @param imageData - Raw image data from Sharp with buffer and metadata
 * @returns Promise resolving to string of Braille Unicode characters
 */
async function toBraille(imageData: {data: Buffer; info: sharp.OutputInfo}) {
	const {data, info} = imageData;
	const {width, height, channels} = info;

	let result = '';
	for (let y = 0; y < height - 3; y += 4) {
		for (let x = 0; x < width - 1; x += 2) {
			const dot1Index = (y * width + x) * channels;
			const dot2Index = ((y + 1) * width + x) * channels;
			const dot3Index = ((y + 2) * width + x) * channels;
			const dot4Index = (y * width + x + 1) * channels;
			const dot5Index = ((y + 1) * width + x + 1) * channels;
			const dot6Index = ((y + 2) * width + x + 1) * channels;
			const dot7Index = ((y + 3) * width + x) * channels;
			const dot8Index = ((y + 3) * width + x + 1) * channels;

			function getRgba(index: number) {
				const r = data[index] as number;
				const g = data[index + 1] as number;
				const b = data[index + 2] as number;
				const a = channels === 4 ? (data[index + 3] as number) : 1;
				return {r, g, b, a};
			}

			const dot1 = rgbaToBlackOrWhite(getRgba(dot1Index));
			const dot2 = rgbaToBlackOrWhite(getRgba(dot2Index));
			const dot3 = rgbaToBlackOrWhite(getRgba(dot3Index));
			const dot4 = rgbaToBlackOrWhite(getRgba(dot4Index));
			const dot5 = rgbaToBlackOrWhite(getRgba(dot5Index));
			const dot6 = rgbaToBlackOrWhite(getRgba(dot6Index));
			const dot7 = rgbaToBlackOrWhite(getRgba(dot7Index));
			const dot8 = rgbaToBlackOrWhite(getRgba(dot8Index));

			const brailleChar = String.fromCharCode(
				0x2800 +
					(dot8 << 7) +
					(dot7 << 6) +
					(dot6 << 5) +
					(dot5 << 4) +
					(dot4 << 3) +
					(dot3 << 2) +
					(dot2 << 1) +
					dot1,
			);
			result += brailleChar;
		}
		result += '\n';
	}

	return result;
}

/**
 * Converts RGBA pixel values to binary (black or white) representation.
 *
 * This function:
 * 1. Calculates perceived luminance using the relative luminance formula
 * 2. Adjusts for alpha transparency (transparent pixels become lighter)
 * 3. Applies a threshold to determine if the pixel should be represented as a raised Braille dot
 *
 * The luminance formula uses coefficients based on human eye sensitivity:
 * - Red: 21.26% (0.2126)
 * - Green: 71.52% (0.7152) - eyes are most sensitive to green
 * - Blue: 7.22% (0.0722)
 *
 * Alpha handling makes transparent pixels appear closer to white, which is
 * appropriate for typical terminal backgrounds.
 *
 * @param rgba - RGBA color values (0-255 range)
 * @returns 1 for white/light pixels (raised dot), 0 for black/dark pixels (flat dot)
 */
function rgbaToBlackOrWhite({
	r,
	g,
	b,
	a,
}: {
	r: number;
	g: number;
	b: number;
	a: number;
}) {
	// 1. Extract the RGBA components from the input string.
	const red = r;
	const green = g;
	const blue = b;
	const alpha = a;

	// 2. Calculate the perceived luminance using the formula for relative luminance (Y).
	//    This formula is based on the sRGB color space and takes into account the human eye's sensitivity to different colors.
	const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

	// 3. Apply the alpha value to the luminance.  This makes transparent colors closer to white.
	const alphaAdjustedLuminance = luminance * alpha + 255 * (1 - alpha);

	// 4. Determine whether to return "black" or "white" based on the luminance.
	//    A threshold of 128 is commonly used to differentiate between dark and light colors.
	if (alphaAdjustedLuminance > 128) {
		return 1;
	} else {
		return 0;
	}
}

export default BrailleImage;
