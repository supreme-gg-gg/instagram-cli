import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, Newline, useStdout, type DOMElement} from 'ink';
// import { backgroundContext } from "ink";
import {image2sixel} from 'sixel';
import usePosition from '../../hooks/usePosition.js';
import {
	useTerminalDimensions,
	useTerminalCapabilities,
} from '../../context/TerminalInfo.js';
import {type ImageProps} from './protocol.js';
import sharp from 'sharp';
import {fetchImage, calculateImageSize} from '../../../utils/image.js';

/**
 * Sixel Image Rendering Component
 *
 * Displays images using the Sixel graphics protocol, providing the highest quality
 * image rendering in supported terminals. Sixel is a bitmap graphics format that
 * can display true color images at full resolution.
 *
 * Features:
 * - Highest quality image rendering (true color, full resolution)
 * - Supports all image formats
 * - Requires specific terminal support (VT340+, xterm, iTerm2, etc.)
 * - Direct pixel-to-pixel rendering
 *
 * Technical Details:
 * - Uses the Sixel graphics protocol
 * - Renders directly to terminal using escape sequences
 * - Bypasses Ink's normal rendering pipeline for control over image position
 * - Requires careful cursor management and cleanup
 *
 * **EXPERIMENTAL COMPONENT WARNING:**
 * This component does not follow React/Ink's normal rendering lifecycle.
 * It implements custom rendering logic that writes directly to the terminal.
 * While designed to be as React-compatible as possible, you may experience:
 * - Rendering flicker
 * - Cursor positioning issues
 * - Cleanup problems on component unmount
 *
 * How it works:
 * 1. A Box component reserves space in the layout
 * 2. Image is fetched and converted to Sixel format
 * 3. useEffect hook renders image directly to terminal after each Ink render
 * 4. Previous image is cleared before rendering new content
 * 5. Cleanup occurs on component unmount or re-render
 * 6. Cleanup will not be performed when application terminates (so the rendered image is preserved in its location)
 *
 * @param props - Image rendering properties
 * @returns JSX element that manages Sixel image display
 */
function SixelImage(props: ImageProps) {
	const [imageOutput, setImageOutput] = useState<string | undefined>(undefined);
	const [hasError, setHasError] = useState<boolean>(false);
	const {stdout} = useStdout();
	const containerRef = useRef<DOMElement | null>(null);
	const componentPosition = usePosition(containerRef);
	const terminalDimensions = useTerminalDimensions();
	const terminalCapabilities = useTerminalCapabilities();
	const [actualSizeInCells, setActualSizeInCells] = useState<{
		width: number;
		height: number;
	} | null>(null);
	const shouldCleanupRef = useRef<boolean>(true);

	// Detect support and notify parent
	useEffect(() => {
		if (!terminalCapabilities) return;

		// Sixel rendering requires explicit sixel graphics support
		const isSupported = terminalCapabilities.supportsSixelGraphics;
		props.onSupportDetected?.(isSupported);
	}, [terminalCapabilities, props.onSupportDetected]);

	// TODO: If we upgrade to Ink 6 we will need to deal with Box background colors when rendering/cleaning up
	// const inheritedBackgroundColor = useContext(backgroundContext);

	/**
	 * Main effect for image processing and Sixel conversion.
	 *
	 * This effect:
	 * 1. Fetches and processes the source image
	 * 2. Calculates appropriate sizing based on terminal dimensions
	 * 3. Resizes image to fit within the component's allocated space
	 * 4. Ensures alpha channel is present (required by node-sixel)
	 * 5. Converts processed image data to Sixel format
	 * 6. Tracks actual size in terminal cells for cleanup purposes
	 */
	useEffect(() => {
		const generateImageOutput = async () => {
			if (!componentPosition) return;
			if (!terminalDimensions) return;

			const image = await fetchImage(props.src);
			if (!image) {
				setHasError(true);
				return;
			}
			setHasError(false);

			const metadata = await image.metadata();

			const {width: maxWidth, height: maxHeight} = componentPosition;
			const {width, height} = calculateImageSize({
				maxWidth: maxWidth * terminalDimensions.cellWidth,
				maxHeight: maxHeight * terminalDimensions.cellHeight,
				originalAspectRatio: metadata.width / metadata.height,
				specifiedWidth: props.width
					? props.width * terminalDimensions.cellWidth
					: undefined,
				specifiedHeight: props.height
					? props.height * terminalDimensions.cellHeight
					: undefined,
			});

			const resizedImage = await image
				.resize(width, height)
				.ensureAlpha() // node-sixel requires alpha channel to be present
				.raw()
				.toBuffer({resolveWithObject: true});
			setActualSizeInCells({
				width: Math.floor(
					resizedImage.info.width / terminalDimensions.cellWidth,
				),
				height: Math.floor(
					resizedImage.info.height / terminalDimensions.cellHeight,
				),
			});

			const output = await toSixel(resizedImage);
			setImageOutput(output);
		};
		generateImageOutput();
	}, [
		props.src,
		props.width,
		props.height,
		componentPosition,
		terminalDimensions,
	]);

	/**
	 * Critical rendering effect for Sixel image display.
	 *
	 * This effect runs after every re-render to display the Sixel image because
	 * Ink overwrites the terminal content with each render cycle. This is a
	 * necessary workaround for the current Ink architecture.
	 *
	 * Process:
	 * 1. Validates that image and position data are available
	 * 2. Checks if the image would be visible within terminal bounds
	 * 3. Sets up process exit handlers for cleanup
	 * 4. Positions cursor to the correct location
	 * 5. Writes Sixel data directly to stdout
	 * 6. Restores cursor position
	 * 7. Returns cleanup function for previous render cleanup
	 *
	 * Cursor Management:
	 * - Moves cursor up to component position
	 * - Moves cursor right to correct column
	 * - Writes image data
	 * - Moves cursor back down to original position
	 *
	 * Cleanup Strategy:
	 * - Tracks previous render bounding box
	 * - Clears previous image by writing spaces
	 * - Handles process exit gracefully
	 *
	 * TODO: This may change when Ink implements incremental rendering
	 */
	useEffect(() => {
		if (!imageOutput) return;
		if (!componentPosition) return;
		if (
			stdout.rows - componentPosition.appHeight + componentPosition.row < 0 ||
			componentPosition.col > stdout.columns
		)
			return;

		function onExit() {
			shouldCleanupRef.current = false;
		}
		function onSigInt() {
			shouldCleanupRef.current = false;
			process.exit();
		}
		process.on('exit', onExit);
		process.on('SIGINT', onSigInt);
		process.on('SIGTERM', onSigInt);

		stdout.write(cursorUp(componentPosition.appHeight - componentPosition.row));
		stdout.write('\r');
		stdout.write(cursorForward(componentPosition.col));
		stdout.write(imageOutput);
		stdout.write(
			cursorDown(componentPosition.appHeight - componentPosition.row),
		);
		stdout.write('\r');

		const previousRenderBoundingBox = {
			row: stdout.rows - componentPosition.appHeight + componentPosition.row,
			col: componentPosition.col,
			width: actualSizeInCells!.width,
			height: actualSizeInCells!.height,
		};

		return () => {
			process.removeListener('exit', onExit);
			process.removeListener('SIGINT', onSigInt);
			process.removeListener('SIGTERM', onSigInt);

			if (!shouldCleanupRef.current) return;

			stdout.write(
				cursorUp(componentPosition.appHeight - componentPosition.row),
			);
			for (let i = 0; i < previousRenderBoundingBox.height; i++) {
				stdout.write('\r');
				stdout.write(cursorForward(previousRenderBoundingBox.col));
				// if (inheritedBackgroundColor) {
				//   const bgColor = "bg" + toProper(inheritedBackgroundColor);
				//   stdout.write(
				//     chalk[bgColor](" ".repeat(previousRenderBoundingBox.width) + "\n"),
				//   );
				// } else {
				stdout.write(' '.repeat(previousRenderBoundingBox.width));
				stdout.write('\n');
				// }
			}
			// Restore cursor position
			stdout.write(
				cursorDown(
					componentPosition.appHeight -
						componentPosition.row -
						previousRenderBoundingBox.height,
				),
			);
			stdout.write('\r');
		};
		// }, [imageOutput, ...Object.values(componentPosition)]);
	});

	return (
		<Box ref={containerRef} flexDirection="column" flexGrow={1}>
			{imageOutput ? (
				<Text color="gray" wrap="wrap">
					{props.alt || 'Loading...'}
				</Text>
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
 * Converts processed image data to Sixel format.
 *
 * This function takes raw RGBA image data from Sharp and converts it to
 * the Sixel graphics format using the node-sixel library. The resulting
 * string contains escape sequences that can be written directly to a
 * terminal that supports Sixel graphics.
 *
 * @param imageData - Raw image data with buffer and metadata from Sharp
 * @returns Promise resolving to Sixel-formatted string
 */
async function toSixel(imageData: {data: Buffer; info: sharp.OutputInfo}) {
	const {data, info} = imageData;
	const {width, height} = info;
	const u8Data = new Uint8Array(data);

	const sixelData = image2sixel(u8Data, width, height);
	return sixelData;
}

/**
 * Moves cursor forward (right) by specified number of columns.
 * @param count - Number of columns to move forward (default: 1)
 * @returns ANSI escape sequence string
 */
function cursorForward(count: number = 1) {
	return '\x1b[' + count + 'C';
}

/**
 * Moves cursor up by specified number of rows.
 * @param count - Number of rows to move up (default: 1)
 * @returns ANSI escape sequence string
 */
function cursorUp(count: number = 1) {
	return '\x1b[' + count + 'A';
}

/**
 * Moves cursor down by specified number of rows.
 * @param count - Number of rows to move down (default: 1)
 * @returns ANSI escape sequence string
 */
function cursorDown(count: number = 1) {
	return '\x1b[' + count + 'B';
}

export default SixelImage;
