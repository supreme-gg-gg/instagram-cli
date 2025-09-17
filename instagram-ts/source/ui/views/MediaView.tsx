import React, {useState, useEffect} from 'react';
import {FeedInstance} from '../../types/instagram.js';
import TimelineMediaDisplay from '../components/TimelineMediaDisplay.js';
import ListMediaDisplay from '../components/ListMediaDisplay.js';
import {ConfigManager} from '../../config.js';
import {TerminalInfoProvider} from 'ink-picture';

export default function MediaView({feed}: {feed: FeedInstance}) {
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
