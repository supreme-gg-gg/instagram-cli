/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import React from 'react';
import test from 'ava';
import {render} from 'ink-testing-library';
import {mockClient} from '../source/mocks/index.js';
import FileBrowser from '../source/ui/components/file-browser.js';
import PostStoryView, {
	OptionsScreen,
} from '../source/ui/views/post-story-view.js';

const noop = () => {};

// Temporary empty directory for the "no compatible files" test
let emptyTempDir: string;

test.before(async () => {
	emptyTempDir = await fs.promises.mkdtemp(
		path.join(os.tmpdir(), 'post-story-test-'),
	);
});

test.after(async () => {
	await fs.promises.rm(emptyTempDir, {recursive: true, force: true});
});

// ── Task 1: mockClient.postStory ──────────────────────────────────────────────

test('mockClient has postStory method', t => {
	t.is(typeof mockClient.postStory, 'function');
});

test('mockClient.postStory resolves for image file path', async t => {
	await t.notThrowsAsync(async () => mockClient.postStory('/fake/image.jpg'));
});

test('mockClient.postStory resolves with closeFriends option', async t => {
	await t.notThrowsAsync(async () =>
		mockClient.postStory('/fake/image.jpg', {closeFriends: true}),
	);
});

// ── Task 2: FileBrowser ───────────────────────────────────────────────────────

test('FileBrowser renders the initial directory path', async t => {
	const {lastFrame, unmount} = render(
		<FileBrowser initialPath="/tmp" onSelect={noop} onExit={noop} />,
	);
	// Wait for async readdir
	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});
	t.true(lastFrame()?.includes('/tmp'), `Frame: ${lastFrame()}`);
	unmount();
});

test('FileBrowser shows empty message for directory with no compatible files', async t => {
	const {lastFrame, unmount} = render(
		<FileBrowser initialPath={emptyTempDir} onSelect={noop} onExit={noop} />,
	);
	await new Promise(resolve => {
		setTimeout(resolve, 200);
	});
	const frame = lastFrame() ?? '';
	t.true(
		frame.includes('No compatible files'),
		`Expected 'No compatible files', got: ${frame}`,
	);
	unmount();
});

test('FileBrowser calls onExit when q is pressed', async t => {
	let exited = false;
	const {stdin, unmount} = render(
		<FileBrowser
			initialPath="/tmp"
			onSelect={noop}
			onExit={() => {
				exited = true;
			}}
		/>,
	);
	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});
	stdin.write('q');
	await new Promise(resolve => {
		setTimeout(resolve, 50);
	});
	t.true(exited, 'onExit should have been called');
	unmount();
});

// ── Task 3: PostStoryView ─────────────────────────────────────────────────────

test('PostStoryView initially renders the file browser', async t => {
	const {lastFrame, unmount} = render(<PostStoryView client={mockClient} />);
	await new Promise(resolve => {
		setTimeout(resolve, 200);
	});
	const frame = lastFrame() ?? '';
	t.true(frame.includes(process.cwd()), `Expected cwd in frame, got: ${frame}`);
	unmount();
});

test('PostStoryView renders without crashing', async t => {
	const {lastFrame, unmount} = render(<PostStoryView client={mockClient} />);
	await new Promise(resolve => {
		setTimeout(resolve, 200);
	});
	t.truthy(lastFrame());
	unmount();
});

test('OptionsScreen shows Everyone by default', t => {
	const {lastFrame, unmount} = render(
		<OptionsScreen
			closeFriends={false}
			onToggle={noop}
			onConfirm={noop}
			onBack={noop}
		/>,
	);
	const frame = lastFrame() ?? '';
	t.true(frame.includes('Everyone'), `Expected 'Everyone', got: ${frame}`);
	t.true(
		frame.includes('Close Friends'),
		`Expected 'Close Friends', got: ${frame}`,
	);
	unmount();
});

test('OptionsScreen calls onToggle when Tab is pressed', t => {
	let toggled = false;
	const {stdin, unmount} = render(
		<OptionsScreen
			closeFriends={false}
			onToggle={() => {
				toggled = true;
			}}
			onConfirm={noop}
			onBack={noop}
		/>,
	);
	stdin.write('\t');
	t.true(toggled, 'Tab should trigger onToggle');
	unmount();
});

test('OptionsScreen calls onBack when b is pressed', t => {
	let wentBack = false;
	const {stdin, unmount} = render(
		<OptionsScreen
			closeFriends={false}
			onToggle={noop}
			onConfirm={noop}
			onBack={() => {
				wentBack = true;
			}}
		/>,
	);
	stdin.write('b');
	t.true(wentBack, 'b should trigger onBack');
	unmount();
});

test('OptionsScreen calls onConfirm when Enter is pressed', t => {
	let confirmed = false;
	const {stdin, unmount} = render(
		<OptionsScreen
			closeFriends={false}
			onToggle={noop}
			onConfirm={() => {
				confirmed = true;
			}}
			onBack={noop}
		/>,
	);
	stdin.write('\r');
	t.true(confirmed, 'Enter should trigger onConfirm');
	unmount();
});
