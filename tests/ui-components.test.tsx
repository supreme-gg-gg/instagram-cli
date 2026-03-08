/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import React from 'react';
import test from 'ava';
import {render} from 'ink-testing-library';
import ThreadItem from '../source/ui/components/thread-item.js';
import MessageList from '../source/ui/components/message-list.js';
import {mockThreads, mockMessages} from '../source/mocks/mock-data.js';
import type {TextMessage} from '../source/types/instagram.js';

test('ThreadItem renders thread title and unread indicator', t => {
	const unreadThread = mockThreads.find(th => th.unread)!;

	const {lastFrame} = render(
		<ThreadItem thread={unreadThread} isSelected={false} />,
	);
	const output = lastFrame();

	t.truthy(output?.includes(unreadThread.title), 'Should display thread title');
	t.truthy(output?.includes('●'), 'Should display unread indicator');
});

test('ThreadItem renders selected state', t => {
	const readThread = mockThreads.find(th => !th.unread)!;

	const {lastFrame} = render(<ThreadItem isSelected thread={readThread} />);
	const output = lastFrame();

	// Unread indicator shouldn't be present
	t.falsy(
		output?.includes('●'),
		'Should not display unread indicator for read thread',
	);
});

test('MessageList renders messages', t => {
	const messages = mockMessages.slice(0, 3);

	const {lastFrame} = render(<MessageList messages={messages} />);

	const output = lastFrame();

	// Check if text messages are rendered
	t.truthy(
		output?.includes((messages[0] as TextMessage)?.text),
		'Should render first message text',
	);
	t.truthy(
		output?.includes((messages[1] as TextMessage)?.text),
		'Should render second message text',
	);
});
