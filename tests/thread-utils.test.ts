/* eslint-disable @typescript-eslint/no-unsafe-call */

import test from 'ava';
import {updateThreadByMessage} from '../source/utils/thread-utils.js';
import {mockThreads, generateMessage} from '../source/mocks/mock-data.js';
import type {Thread, Message} from '../source/types/instagram.js';

test('updateThreadByMessage moves updated thread to top', t => {
	const threads: Thread[] = [...mockThreads];
	// Select a thread that is NOT the first one
	const targetThreadId = threads[1]!.id;
	const newMessage = generateMessage(
		'new_msg_1',
		targetThreadId,
		'user3',
		'charlie_brown',
		'New test message',
	);

	const updatedThreads = updateThreadByMessage(threads, newMessage);

	t.is(
		updatedThreads[0]!.id,
		targetThreadId,
		'Updated thread should be moved to the first position',
	);
	t.is(
		updatedThreads[0]!.lastMessage!.id,
		newMessage.id,
		'lastMessage should be updated',
	);
	t.is(
		updatedThreads[0]!.lastActivity,
		newMessage.timestamp,
		'lastActivity should be updated to message timestamp',
	);
});

test('updateThreadByMessage returns original array if thread not found', t => {
	const threads: Thread[] = [...mockThreads];
	const newMessage = generateMessage(
		'new_msg_2',
		'non_existent_thread_id',
		'user1',
		'alice',
		'Hello',
	);

	const updatedThreads = updateThreadByMessage(threads, newMessage);

	t.is(
		updatedThreads,
		threads,
		'Should return the exact same array reference if no update occurs',
	);
});

test('updateThreadByMessage respects markAsUnread option', t => {
	const threads: Thread[] = [...mockThreads];
	// Use a thread that is currently marked as read (unread: false)
	const readThread = threads.find(th => !th.unread);
	t.truthy(readThread, 'Need a read thread for this test');

	const newMessage = generateMessage(
		'new_msg_3',
		readThread!.id,
		'user3',
		'charlie_brown',
		'New test message',
	);

	const updatedThreadsUnread = updateThreadByMessage(threads, newMessage, {
		markAsUnread: true,
	});
	t.true(
		updatedThreadsUnread[0]!.unread,
		'Thread should be marked as unread when option is true',
	);

	const updatedThreadsPreserved = updateThreadByMessage(threads, newMessage, {
		markAsUnread: false,
	});
	t.false(
		updatedThreadsPreserved[0]!.unread,
		'Thread unread state should be preserved (false) when option is false',
	);
});
