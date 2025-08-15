import React, {useState, useEffect} from 'react';
import {FeedItem} from '../../types/instagram.js';
import {convertImageToColorAscii} from '../../utils/ascii-display.js';
// import TimelineMediaView from './TimelineMediaView.js';
import ListMediaView from './ListMediaView.js';

type Props = {
	feedItems: FeedItem[];
	width?: number;
};

export default function MediaView({feedItems}: Props) {
	const [asciiImages, setAsciiImages] = useState<string[]>([]);

	useEffect(() => {
		const renderAscii = async () => {
			try {
				const images: string[] = [];

				for (const item of feedItems) {
					const url = item.image_versions2?.candidates?.[0]?.url;
					if (url) {
						const ascii = await convertImageToColorAscii(url);
						images.push(ascii);
					} else {
						images.push('No image');
					}
				}
				setAsciiImages(images);
			} catch (err) {
				console.error('Error converting images to ASCII:', err);
			}
		};

		renderAscii();
	}, [feedItems]);

	return (
		<ListMediaView feedItems={feedItems} asciiImages={asciiImages} />
	);
}
