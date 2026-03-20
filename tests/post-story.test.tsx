/* eslint-disable @typescript-eslint/no-unsafe-call */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import test from 'ava';
import {render} from 'ink-testing-library';
import FileBrowser from '../source/ui/components/file-browser.js';
import {
	formatFileSize,
	isSupportedStoryFile,
} from '../source/utils/story-files.js';

const delay = async (ms: number): Promise<void> =>
	new Promise(resolve => {
		setTimeout(resolve, ms);
	});

test('isSupportedStoryFile only accepts supported story media', t => {
	t.true(isSupportedStoryFile('image.jpg'));
	t.true(isSupportedStoryFile('image.JPEG'));
	t.true(isSupportedStoryFile('story.png'));
	t.true(isSupportedStoryFile('clip.mp4'));
	t.false(isSupportedStoryFile('clip.mov'));
	t.false(isSupportedStoryFile('notes.txt'));
});

test('formatFileSize formats bytes and megabytes', t => {
	t.is(formatFileSize(512), '512 B');
	t.is(formatFileSize(1536), '1.5 KB');
	t.is(formatFileSize(2 * 1024 * 1024), '2.0 MB');
});

test('FileBrowser lists supported files and directories only', async t => {
	const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ig-cli-story-'));
	await fs.mkdir(path.join(tempRoot, 'assets'));
	await fs.writeFile(path.join(tempRoot, 'photo.jpg'), 'abc');
	await fs.writeFile(path.join(tempRoot, 'clip.mp4'), 'abcd');
	await fs.writeFile(path.join(tempRoot, 'notes.txt'), 'ignore');

	try {
		const {lastFrame} = render(
			<FileBrowser
				initialPath={tempRoot}
				onSelect={() => {}}
				onExit={() => {}}
			/>,
		);

		await delay(150);

		const output = lastFrame();
		t.truthy(output?.includes('assets/'));
		t.truthy(output?.includes('photo.jpg'));
		t.truthy(output?.includes('clip.mp4'));
		t.falsy(output?.includes('notes.txt'));
	} finally {
		await fs.rm(tempRoot, {recursive: true, force: true});
	}
});
