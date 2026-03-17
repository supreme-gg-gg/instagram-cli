/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import React from 'react';
import test, {type ExecutionContext} from 'ava';
import {render} from 'ink-testing-library';
import Index from '../source/commands/index.js';
import Version from '../source/commands/version.js';
import {AppMock} from '../source/mocks/app.mock.js';
import {mockThreads, mockMessages} from '../source/mocks/mock-data.js';

const delay = async (ms: number): Promise<void> => {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
};

test('sanity check', (t: ExecutionContext) => {
	const {lastFrame} = render(<Index />);

	t.not(lastFrame(), undefined);
});

test('unknown command shows helpful error', (t: ExecutionContext) => {
	const {lastFrame} = render(<Index args={['asdfljk']} />);
	const output = lastFrame()!;
	t.true(output.includes('Unknown command'));
	t.true(output.includes('asdfljk'));
	t.true(output.includes('--help'));
});

test('version command renders all version info', async (t: ExecutionContext) => {
	const {lastFrame} = render(<Version />);

	await delay(100);

	const output = lastFrame();
	t.truthy(output, 'Frame should render version info');
	t.true(
		output!.includes('instagram-cli'),
		'Should display instagram-cli version',
	);
	t.true(
		output!.includes('instagram-private-api'),
		'Should display instagram-private-api version',
	);
	t.true(
		output!.includes('(patched)'),
		'Should display patched label for instagram-private-api',
	);
	t.true(
		output!.includes('Instagram app version'),
		'Should display Instagram app version',
	);
});

test('renders chat view', (t: ExecutionContext) => {
	const {lastFrame} = render(<AppMock view="chat" />);

	t.not(lastFrame(), undefined);
});

test('renders feed view', (t: ExecutionContext) => {
	const {lastFrame} = render(<AppMock view="feed" />);

	t.not(lastFrame(), undefined);
});

test('renders stories view', (t: ExecutionContext) => {
	const {lastFrame} = render(<AppMock view="story" />);

	t.not(lastFrame(), undefined);
});

test('chat view displays messages when thread is selected', async (t: ExecutionContext) => {
	const {lastFrame, stdin} = render(<AppMock view="chat" />);

	await delay(1100);

	// Verify threads are displayed
	let output = lastFrame();
	t.truthy(output, 'Frame should render threads');
	t.true(
		output!.includes(mockThreads[0]!.title),
		'Thread should be visible before selection',
	);

	// Select first thread by pressing Enter
	stdin.write('\r');

	await delay(500);

	output = lastFrame();
	t.truthy(output, 'Frame should render after thread selection');
	const firstMessage = mockMessages[0]!;
	const messageText = firstMessage.itemType === 'text' ? firstMessage.text : '';
	t.true(output!.includes(messageText), 'First message should be visible');
});
