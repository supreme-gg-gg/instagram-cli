/* eslint-disable @typescript-eslint/no-unsafe-call */

import test from 'ava';
import {
	collectReadMessages,
	type MessagePage,
} from '../source/utils/thread-utils.js';
import {generateMessage} from '../source/mocks/mock-data.js';

// Fake thread with messages 0 (newest) to `total - 1` (oldest), served in
// pages of `pageSize` the way client.getMessages does: each page is returned
// oldest first, and the cursor is the id of the oldest item in the page.
function fakeThread(total: number, pageSize: number) {
	const calls: Array<string | undefined> = [];
	const fetchPage = async (cursor?: string): Promise<MessagePage> => {
		calls.push(cursor);
		const start = cursor === undefined ? 0 : Number(cursor) + 1;
		const end = Math.min(start + pageSize, total);
		const messages = [];
		for (let i = end - 1; i >= start; i--) {
			messages.push(generateMessage(String(i), 't1', 'u1', 'alice', `m${i}`));
		}

		return {
			messages,
			cursor: end < total ? String(end - 1) : undefined,
		};
	};

	return {fetchPage, calls};
}

const ids = (page: MessagePage) => page.messages.map(m => m.id);

test('limit smaller than a page returns a cursor that skips nothing', async t => {
	const {fetchPage} = fakeThread(30, 11);

	const first = await collectReadMessages(fetchPage, 5);
	t.deepEqual(ids(first), ['4', '3', '2', '1', '0']);

	const second = await collectReadMessages(fetchPage, 5, first.cursor);
	t.deepEqual(ids(second), ['9', '8', '7', '6', '5']);
});

test('limit larger than a page fetches older pages', async t => {
	const {fetchPage, calls} = fakeThread(30, 10);

	const result = await collectReadMessages(fetchPage, 25);
	t.is(result.messages.length, 25);
	t.is(result.messages.at(-1)!.id, '0');
	t.is(result.messages[0]!.id, '24');
	t.is(calls.length, 3);

	const rest = await collectReadMessages(fetchPage, 25, result.cursor);
	t.deepEqual(ids(rest), ['29', '28', '27', '26', '25']);
	t.is(rest.cursor, undefined);
});

test('limit 0 or below returns no messages', async t => {
	const {fetchPage, calls} = fakeThread(30, 10);

	t.deepEqual(ids(await collectReadMessages(fetchPage, 0)), []);
	t.deepEqual(ids(await collectReadMessages(fetchPage, -3)), []);
	t.is(calls.length, 0);
});

test('stops when the thread runs out', async t => {
	const {fetchPage} = fakeThread(7, 5);

	const result = await collectReadMessages(fetchPage, 20);
	t.is(result.messages.length, 7);
	t.is(result.cursor, undefined);
});
