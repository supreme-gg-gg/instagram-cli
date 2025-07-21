import React from 'react';
import {useState, useEffect} from 'react';
import {Box, Text} from 'ink';
import {FeedItem} from '../../types/instagram.js';
import {convertImageToColorAscii} from '../../utils/ascii-display.js';

type Props = {
	feedItems: FeedItem[];
	width?: number;
};

export default function MediaView({feedItems, width = 40}: Props) {
	const [asciiImages, setAsciiImages] = useState<string[]>([]);

	useEffect(() => {
		const renderAscii = async () => {
			try {
				const images: string[] = [];

				for (const item of feedItems) {
					const url = item.image_versions2?.candidates?.[0]?.url;
					if (url) {
						const ascii = await convertImageToColorAscii(url, width);
						console.log(ascii);
						images.push(ascii);
					} else {
						images.push('No image');
					}
				}
				setAsciiImages(images);
			} catch (err) {
				console.error('Error converting images to ASCII:', err);
			} finally {
			}
		};

		renderAscii();
	}, [feedItems, width]);

	return (
		<Box flexDirection="column" gap={1}>
			<Text color="blue">Your Feed</Text>
			{feedItems.map((item, index) => (
				<Box
					key={item.id}
					flexDirection="column"
					borderStyle="round"
					padding={1}
				>
					<Text color="green">👤 {item.user?.username || 'Unknown user'}</Text>
					<Text>{'\n'}</Text>
					<Text>{item.caption?.text || 'No caption'}</Text>
					<Text>{'\n'}</Text>

					<Box flexDirection="column">
						{/* TODO: Handling properly posts with multiple images */}
						{asciiImages[index] ? (
							asciiImages[index]
								.split('\n')
								.map((line, i) => <Text key={i}>{line}</Text>)
						) : (
							<Text color="yellow">⏳ Loading media...</Text>
						)}
					</Box>
					<Box flexDirection="row">
						<Text>♥ {item.like_count ?? 0} - </Text>
						<Text>🗨 {item.comment_count ?? 0}</Text>
					</Box>
				</Box>
			))}
		</Box>
	);
}
