import React, {useState, useEffect} from 'react';
import {TerminalInfoProvider} from 'ink-picture';
import {type FeedInstance} from '../../types/instagram.js';
import TimelineMediaDisplay from '../components/timeline-media-display.js';
import ListMediaDisplay from '../components/list-media-display.js';
import {ConfigManager} from '../../config.js';
import {useImageProtocol} from '../hooks/use-image-protocol.js';

export default function MediaView({feed}: {readonly feed: FeedInstance}) {
	const [feedType, setFeedType] = useState<'timeline' | 'list'>('list');
	const imageProtocol = useImageProtocol();

	useEffect(() => {
		const config = ConfigManager.getInstance();
		const savedFeedType = config.get('feed.feedType') || 'list';
		setFeedType(savedFeedType as 'timeline' | 'list');
	}, [feed]);

	return feedType === 'timeline' ? (
		<TerminalInfoProvider>
			<TimelineMediaDisplay feed={feed} protocol={imageProtocol} />
		</TerminalInfoProvider>
	) : (
		<TerminalInfoProvider>
			<ListMediaDisplay feed={feed} protocol={imageProtocol} />
		</TerminalInfoProvider>
	);
}
