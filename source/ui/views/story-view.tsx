import React from 'react';
import {InkPictureProvider} from 'ink-picture';
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

	const handleSearchSubmit = async (
		query: string,
	): Promise<ListMediaItem<Story> | undefined> => {
		const stories = await client!.getStoriesForUser(undefined, query);
		if (stories.length > 0 && stories[0]?.user) {
			const result: ListMediaItem<Story> = {
				pk: String(stories[0].user.pk),
				label: stories[0].user.username,
				content: stories,
			};
			return result;
		}

		return undefined;
	};

	return (
		<InkPictureProvider>
			<ListDetailDisplay
				listItems={reels}
				loadMore={loadMore}
				protocol={imageProtocol}
				client={client}
				mode="story"
				handleSearchSubmit={handleSearchSubmit}
			/>
		</InkPictureProvider>
	);
}
