import React from 'react';
import {InkPictureProvider} from 'ink-picture';
import {type ListMediaItem, type Story} from '../../types/instagram.js';
import ListDetailDisplay from '../components/list-detail-display.js';
import {type InstagramClient} from '../../client.js';
import {useImageProtocol} from '../hooks/use-image-protocol.js';

export default function StoryView({
	reels,
	seenUserPks,
	latestReelMediaByUser,
	reelSeenByUser,
	markAsSeen,
	loadMore,
	client,
}: {
	readonly reels: Array<ListMediaItem<Story>>;
	readonly seenUserPks?: ReadonlySet<string>;
	readonly latestReelMediaByUser?: ReadonlyMap<string, number>;
	readonly reelSeenByUser?: ReadonlyMap<string, number>;
	readonly markAsSeen: boolean;
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
				fullName: stories[0].user.full_name,
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
				seenUserPks={seenUserPks}
				latestReelMediaByUser={latestReelMediaByUser}
				reelSeenByUser={reelSeenByUser}
				markAsSeen={markAsSeen}
				handleSearchSubmit={handleSearchSubmit}
			/>
		</InkPictureProvider>
	);
}
