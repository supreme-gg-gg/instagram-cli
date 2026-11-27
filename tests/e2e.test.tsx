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

// Poll the rendered frame instead of sleeping a fixed time, so slow CI
// runners don't cause intermittent failures. Returns the last frame seen.
const waitForFrame = async (
	lastFrame: () => string | undefined,
	predicate: (frame: string) => boolean,
	timeoutMs = 5000,
): Promise<string> => {
	const deadline = Date.now() + timeoutMs;
	let frame = lastFrame() ?? '';
	while (!predicate(frame) && Date.now() < deadline) {
		// eslint-disable-next-line no-await-in-loop -- polling must be sequential
		await delay(50);
		frame = lastFrame() ?? '';
	}

	return frame;
};

test('sanity check', (t: ExecutionContext) => {
	const {lastFrame, unmount} = render(<Index />);

	t.not(lastFrame(), undefined);
	unmount();
});

test('unknown command shows helpful error', (t: ExecutionContext) => {
	const {lastFrame, unmount} = render(<Index args={['asdfljk']} />);
	const output = lastFrame()!;
	t.true(output.includes('Unknown command'));
	t.true(output.includes('asdfljk'));
	t.true(output.includes('--help'));
	unmount();
});

test('version command renders all version info', async (t: ExecutionContext) => {
	const {lastFrame, unmount} = render(<Version />);

	const output = await waitForFrame(
		() => lastFrame() as string | undefined,
		frame => frame.includes('Instagram app version:'),
	);
	t.regex(
		output,
		/instagram-cli: v\d+\.\d+\.\d+/,
		'Should display instagram-cli with a valid version number',
	);
	t.regex(
		output,
		/instagram-private-api: v\d+\.\d+\.\d+ \(patched\)/,
		'Should display instagram-private-api with a valid version number and (patched) label',
	);
	t.regex(
		output,
		// eslint-disable-next-line unicorn/better-regex
		/Instagram app version: \d+\.\d+\.\d+\.\d+\.\d+/,
		'Should display Instagram app version as a valid version number',
	);
	unmount();
});

test('renders chat view', (t: ExecutionContext) => {
	const {lastFrame, unmount} = render(<AppMock view="chat" />);

	t.not(lastFrame(), undefined);
	unmount();
});

test('renders feed view', (t: ExecutionContext) => {
	const {lastFrame, unmount} = render(<AppMock view="feed" />);

	t.not(lastFrame(), undefined);
	unmount();
});

test('renders saved posts view', async (t: ExecutionContext) => {
	const {lastFrame, unmount} = render(<AppMock view="saved" />);

	const output = await waitForFrame(
		() => lastFrame() as string | undefined,
		frame => frame.includes('Saved posts'),
	);

	t.true(output.includes('Saved posts'));
	unmount();
});

test('renders stories view', (t: ExecutionContext) => {
	const {lastFrame, unmount} = render(<AppMock view="story" />);

	t.not(lastFrame(), undefined);
	unmount();
});

test('chat view displays messages when thread is selected', async (t: ExecutionContext) => {
	const {lastFrame, stdin, unmount} = render(<AppMock view="chat" />);

	// Verify threads are displayed
	let output = await waitForFrame(
		() => lastFrame() as string | undefined,
		frame => frame.includes(mockThreads[0]!.title),
	);
	t.truthy(output, 'Frame should render threads');
	t.true(
		output.includes(mockThreads[0]!.title),
		'Thread should be visible before selection',
	);

	// Select first thread by pressing Enter
	stdin.write('\r');

	const lastMessage = mockMessages.at(-1)!;
	output = await waitForFrame(
		() => lastFrame() as string | undefined,
		frame =>
			lastMessage.itemType === 'text' && frame.includes(lastMessage.text),
	);
	t.truthy(output, 'Frame should render after thread selection');
	if (lastMessage.itemType === 'text') {
		t.true(
			output.includes(lastMessage.text),
			'First message should be visible',
		);
	} else {
		t.fail('Expected last mock message to be text');
	}

	unmount();
});
