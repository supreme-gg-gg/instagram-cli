import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, Newline, measureElement, type DOMElement} from 'ink';
import sharp from 'sharp';
import {ImageProps, ImageProtocol} from './protocol.js';

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

export default BrailleProtocol;
