import sharp from 'sharp';
import fetch from 'node-fetch';

export interface ImageProps {
	src: string;
	width?: number;
	height?: number;
	alt?: string;
}

export abstract class ImageProtocol {
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
