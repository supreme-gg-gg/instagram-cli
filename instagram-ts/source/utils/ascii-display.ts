import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import sharp from 'sharp';
import fs from 'fs/promises';
import AsciiArt from 'ascii-art';


async function fetchImage(url: string): Promise<Buffer> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch image: ${response.statusText}`);
	}
	return  Buffer.from(await response.arrayBuffer())
}

function drawAsciiWithBorder(asciiArt: string, width: number): string {
  const lines = asciiArt.split('\n');
  const horizontalBorder = '┌' + '─'.repeat(width + 2) + '┐';

  let borderedAscii = horizontalBorder + '\n';
  for (let i = 0; i < lines.length - 2; i++) { // Excluded the last two lines which are usually empty
    const line = lines[i];
    const paddedLine = line?.padEnd(width, ' ') ?? ''.padEnd(width, ' ');
    borderedAscii += `│ ${paddedLine} │\n`;
  }
  borderedAscii += '└' + '─'.repeat(width + 2) + '┘';

  return borderedAscii;
}



export async function convertImageToColorAscii(imageUrl: string, width: number = 100): Promise<string> {
  try {
    const buffer = await fetchImage(imageUrl);
    let finalPath = '';

		const pngBuffer = await sharp(buffer) //Preprocessing of the buffer
			.sharpen()
			.normalize()
			.png() //Sometimes the image is not in PNG format, so we convert it to PNG
			.toBuffer();
		finalPath = join(tmpdir(), `${randomUUID()}.png`);
		await fs.writeFile(finalPath, pngBuffer);

    const asciiArt = await AsciiArt.image({
      filepath: finalPath,
      width: width,
      colored: true,
    });

    const borderedAscii = drawAsciiWithBorder(asciiArt, width);

    // Delete the temporary image
    await fs.unlink(finalPath);

    return borderedAscii;
  } catch (error) {
    console.error('Error converting image to ASCII:', error);
    return '';
  }
}
