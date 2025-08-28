import React, {useState, useEffect} from 'react';
import {FeedInstance} from '../../types/instagram.js';
import {convertImageToColorAscii} from '../../utils/ascii-display.js';
import TimelineMediDisplay from '../components/TimelineMediaDisplay.js';
import ListMediaDisplay from '../components/ListMediaDisplay.js';
import {ConfigManager} from '../../config.js';

export default function MediaView({feed}: {feed: FeedInstance}) {
	const [feedType, setFeedType] = useState<'timeline' | 'list'>('list');
	const [asciiFeed, setAsciiFeed] = useState<string[][]>(
		Array.from({length: feed.posts.length}, () => []),
	);

	useEffect(() => {
		const config = ConfigManager.getInstance();
		const savedFeedType = config.get<string>('feed.feedType') || 'list';
		setFeedType(savedFeedType as 'timeline' | 'list');

		const renderAscii = async () => {
			try {
				for (let i = 0; i < feed.posts.length; i++) {
					const post = feed.posts[i];
					if (post?.carousel_media) {
						for (let j = 0; j < post.carousel_media.length; j++) {
							const carouselItem = post.carousel_media[j];
							const imageURL =
								carouselItem?.image_versions2?.candidates?.[0]?.url;
							if (imageURL) {
								const ascii = await convertImageToColorAscii(imageURL);
								setAsciiFeed(prev => {
									const newFeed = [...prev];
									const postArray: string[] = newFeed[i] ?? [];
									postArray.push(ascii);
									newFeed[i] = postArray;
									return newFeed;
								});
							}
						}
					} else {
						const imageURL = post?.image_versions2?.candidates[0]?.url;
						if (!imageURL) continue;
						const ascii = await convertImageToColorAscii(imageURL);
						setAsciiFeed(prev => {
							const newFeed = [...prev];
							const postArray: string[] = newFeed[i] ?? [];
							postArray.push(ascii);
							newFeed[i] = postArray;
							return newFeed;
						});
					}
				}
			} catch (err) {
				console.error('Error converting images to ASCII:', err);
			}
		};

		renderAscii();
	}, [feed]);

	return feedType === 'timeline' ? (
		<TimelineMediDisplay feed={feed} asciiFeed={asciiFeed} />
	) : (
		<ListMediaDisplay feed={feed} asciiFeed={asciiFeed} />
	);
}
