import React, {useState, useEffect} from 'react';
import {FeedItem} from '../../types/instagram.js';
import TimelineMediaDisplay from '../components/TimelineMediaDisplay.js';
import ListMediaDisplay from '../components/ListMediaDisplay.js';
import {ConfigManager} from '../../config.js';
import {TerminalInfoProvider} from '../context/TerminalInfo.js';

type Props = {
	feedItems: FeedItem[];
	width?: number;
};

export default function MediaView({feedItems}: Props) {
	const [imageUrls, setImageUrls] = useState<string[]>([]);
	const [feedType, setFeedType] = useState<'timeline' | 'list'>('list');
	const [imageProtocol, setImageProtocol] = useState<string | undefined>(
		undefined,
	);

	useEffect(() => {
		const config = ConfigManager.getInstance();
		const savedFeedType = config.get<string>('feed.feedType') || 'list';
		setFeedType(savedFeedType as 'timeline' | 'list');
		const protocol = config.get<string>('image.protocol');
		setImageProtocol(protocol);

		const getUrls = () => {
			const images: string[] = [];
			for (const item of feedItems) {
				const url = item.image_versions2?.candidates?.[0]?.url;
				if (url) {
					images.push(url);
				} else {
					images.push('No image');
				}
			}
			setImageUrls(images);
		};

		getUrls();
	}, [feedItems]);

	return feedType === 'timeline' ? (
		<TerminalInfoProvider>
			<TimelineMediaDisplay
				feedItems={feedItems}
				imageUrls={imageUrls}
				protocol={imageProtocol}
			/>
		</TerminalInfoProvider>
	) : (
		<TerminalInfoProvider>
			<ListMediaDisplay
				feedItems={feedItems}
				imageUrls={imageUrls}
				protocol={imageProtocol}
			/>
		</TerminalInfoProvider>
	);
}
