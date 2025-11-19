import React, {useState, useEffect} from 'react';
import {TerminalInfoProvider, type ImageProtocolName} from 'ink-picture';
import {type StoryReel} from '../../types/instagram.js';
import StoryDisplay from '../components/story-display.js';
import {ConfigManager} from '../../config.js';
import {type InstagramClient} from '../../client.js';

export default function StoryView({
	reels,
	loadMore,
	client,
}: {
	readonly reels: StoryReel[];
	readonly loadMore: (index: number) => void;
	readonly client: InstagramClient | undefined;
}) {
	const [imageProtocol, setImageProtocol] = useState<string | undefined>(
		undefined,
	);

	useEffect(() => {
		const config = ConfigManager.getInstance();
		const protocol = config.get('image.protocol');
		setImageProtocol(protocol);
	}, []);

	return (
		<TerminalInfoProvider>
			<StoryDisplay
				reels={reels}
				loadMore={loadMore}
				protocol={imageProtocol as ImageProtocolName}
				client={client}
			/>
		</TerminalInfoProvider>
	);
}
