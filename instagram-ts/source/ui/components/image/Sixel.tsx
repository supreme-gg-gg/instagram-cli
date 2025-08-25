import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, Newline, useStdout, type DOMElement} from 'ink';
// import { backgroundContext } from "ink";
import {image2sixel} from 'sixel';
import {cursorTo} from 'ansi-escapes';
import usePosition from '../../hooks/usePosition.js';
import {useTerminalDimensions} from '../../context/TerminalPixelDimensions.js';
// import chalk from "chalk";
import {ImageProps, ImageProtocol} from './protocol.js';
import sharp from 'sharp';

class SixelProtocol extends ImageProtocol {
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
	override render(props: ImageProps) {
		const [imageOutput, setImageOutput] = useState<string | undefined>(
			undefined,
		);
		const [hasError, setHasError] = useState<boolean>(false);
		const {stdout} = useStdout();
		const containerRef = useRef<DOMElement | null>(null);
		const componentPosition = usePosition(containerRef);
		const terminalDimensions = useTerminalDimensions();
		const [actualSizeInCells, setActualSizeInCells] = useState<{
			width: number;
			height: number;
		} | null>(null);
		// TODO: If we upgrade to Ink 6 we will need to deal with Box background colors when rendering/cleaning up
		// const inheritedBackgroundColor = useContext(backgroundContext);

		useEffect(() => {
			const generateImageOutput = async () => {
				if (!containerRef.current) return;
				if (!terminalDimensions) return;

				const image = await this.fetchImage(props.src);
				if (!image) {
					setHasError(true);
					return;
				}
				setHasError(false);

				const metadata = await image.metadata();

				const {width: maxWidth, height: maxHeight} = componentPosition;
				const {width, height} = this.calculateImageSize({
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

				const output = await this.toSixel(resizedImage);
				setImageOutput(output);
			};
			generateImageOutput();
		}, [
			props.src,
			props.width,
			props.height,
			containerRef.current,
			terminalDimensions,
		]);

		// This effect should run after every re-render to render the sixel image because the previous image will be overwritten by Ink
		// TODO: maybe change this when incremental rendering is implemented in Ink
		useEffect(() => {
			if (!imageOutput) return;

			stdout.write(
				cursorTo(
					componentPosition.col,
					stdout.rows - componentPosition.appHeight + componentPosition.row,
				),
			);
			stdout.write(imageOutput);
			const previousRenderBoundingBox = {
				row: stdout.rows - componentPosition.appHeight + componentPosition.row,
				col: componentPosition.col,
				width: actualSizeInCells!.width,
				height: actualSizeInCells!.height,
			};

			return () => {
				for (let i = 0; i < previousRenderBoundingBox.height; i++) {
					stdout.write(
						cursorTo(
							previousRenderBoundingBox.col,
							previousRenderBoundingBox.row + i,
						),
					);
					// if (inheritedBackgroundColor) {
					//     const bgColor = "bg" + toProper(inheritedBackgroundColor);
					//     stdout.write(
					//         chalk[bgColor](" ".repeat(previousRenderBoundingBox.width) + "\n"),
					//     );
					// } else {
					stdout.write(' '.repeat(previousRenderBoundingBox.width) + '\n');
					// }
				}
				// Restore cursor position
				stdout.write(cursorTo(stdout.columns, stdout.rows));
			};
			// }, [imageOutput, ...Object.values(componentPosition)]);
		});

		return (
			<Box ref={containerRef} flexDirection="column" flexGrow={1}>
				{imageOutput ? (
					<Text color="gray" wrap="wrap">
						If you don't see an image after a few seconds, your terminal might
						not support Sixel
					</Text>
				) : (
					<Box
						flexDirection="column"
						alignItems="center"
						justifyContent="center"
					>
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

	private async toSixel(imageData: {data: Buffer; info: sharp.OutputInfo}) {
		const {data, info} = imageData;
		const {width, height} = info;
		const u8Data = new Uint8Array(data);

		const sixelData = image2sixel(u8Data, width, height);
		return sixelData;
	}

	private calculateImageSize({
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
			return {width, height};
		}

		// Only width specified
		if (specifiedWidth) {
			let width = Math.min(specifiedWidth, maxWidth);
			let height = width / originalAspectRatio;

			if (height > maxHeight) {
				height = maxHeight;
				width = height * originalAspectRatio;
			}

			return {width, height};
		}

		// Only height specified
		if (specifiedHeight) {
			let height = Math.min(specifiedHeight, maxHeight);
			let width = height * originalAspectRatio;

			if (width > maxWidth) {
				width = maxWidth;
				height = width / originalAspectRatio;
			}

			return {width, height};
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

		return {width, height};
	}
}

export default SixelProtocol;
