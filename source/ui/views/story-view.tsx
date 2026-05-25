import React from 'react';
import {TerminalInfoProvider} from 'ink-picture';
import {type ListMediaItem, type Story} from '../../types/instagram.js';
import ListDetailDisplay from '../components/list-detail-display.js';
import {type InstagramClient} from '../../client.js';
import {useImageProtocol} from '../hooks/use-image-protocol.js';

export default function StoryView({
	reels,
	loadMore,
	client,
}: {
	readonly reels: Array<ListMediaItem<Story>>;
	readonly loadMore: (index: number) => void;
	readonly client: InstagramClient | undefined;
}) {
	const imageProtocol = useImageProtocol();

	return (
		<TerminalInfoProvider>
			<ListDetailDisplay
				listItems={reels}
				loadMore={loadMore}
				protocol={imageProtocol}
				client={client}
				mode="story"
			/>
		</TerminalInfoProvider>
	);
}
