
import React from 'react';
import zod from 'zod';
import {argument} from 'pastel';
import {InstagramClient} from '../client.js';
import {ConfigManager} from '../config.js';
import AsciiArt from 'ascii-art';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'username',
				description: 'Username to fetch feed for (optional)',
			}),
		),
]);

type Props = {
	args: zod.infer<typeof args>;
};

const width = 100

export async function convertImageToColorAscii(imagePath: string) {
  try {
    const asciiArt = await AsciiArt.image({
      filepath: imagePath,
      width: width,
      colored: true,
    });

    const lines = asciiArt.split('\n');
		const contentWidth = Math.max(...lines.map((line : string) => line.length));
    const horizontalBorder = '┌' + '─'.repeat(width + 2) + '┐';

    console.log(horizontalBorder);
		for (let i = 0; i < lines.length - 2; i++) {
			const line = lines[i];
			const paddedLine = line.padEnd(contentWidth, ' ');
			console.log(`│ ${paddedLine} │`);
		}
		console.log('└' + '─'.repeat(width + 2) + '┘');

	} catch (error) {
		console.error('Error converting image to ASCII:', error);
	}
}

export default function Feed({ args }: Props) {
	React.useEffect(() => {
		const fetchFeed = async () => {
			try {
				const config = ConfigManager.getInstance();
				await config.initialize();

				// Determine which username to use
				let targetUsername = args[0];
				if (!targetUsername) {
					targetUsername =
						config.get<string>('login.currentUsername') ||
						config.get<string>('login.defaultUsername');
				}

				const client = new InstagramClient(targetUsername);
				await client.loginBySession();
				const ig = client.getInstagramClient();

				// Print the feed
				const timelineFeed = ig.feed.timeline();
				const items = await timelineFeed.items();

				for (const item of items) {
					console.log(`Username: ${item.user.username}`);
					console.log(`Caption: ${item.caption?.text || 'No caption'}`);

					const url = item.image_versions2?.candidates?.[0]?.url;
					if( url) {
						console.log(`Image URL: ${url}`);
						await convertImageToColorAscii(url);
					}
					//Print likes and comments (numbebr only)
					console.log(`♥: ${item.like_count}`);
					console.log(`🗨: ${item.comment_count}`);
					console.log('-----------------------------------');
				}
			} catch (err) {
				console.error('Error fetching feed:', err);
			}
		};

		fetchFeed();
	}, [args]);

	return null; // or <></> if used in a CLI React renderer like Ink
}
