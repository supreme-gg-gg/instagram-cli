import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, Newline, measureElement, type DOMElement} from 'ink';
import chalk from 'chalk';
import sharp from 'sharp';
import {type ImageProps} from './protocol.js';
import {fetchImage, calculateImageSize} from '../../../utils/image.js';

function HalfBlockImage(props: ImageProps) {
	const [imageOutput, setImageOutput] = useState<string | null>(null);
	const [hasError, setHasError] = useState<boolean>(false);
	const containerRef = useRef<DOMElement | null>(null);
	useEffect(() => {
		const generateImageOutput = async () => {
			if (!containerRef.current) return;

			const image = await fetchImage(props.src);
			if (!image) {
				setHasError(true);
				return;
			}
			setHasError(false);

			const metadata = await image.metadata();

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

const HALF_BLOCK = '\u2584';

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
