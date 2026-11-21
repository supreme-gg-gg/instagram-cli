/* eslint-disable @typescript-eslint/no-unsafe-call */

import {Buffer} from 'node:buffer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'ava';
import type {InstagramClient} from '../source/client.js';
import {normalizeDroppedPath} from '../source/utils/path-utils.js';
import {preprocessMessage} from '../source/utils/preprocess.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

// Smallest valid 1x1 PNG, so file-type detects it as an image.
const pngBytes = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64',
);

let directory = '';

test.before(async () => {
	directory = await fs.mkdtemp(path.join(os.tmpdir(), 'instagram-cli-dnd-'));
	await fs.writeFile(path.join(directory, 'notes.txt'), 'plain');
	await fs.writeFile(path.join(directory, 'drop test.txt'), 'spaced');
	await fs.writeFile(path.join(directory, "it's here.txt"), 'single');
	await fs.writeFile(path.join(directory, 'say "hi".txt'), 'double');
	await fs.writeFile(path.join(directory, 'photo one.png'), pngBytes);
});

test.after.always(async () => {
	await fs.rm(directory, {recursive: true, force: true});
});

function makeClient() {
	const photos: string[] = [];
	const client = {
		async sendPhoto(_threadId: string, filePath: string) {
			photos.push(filePath);
		},
	} as unknown as InstagramClient;
	return {client, photos};
}

// Mirrors how Ghostty / Terminal.app insert a dropped file.
const dropped = (name: string) =>
	`${directory}/${name}`.replaceAll(' ', String.raw`\ `);

// ── normalizeDroppedPath ─────────────────────────────────────────────────────

test('dropped path without spaces becomes #"path"', async t => {
	t.is(
		await normalizeDroppedPath(dropped('notes.txt')),
		`#"${directory}/notes.txt"`,
	);
});

test('dropped path with escaped spaces is decoded', async t => {
	t.is(
		await normalizeDroppedPath(dropped('drop test.txt')),
		`#"${directory}/drop test.txt"`,
	);
});

test('dropped path with a single quote uses #"path"', async t => {
	t.is(
		await normalizeDroppedPath(dropped("it's here.txt")),
		`#"${directory}/it's here.txt"`,
	);
});

test("dropped path with a double quote uses #'path'", async t => {
	t.is(
		await normalizeDroppedPath(dropped('say "hi".txt')),
		`#'${directory}/say "hi".txt'`,
	);
});

test('path inside normal text is left unchanged', async t => {
	const text = `check ${dropped('notes.txt')}`;
	t.is(await normalizeDroppedPath(text), text);
});

test('non-existent path is left unchanged', async t => {
	const text = dropped('missing.txt');
	t.is(await normalizeDroppedPath(text), text);
});

test('directory path is left unchanged', async t => {
	t.is(await normalizeDroppedPath(directory), directory);
});

test('relative path is left unchanged', async t => {
	t.is(await normalizeDroppedPath('notes.txt'), 'notes.txt');
});

test('slash-prefixed text that is not a file is left unchanged', async t => {
	t.is(await normalizeDroppedPath('/shrug'), '/shrug');
});

test('existing #path syntax is left unchanged', async t => {
	const text = `#${directory}/notes.txt`;
	t.is(await normalizeDroppedPath(text), text);
});

// Mirrors how VS Code's terminal inserts a dropped file.
const quoted = (name: string, quote = "'") =>
	`${quote}${directory}/${name}${quote}`;

test('single-quoted dropped path becomes #"path"', async t => {
	t.is(
		await normalizeDroppedPath(quoted('drop test.txt')),
		`#"${directory}/drop test.txt"`,
	);
});

test('double-quoted dropped path becomes #"path"', async t => {
	t.is(
		await normalizeDroppedPath(quoted('drop test.txt', '"')),
		`#"${directory}/drop test.txt"`,
	);
});

test("single-quoted dropped path with a double quote uses #'path'", async t => {
	t.is(
		await normalizeDroppedPath(quoted('say "hi".txt')),
		`#'${directory}/say "hi".txt'`,
	);
});

test('mismatched quotes are left unchanged', async t => {
	const text = `'${directory}/notes.txt"`;
	t.is(await normalizeDroppedPath(text), text);
});

test('quoted text that is not just a path is left unchanged', async t => {
	const text = `'check ${directory}/notes.txt'`;
	t.is(await normalizeDroppedPath(text), text);
});

test('quoted non-existent path is left unchanged', async t => {
	const text = quoted('missing.txt');
	t.is(await normalizeDroppedPath(text), text);
});

test('backslashes inside quotes are taken literally', async t => {
	const text = `'${dropped('drop test.txt')}'`;
	t.is(await normalizeDroppedPath(text), text);
});

// ── preprocessMessage ────────────────────────────────────────────────────────

test('dropped image path is uploaded and removed from the message', async t => {
	const {client, photos} = makeClient();
	const result = await preprocessMessage(dropped('photo one.png'), {
		client,
		threadId: 'thread_1',
	});
	t.deepEqual(photos, [`${directory}/photo one.png`]);
	t.is(result, '');
});

test('single-quoted dropped image is uploaded and removed from the message', async t => {
	const {client, photos} = makeClient();
	const result = await preprocessMessage(quoted('photo one.png'), {
		client,
		threadId: 'thread_1',
	});
	t.deepEqual(photos, [`${directory}/photo one.png`]);
	t.is(result, '');
});

test('dropped text file path is embedded via the #path pipeline', async t => {
	const {client, photos} = makeClient();
	const result = await preprocessMessage(dropped('drop test.txt'), {
		client,
		threadId: 'thread_1',
	});
	t.deepEqual(photos, []);
	t.is(result, `#"${directory}/drop test.txt"\n--- drop test.txt ---\nspaced`);
});

test("dropped path with a double quote is embedded via #'path'", async t => {
	const {client} = makeClient();
	const result = await preprocessMessage(dropped('say "hi".txt'), {
		client,
		threadId: 'thread_1',
	});
	t.is(result, `#'${directory}/say "hi".txt'\n--- say "hi".txt ---\ndouble`);
});

test('existing #"path" syntax still embeds text files', async t => {
	const {client} = makeClient();
	const result = await preprocessMessage(`see #"${directory}/drop test.txt"`, {
		client,
		threadId: 'thread_1',
	});
	t.is(
		result,
		`see #"${directory}/drop test.txt"\n--- drop test.txt ---\nspaced`,
	);
});

test('path inside normal text is not embedded', async t => {
	const {client, photos} = makeClient();
	const text = `check ${directory}/notes.txt`;
	const result = await preprocessMessage(text, {
		client,
		threadId: 'thread_1',
	});
	t.deepEqual(photos, []);
	t.is(result, text);
});
