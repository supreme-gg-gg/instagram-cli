import type {ThreadItemSummary} from '../types/instagram.js';

// `collections/create/` silently ignores `added_media_ids` past ~30 items, so the
// first batch is created with the collection and the rest is added via `edit/`.
export const createBatchSize = 30;
export const editBatchSize = 50;

export function splitMediaBatches(mediaIds: string[]): {
	initial: string[];
	rest: string[][];
} {
	const initial = mediaIds.slice(0, createBatchSize);
	const rest: string[][] = [];
	for (let i = createBatchSize; i < mediaIds.length; i += editBatchSize) {
		rest.push(mediaIds.slice(i, i + editBatchSize));
	}

	return {initial, rest};
}

// Adding media to a collaborative collection also posts each media into the
// linked thread. These are the items to unsend to keep the conversation clean.
const sharedMediaTypes = new Set([
	'xma_media_share',
	'media_share',
	'xma_clip',
	'clip',
]);

export function pickAutoPostedShares(
	items: ThreadItemSummary[],
	viewerId: string,
	sinceMs: number,
): string[] {
	return items
		.filter(
			item =>
				String(item.user_id) === viewerId &&
				sharedMediaTypes.has(item.item_type) &&
				Number(item.timestamp) / 1000 >= sinceMs,
		)
		.map(item => item.item_id);
}
