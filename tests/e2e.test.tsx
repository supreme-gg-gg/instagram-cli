/* eslint-disable @typescript-eslint/no-unsafe-call */

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

test('version command renders all version info', async (t: ExecutionContext) => {
	const {lastFrame} = render(<Version />);
	await delay(100);
	const output = lastFrame();
	t.regex(
		output ?? '',
		/instagram-cli: v\d+\.\d+\.\d+/,
		'Should display instagram-cli with a valid version number',
	);
	t.regex(
		output ?? '',
		/instagram-private-api: v\d+\.\d+\.\d+ \(patched\)/,
		'Should display instagram-private-api with a valid version number and (patched) label',
	);
	t.regex(
		output ?? '',
		// eslint-disable-next-line unicorn/better-regex
		/Instagram app version: \d+\.\d+\.\d+\.\d+\.\d+/,
		'Should display Instagram app version as a valid version number',
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
