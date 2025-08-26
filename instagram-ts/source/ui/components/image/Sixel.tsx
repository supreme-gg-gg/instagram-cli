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
 * Sixel image component for Ink
 * Displays an image in Sixel format
 * This requires your terminal to support the sixel image protocol
 *
 * THIS IS AN EXPERIMENTAL COMPONENT
 * It does not follow Ink's (React's) component rendering lifecycle
 * but instead implements custom rendering logic.
 * It tries to be as React compatible as possible,
 * but you may still experience flickering or other rendering issues.
 *
 * How this component works:
 * 1. A <Box> component is created to reserve space for the component
 * 2. The image is read and converted into sixel
 * 3. A useEffect() hook renders the image directly onto the terminal after each render by Ink
 * 4. The previous image is cleared from the terminal upon a new run of useEffect() or when the component unmounts
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

	// This effect should run after every re-render to render the sixel image because the previous image will be overwritten by Ink
	// TODO: maybe change this when incremental rendering is implemented in Ink
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

		stdout.write(
			cursorTo(
				stdout.rows - componentPosition.appHeight + componentPosition.row,
				componentPosition.col,
			),
		);
		stdout.write(imageOutput);

		stdout.write(cursorTo(stdout.rows, 0));
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

			for (let i = 0; i < previousRenderBoundingBox.height; i++) {
				stdout.write(
					cursorTo(
						previousRenderBoundingBox.row + i,
						previousRenderBoundingBox.col,
					),
				);
				// if (inheritedBackgroundColor) {
				//   const bgColor = "bg" + toProper(inheritedBackgroundColor);
				//   stdout.write(
				//     chalk[bgColor](" ".repeat(previousRenderBoundingBox.width) + "\n"),
				//   );
				// } else {
				stdout.write(' '.repeat(previousRenderBoundingBox.width));
				// }
			}
			// Restore cursor position
			stdout.write(cursorTo(stdout.rows, 0));
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

async function toSixel(imageData: {data: Buffer; info: sharp.OutputInfo}) {
	const {data, info} = imageData;
	const {width, height} = info;
	const u8Data = new Uint8Array(data);

	const sixelData = image2sixel(u8Data, width, height);
	return sixelData;
}

// Constructs an escape sequence for moving the cursor to a specific location in the terminal
function cursorTo(row: number, col: number) {
	const ESC = '\x1b[';
	const SEP = ';';
	return ESC + (row + 1 - 1) + SEP + (col + 1) + 'H';
}

export default SixelImage;
