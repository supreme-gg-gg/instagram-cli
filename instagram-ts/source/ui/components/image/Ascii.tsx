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

function AsciiImage(props: ImageProps) {
	const [imageOutput, setImageOutput] = useState<string | null>(null);
	const [hasError, setHasError] = useState<boolean>(false);
	const containerRef = useRef<DOMElement | null>(null);
	const terminalCapabilities = useTerminalCapabilities();

	// Detect support and notify parent
	useEffect(() => {
		if (!terminalCapabilities) return;

		// ASCII rendering works in all terminals, but colored ASCII requires color support
		// Inclusion of olor support is dynamically handled by conversion logic
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
