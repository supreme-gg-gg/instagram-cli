import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, Newline, measureElement, type DOMElement} from 'ink';
import chalk from 'chalk';
import fetch from 'node-fetch';
import sharp from 'sharp';

interface ImageProps {
	src: string;
	width?: number;
	height?: number;
	alt?: string;
}

class ImageProtocol {
	// @ts-expect-error props of virtual function is not used
	render(props: ImageProps) {
		throw new Error('Render method must be implemented by child classes');
	}

	protected async fetchImage(src: string): Promise<sharp.Sharp | undefined> {
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
			console.error('Failed to fetch image:', error);
			return undefined;
		}
	}
}

class AsciiProtocol extends ImageProtocol {
	// @ts-expect-error aaa
	override render(props: ImageProps) {
		return null;
	}
}

class HalfBlockProtocol extends ImageProtocol {
	override render(props: ImageProps) {
		const [imageOutput, setImageOutput] = useState<string | null>(null);
		const [hasError, setHasError] = useState<boolean>(false);
		const containerRef = useRef<DOMElement | null>(null);
		useEffect(() => {
			const generateImageOutput = async () => {
				if (!containerRef.current) return;

				const image = await this.fetchImage(props.src);
				if (!image) {
					setHasError(true);
					return;
				}
				setHasError(false);

				const metadata = await image.metadata();

				const {width: maxWidth, height: maxHeight} = measureElement(
					containerRef.current,
				);
				const {width, height} = this.calculateImageSize({
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

				const output = await this.toHalfBlocks(resizedImage);
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
	private HALF_BLOCK = '\u2584';

	private async toHalfBlocks(imageData: {
		data: Buffer;
		info: sharp.OutputInfo;
	}) {
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
						: chalk.bgRgb(r, g, b).rgb(r2, g2, b2)(this.HALF_BLOCK);
			}

			result += '\n';
		}

		return result;
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

const protocolFactory = {
	ascii: new AsciiProtocol(),
	halfBlock: new HalfBlockProtocol(),
	// Add more protocols as needed
};

// Main Image component
function Image({
	src,
	width,
	height,
	protocol = 'ascii',
	...props
}: ImageProps & {protocol?: keyof typeof protocolFactory}) {
	if (!protocolFactory[protocol]) {
		console.warn(`Unknown protocol "${protocol}", falling back to ASCII`);
		protocol = 'ascii';
	}

	return protocolFactory[protocol].render({src, width, height, ...props});
}

export const ImageProtocols = Object.keys(protocolFactory) as Array<
	keyof typeof protocolFactory
>;
export default Image;
