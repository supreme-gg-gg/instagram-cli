import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, measureElement, type DOMElement} from 'ink';
import {intToRGBA, Jimp} from 'jimp';
import chalk from 'chalk';
import fetch from 'node-fetch';
// import sharp from 'sharp';
// import fs from 'fs/promises';

// function isUrl(str: string) {
// 	try {
// 		new URL(str);
// 		return true;
// 	} catch {
// 		return false;
// 	}
// }

// async function fetchImage(url: string): Promise<Buffer> {
// 	const response = await fetch(url);
// 	if (!response.ok) {
// 		throw new Error(`Failed to fetch image: ${response.statusText}`);
// 	}
// 	return Buffer.from(await response.arrayBuffer());
// }

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
}

class AsciiProtocol extends ImageProtocol {
	// @ts-expect-error aaa
	override render(props: ImageProps) {
		return null;
	}
}

class HalfBlockProtocol extends ImageProtocol {
	override render(props: ImageProps) {
		// const [containerSize, setContainerSize] = useState<{width: number; height: number}>({width: 48, height: 48});
		const [imageOutput, setImageOutput] = useState<string | null>(null);
		const containerRef = useRef<DOMElement | null>(null);
		useEffect(() => {
			const generateImageOutput = async () => {
				if (!containerRef.current) return;
				const image = await Jimp.read(props.src);
				const {width: maxWidth, height: maxHeight} = measureElement(
					containerRef.current,
				);
				const {width, height} = this.calculateImageSize({
					maxWidth: maxWidth,
					maxHeight: maxHeight * 2,
					originalAspectRatio: image.bitmap.width / image.bitmap.height,
					specifiedWidth: props.width,
					specifiedHeight: props.height ? props.height * 2 : undefined,
				});

				image.resize({w: width, h: height});

				const output = await this.toHalfBlocks(image);
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
					<Text>{props.alt || 'Loading...'}</Text>
				)}
			</Box>
		);
	}
	private HALF_BLOCK = '\u2584';

	private async toHalfBlocks(image: Awaited<ReturnType<typeof Jimp.read>>) {
		let result = '';
		for (let y = 0; y < image.bitmap.height - 1; y += 2) {
			for (let x = 0; x < image.bitmap.width; x++) {
				const {r, g, b, a} = intToRGBA(image.getPixelColor(x, y));
				const {r: r2, g: g2, b: b2} = intToRGBA(image.getPixelColor(x, y + 1));
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
