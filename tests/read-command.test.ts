/* eslint-disable @typescript-eslint/no-unsafe-call */

import test from 'ava';
import {collectReadMessages} from '../source/utils/read-messages.js';
import type {Message, TextMessage} from '../source/types/instagram.js';

const message = (id: string): TextMessage => ({
	id,
	itemType: 'text',
	text: `message ${id}`,
	userId: 'user_1',
	username: 'User',
	timestamp: new Date(`2026-01-01T00:00:${id.padStart(2, '0')}.000Z`),
	isOutgoing: false,
	threadId: 'thread_1',
});

test('collectReadMessages returns the latest messages from an oversized page', async t => {
	const client = {
		async getMessages() {
			return {
				messages: ['1', '2', '3', '4', '5', '6', '7'].map(id => message(id)),
				cursor: '1',
			};
		},
	};

	const result = await collectReadMessages(client, 'thread_1', 3);

	t.deepEqual(
		result.messages.map(m => m.id),
		['5', '6', '7'],
	);
	t.is(result.cursor, '5');
});

test('collectReadMessages fetches older pages until the limit is filled', async t => {
	const pages = new Map<
		string | undefined,
		{messages: Message[]; cursor?: string}
	>([
		[
			undefined,
			{
				messages: ['8', '9', '10'].map(id => message(id)),
				cursor: '8',
			},
		],
		[
			'8',
			{
				messages: ['5', '6', '7'].map(id => message(id)),
				cursor: '5',
			},
		],
	]);
	const seenCursors: Array<string | undefined> = [];
	const client = {
		async getMessages(_threadId: string, cursor?: string) {
			seenCursors.push(cursor);
			return pages.get(cursor)!;
		},
	};

	const result = await collectReadMessages(client, 'thread_1', 5);

	t.deepEqual(seenCursors, [undefined, '8']);
	t.deepEqual(
		result.messages.map(m => m.id),
		['6', '7', '8', '9', '10'],
	);
	t.is(result.cursor, '6');
});
