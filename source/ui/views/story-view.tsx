import React from 'react';
import {TerminalInfoProvider} from 'ink-picture';
import {type StoryReel} from '../../types/instagram.js';
import StoryDisplay from '../components/story-display.js';
import {type InstagramClient} from '../../client.js';
import {useImageProtocol} from '../hooks/use-image-protocol.js';

export default function StoryView({
	reels,
	loadMore,
	client,
}: {
	readonly reels: StoryReel[];
	readonly loadMore: (index: number) => void;
	readonly client: InstagramClient | undefined;
}) {
	const imageProtocol = useImageProtocol();

	return (
		<TerminalInfoProvider>
			<StoryDisplay
				reels={reels}
				loadMore={loadMore}
				protocol={imageProtocol}
				client={client}
			/>
		</TerminalInfoProvider>
	);
}
