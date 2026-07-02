/* eslint-disable @typescript-eslint/no-unsafe-call */

import React from 'react';
import test from 'ava';
import chalk from 'chalk';
import {render} from 'ink-testing-library';
import ThreadItem from '../source/ui/components/thread-item.js';
import MessageList from '../source/ui/components/message-list.js';
import {mockThreads, mockMessages} from '../source/mocks/mock-data.js';

// Force chalk to emit ANSI color codes so the cursor highlight is visible in
// the captured frame output. This must be set before any rendering occurs.
chalk.level = 3;

test('ThreadItem renders thread title and unread indicator', t => {
	const unreadThread = mockThreads.find(th => th.unread)!;

	const {lastFrame, unmount} = render(
		<ThreadItem thread={unreadThread} isSelected={false} isHovered={false} />,
	);
	const output = lastFrame();

	t.truthy(output?.includes(unreadThread.title), 'Should display thread title');
	t.truthy(output?.includes('●'), 'Should display unread indicator');
	unmount();
});

test("Read ThreadItem doesn't display unread indicator", t => {
	const readThread = mockThreads.find(th => !th.unread)!;

	const {lastFrame, unmount} = render(
		<ThreadItem isSelected thread={readThread} isHovered={false} />,
	);
	const output = lastFrame();

	// Unread indicator shouldn't be present
	t.falsy(
		output?.includes('●'),
		'Should not display unread indicator for read thread',
	);
	unmount();
});

test('ThreadItem renders selected state', t => {
	const thread = mockThreads[0]!;

	const {lastFrame, unmount} = render(
		<ThreadItem isSelected thread={thread} isHovered={false} />,
	);
	const output = lastFrame();
	// Selected threads are highlighted with gray background
	t.truthy(output?.includes('\u001B[48;2;58;58;58m'));
	unmount();
});

test('MessageList renders messages', t => {
	const messages = mockMessages
		.filter(msg => msg.itemType === 'text')
		.slice(0, 3);

	const {lastFrame, unmount} = render(<MessageList messages={messages} />);

	const output = lastFrame();

	// Check if text messages are rendered
	t.truthy(
		output?.includes(messages[0].text),
		'Should render first message text',
	);
	t.truthy(
		output?.includes(messages[1].text),
		'Should render second message text',
	);
	unmount();
});
