import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, Newline, measureElement, type DOMElement} from 'ink';
import chalk from 'chalk';
import fetch from 'node-fetch';
import sharp from 'sharp';
import fs from 'fs';

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

class BrailleProtocol extends ImageProtocol {
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

				const output = await this.toBraille(resizedImage);
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

	private async toBraille(imageData: {data: Buffer; info: sharp.OutputInfo}) {
		const {data, info} = imageData;
		const {width, height, channels} = info;

		let result = '';
		for (let y = 0; y < height - 3; y += 4) {
			for (let x = 0; x < width - 1; x += 2) {
				fs.writeFileSync('debug.log', `Processing pixels at (${x}, ${y})\n`, {
					flag: 'a',
				});
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

				fs.writeFileSync(
					'debug.log',
					`Color: ${JSON.stringify(getRgba(dot1Index))}\n`,
					{flag: 'a'},
				);
				const dot1 = this.rgbaToBlackOrWhite(getRgba(dot1Index));
				const dot2 = this.rgbaToBlackOrWhite(getRgba(dot2Index));
				const dot3 = this.rgbaToBlackOrWhite(getRgba(dot3Index));
				const dot4 = this.rgbaToBlackOrWhite(getRgba(dot4Index));
				const dot5 = this.rgbaToBlackOrWhite(getRgba(dot5Index));
				const dot6 = this.rgbaToBlackOrWhite(getRgba(dot6Index));
				const dot7 = this.rgbaToBlackOrWhite(getRgba(dot7Index));
				const dot8 = this.rgbaToBlackOrWhite(getRgba(dot8Index));

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

	private rgbaToBlackOrWhite({
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
	braille: new BrailleProtocol(),
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
