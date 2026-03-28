/* eslint-disable @typescript-eslint/no-unsafe-call */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'ava';
import {
	chatCommands,
	type ChatCommandContext,
} from '../source/utils/chat-commands.js';
import {mockClient} from '../source/mocks/mock-client.js';
import type {ChatState} from '../source/types/instagram.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

let tempDir: string;
let imgPath: string;
let vidPath: string;
let pdfPath: string;

test.before(() => {
	tempDir = fs.mkdtempSync(path.join(os.homedir(), '.instagram-cli-test-'));
	imgPath = path.join(tempDir, 'photo.jpg');
	vidPath = path.join(tempDir, 'clip.mp4');
	pdfPath = path.join(tempDir, 'document.pdf');

	fs.writeFileSync(imgPath, 'fake-image');
	fs.writeFileSync(vidPath, 'fake-video');
	fs.writeFileSync(pdfPath, 'fake-pdf');
});

test.after.always(() => {
	fs.rmSync(tempDir, {recursive: true, force: true});
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockThread = {
	id: 'thread_1',
	title: 'Test Thread',
	users: [],
	lastActivity: new Date(),
	unread: false,
};

function makeContext(overrides?: Partial<ChatState>): ChatCommandContext {
	return {
		client: mockClient,
		chatState: {
			messages: [],
			currentThread: mockThread,
			isSelectionMode: false,
			selectedMessageIndex: undefined,
			...overrides,
		},
		setChatState() {},
		height: 24,
		scrollViewRef: {current: undefined},
	};
}

// ── :upload command ───────────────────────────────────────────────────────────

const uploadHandler = chatCommands['upload']!.handler;

test(':upload with plain path (no spaces) uploads image', async t => {
	const result = await uploadHandler([imgPath], makeContext());
	t.is(result, `Image uploaded: ${imgPath}`);
});

test(':upload with spaced path uploads image', async t => {
	const spacedDir = path.join(tempDir, 'sub dir');
	fs.mkdirSync(spacedDir, {recursive: true});
	const spacedImg = path.join(spacedDir, 'pic.jpg');
	fs.writeFileSync(spacedImg, 'fake');
	// The command parser splits on whitespace, so arguments_ has multiple parts
	const parts = spacedImg.split(' ');
	const result = await uploadHandler(parts, makeContext());
	t.is(result, `Image uploaded: ${spacedImg}`);
});

test(':upload with double-quoted path strips quotes and uploads', async t => {
	const result = await uploadHandler([`"${imgPath}"`], makeContext());
	t.is(result, `Image uploaded: ${imgPath}`);
});

test(':upload with single-quoted path strips quotes and uploads', async t => {
	const result = await uploadHandler([`'${imgPath}'`], makeContext());
	t.is(result, `Image uploaded: ${imgPath}`);
});

test(':upload with #-prefixed path strips hash and uploads', async t => {
	const result = await uploadHandler([`#${imgPath}`], makeContext());
	t.is(result, `Image uploaded: ${imgPath}`);
});

test(':upload with video extension uploads video', async t => {
	const result = await uploadHandler([vidPath], makeContext());
	t.is(result, `Video uploaded: ${vidPath}`);
});

test(':upload with unsupported extension returns error', async t => {
	const result = await uploadHandler([pdfPath], makeContext());
	t.is(result, 'Unsupported file type. Please upload an image or video.');
});

test(':upload with no arguments returns usage hint', async t => {
	const result = await uploadHandler([], makeContext());
	t.is(result, 'Usage: :upload <path-to-file>');
});

test(':upload without active thread returns undefined', async t => {
	const result = await uploadHandler(
		[imgPath],
		makeContext({currentThread: undefined}),
	);
	t.is(result, undefined);
});

// ── Security: :upload blocks dangerous paths ────────────────────────────────

test(':upload blocks paths outside home directory', async t => {
	const result = await uploadHandler(['/etc/passwd'], makeContext());
	t.truthy(typeof result === 'string' && result.startsWith('Upload blocked'));
});

test(':upload blocks sensitive paths', async t => {
	const sshKey = path.join(os.homedir(), '.ssh/id_rsa');
	const result = await uploadHandler([sshKey], makeContext());
	t.truthy(typeof result === 'string' && result.startsWith('Upload blocked'));
});
