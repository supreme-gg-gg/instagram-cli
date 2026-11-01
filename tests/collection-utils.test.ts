/* eslint-disable @typescript-eslint/no-unsafe-call */

import test from 'ava';
import {
	splitMediaBatches,
	pickAutoPostedShares,
} from '../source/utils/collection.js';

const ids = (n: number) => Array.from({length: n}, (_, i) => `m${i}`);

test('splitMediaBatches puts up to 30 ids in the create call', t => {
	const {initial, rest} = splitMediaBatches(ids(12));
	t.is(initial.length, 12);
	t.deepEqual(rest, []);
});

test('splitMediaBatches adds the remainder in batches of 50', t => {
	const {initial, rest} = splitMediaBatches(ids(107));
	t.is(initial.length, 30);
	t.deepEqual(
		rest.map(batch => batch.length),
		[50, 27],
	);
	t.is(rest[0]?.[0], 'm30');
});

test('pickAutoPostedShares keeps only my media shares posted since the start', t => {
	const since = 1_700_000_000_000;
	const us = (ms: number) => String(ms * 1000);
	const items = [
		{
			item_id: 'a',
			item_type: 'xma_media_share',
			user_id: 1,
			timestamp: us(since + 5),
		},
		{
			item_id: 'b',
			item_type: 'xma_media_share',
			user_id: 2,
			timestamp: us(since + 5),
		},
		{item_id: 'c', item_type: 'text', user_id: 1, timestamp: us(since + 5)},
		{
			item_id: 'd',
			item_type: 'action_log',
			user_id: 1,
			timestamp: us(since + 5),
		},
		{
			item_id: 'e',
			item_type: 'xma_clip',
			user_id: '1',
			timestamp: us(since - 5),
		},
		{
			item_id: 'f',
			item_type: 'media_share',
			user_id: '1',
			timestamp: us(since),
		},
	];
	t.deepEqual(pickAutoPostedShares(items, '1', since), ['a', 'f']);
});
