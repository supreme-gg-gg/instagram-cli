import React, {useState, useEffect} from 'react';
import {FeedInstance} from '../../types/instagram.js';
import {convertImageToColorAscii} from '../../utils/ascii-display.js';
import TimelineMediDisplay from '../components/TimelineMediaDisplay.js';
import ListMediaDisplay from '../components/ListMediaDisplay.js';
import {ConfigManager} from '../../config.js';

export default function MediaView({feed}: {feed: FeedInstance}) {
	const [feedType, setFeedType] = useState<'timeline' | 'list'>('list');

	useEffect(() => {
		const config = ConfigManager.getInstance();
		const savedFeedType = config.get<string>('feed.feedType') || 'list';
		setFeedType(savedFeedType as 'timeline' | 'list');

		const renderAscii = async () => {
			try {
				for (const post of feed.posts) {
					const url = post.image_versions2?.candidates?.[0]?.url;
					if (url) {
						const ascii = await convertImageToColorAscii(url);
						post.ascii_image = ascii;
					} else {
						post.ascii_image = 'No image';
					}
				}
			} catch (err) {
				console.error('Error converting images to ASCII:', err);
			}
		};

		renderAscii();
	}, [feed]);

	return feedType === 'timeline' ? (
		<TimelineMediDisplay posts={feed.posts} />
	) : (
		<ListMediaDisplay posts={feed.posts} />
	);
}
