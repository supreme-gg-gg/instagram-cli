import test from 'ava';
import React from 'react';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {render} from 'ink-testing-library';
import {mockClient} from '../source/mocks/index.js';
import FileBrowser from '../source/ui/components/file-browser.js';

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
