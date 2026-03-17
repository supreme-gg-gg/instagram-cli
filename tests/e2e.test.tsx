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

test('version command renders loading state initially', (t: ExecutionContext) => {
	const {lastFrame} = render(<Version />);
	t.not(lastFrame(), undefined);
});

test('version command renders all version info after loading', async (t: ExecutionContext) => {
	const {lastFrame} = render(<Version />);

	await delay(500);

	const output = lastFrame();
	t.truthy(output, 'Frame should render version info');

	// Verify CLI version is shown as a valid semver (e.g. "instagram-cli: v1.4.5")
	t.regex(
		output ?? '',
		/instagram-cli: v\d+\.\d+\.\d+/,
		'Should display instagram-cli with a valid version number',
	);

	// Verify instagram-private-api version is shown with semver and "(patched)" label
	t.regex(
		output ?? '',
		/instagram-private-api: v\d+\.\d+\.\d+ \(patched\)/,
		'Should display instagram-private-api with a valid version number and (patched) label',
	);

	// Verify Instagram app version is shown as a valid dotted version string
	t.regex(
		output ?? '',
		/Instagram app version: \d+\.\d+\.\d+/,
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
