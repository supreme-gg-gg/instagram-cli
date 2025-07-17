import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import sharp from 'sharp';
import fs from 'fs/promises';
import AsciiArt from 'ascii-art';


async function fetchImage(url: string): Promise<[Buffer, string]> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch image: ${response.statusText}`);
	}
	return [Buffer.from(await response.arrayBuffer()), response.headers.get('content-type')!];
}

function drawAsciiWithBorder(asciiArt: string, width: number) {
	const lines = asciiArt.split('\n');
	const contentWidth = Math.max(...lines.map((line: string) => line.length));
	const horizontalBorder = '┌' + '─'.repeat(width + 2) + '┐';

	console.log(horizontalBorder);
	for (let i = 0; i < lines.length - 2; i++) { // Excluded the last two lines which are usually empty
		const line = lines[i];
		const paddedLine = line?.padEnd(contentWidth, ' ') ?? ''.padEnd(contentWidth, ' ');
		console.log(`│ ${paddedLine} │`);
	}
	console.log('└' + '─'.repeat(width + 2) + '┘');
}


export async function convertImageToColorAscii(imageUrl: string, width: number = 100) {
  try {
		const [buffer, contentType] = await fetchImage(imageUrl);
    let finalPath = '';

    if (contentType?.includes('image/webp')) {
      const pngBuffer = await sharp(buffer).png().toBuffer();
      finalPath = join(tmpdir(), `${randomUUID()}.png`);
      await fs.writeFile(finalPath, pngBuffer);
    } else {
      finalPath = join(tmpdir(), `${randomUUID()}.img`);
      await fs.writeFile(finalPath, buffer);
    }

    const asciiArt = await AsciiArt.image({
      filepath: finalPath,
      width: width,
      colored: true,
    });

		drawAsciiWithBorder(asciiArt, width);

    // Delete the temporary image
    await fs.unlink(finalPath);
  } catch (error) {
    console.error('Error converting image to ASCII:', error);
  }
}
