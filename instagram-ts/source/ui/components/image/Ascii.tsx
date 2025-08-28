import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, Newline, measureElement, type DOMElement} from 'ink';
import {join} from 'path';
import {tmpdir} from 'os';
import {randomUUID} from 'crypto';
import sharp from 'sharp';
import fs from 'fs/promises';
import AsciiArt from 'ascii-art';
import {type ImageProps} from './protocol.js';
import {fetchImage} from '../../../utils/image.js';
import {useTerminalCapabilities} from '../../context/TerminalInfo.js';

/**
 * ASCII Image Rendering Component
 *
 * Converts images to ASCII art using character-based representation.
 * This is the most compatible rendering method as it works in all terminals.
 *
 * Features:
 * - Works in all terminal environments (fallback protocol)
 * - Supports both monochrome and colored ASCII art
 * - Automatic color detection based on terminal capabilities
 *
 * Technical Details:
 * - Uses the 'ascii-art' library for image-to-ASCII conversion
 * - Applies image preprocessing (sharpening, normalization) for better results
 * - Color support is automatically detected and applied when available
 * - Temporary files are created and cleaned up during conversion
 *
 * @param props - Image rendering properties
 * @returns JSX element containing ASCII art representation of the image
 */
function AsciiImage(props: ImageProps) {
	const [imageOutput, setImageOutput] = useState<string | null>(null);
	const [hasError, setHasError] = useState<boolean>(false);
	const containerRef = useRef<DOMElement | null>(null);
	const terminalCapabilities = useTerminalCapabilities();

	// Detect support and notify parent
	useEffect(() => {
		if (!terminalCapabilities) return;

		// ASCII rendering works in all terminals, but colored ASCII requires color support
		// Inclusion of color support is dynamically handled by conversion logic
		const isSupported = true; // ASCII always works as fallback
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

			// const metadata = await image.metadata();

			if (!containerRef.current) return;
			const {width: maxWidth} = measureElement(containerRef.current);

			// // Calculate target size - ASCII art is character-based, so we use maxWidth directly
			// const {width} = calculateImageSize({
			// 	maxWidth,
			// 	maxHeight,
			// 	originalAspectRatio: metadata.width! / metadata.height!,
			// 	specifiedWidth: props.width,
			// 	specifiedHeight: props.height,
			// });

			const output = await toAscii(
				image,
				props.width ?? maxWidth,
				terminalCapabilities?.supportsColor,
			);
			setImageOutput(output);
		};
		generateImageOutput();
	}, [
		props.src,
		props.width,
		props.height,
		containerRef.current,
		terminalCapabilities,
	]);

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
 * Converts an image to ASCII art representation.
 *
 * This function processes the image through several steps:
 * 1. Applies image preprocessing (sharpening, normalization) for better conversion results
 * 2. Creates a temporary PNG file for the ascii-art library
 * 3. Generates ASCII art with optional color support
 * 4. Cleans up temporary files
 *
 * @param image - Sharp image instance to convert
 * @param width - Target width in characters for the ASCII output
 * @param supportsColor - Whether to generate colored ASCII art
 * @returns Promise resolving to ASCII art string representation
 */
async function toAscii(
	image: sharp.Sharp,
	width: number,
	supportsColor?: boolean,
): Promise<string> {
	try {
		// Preprocess the image for better ASCII conversion
		const processedBuffer = await image.sharpen().normalize().png().toBuffer();

		// Create temporary file for ascii-art library
		const tempPath = join(tmpdir(), `${randomUUID()}.png`);
		await fs.writeFile(tempPath, processedBuffer);

		try {
			// Generate ASCII art using ascii-art library
			const asciiArt = await AsciiArt.image({
				filepath: tempPath,
				width,
				colored: supportsColor ?? false,
			});

			// Clean up temporary file
			await fs.unlink(tempPath);

			return asciiArt;
		} catch (error) {
			// Clean up temporary file even if conversion fails
			try {
				await fs.unlink(tempPath);
			} catch {
				// Ignore cleanup errors
			}
			throw error;
		}
	} catch (error) {
		console.error('Error converting image to ASCII:', error);
		return '';
	}
}

export default AsciiImage;
