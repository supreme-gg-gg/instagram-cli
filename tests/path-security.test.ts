/* eslint-disable @typescript-eslint/no-unsafe-call */

import {Buffer} from 'node:buffer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'ava';
import {validateFilePath} from '../source/utils/path-utils.js';

// Create temp files inside the home directory for size tests
let tempDir: string;
let smallFile: string;
let largeFile: string;

test.before(async () => {
	tempDir = await fs.mkdtemp(path.join(os.homedir(), '.instagram-cli-test-'));
	smallFile = path.join(tempDir, 'small.txt');
	largeFile = path.join(tempDir, 'large.txt');

	await fs.writeFile(smallFile, 'hello');
	// 60 KB — over the 50 KB text limit
	await fs.writeFile(largeFile, Buffer.alloc(60 * 1024, 'x'));
});

test.after.always(async () => {
	await fs.rm(tempDir, {recursive: true, force: true});
});

// --- Home directory boundary ---

test.serial('blocks paths outside home directory', async t => {
	const result = await validateFilePath('/etc/passwd');
	t.false(result.allowed);
	t.truthy(result.reason?.includes('outside'));
});

test.serial('blocks /etc/shadow', async t => {
	const result = await validateFilePath('/etc/shadow');
	t.false(result.allowed);
});

test.serial('allows paths inside home directory', async t => {
	const result = await validateFilePath(smallFile);
	t.true(result.allowed);
	t.is(result.sizeBytes, 5);
});

// --- Sensitive file patterns ---

test.serial('blocks .ssh paths', async t => {
	const sshKey = path.join(os.homedir(), '.ssh', 'id_rsa');
	const result = await validateFilePath(sshKey);
	t.false(result.allowed);
	t.truthy(result.reason?.includes('sensitive'));
});

test.serial('blocks .env files', async t => {
	const envFile = path.join(os.homedir(), 'project', '.env');
	const result = await validateFilePath(envFile);
	t.false(result.allowed);
	t.truthy(result.reason?.includes('sensitive'));
});

test.serial('blocks .aws credentials', async t => {
	const awsCreds = path.join(os.homedir(), '.aws', 'credentials');
	const result = await validateFilePath(awsCreds);
	t.false(result.allowed);
});

test.serial('blocks session.ts.json', async t => {
	const session = path.join(
		os.homedir(),
		'.instagram-cli',
		'users',
		'test',
		'session.ts.json',
	);
	const result = await validateFilePath(session);
	t.false(result.allowed);
});

// --- File size limits ---

test.serial('allows small text files', async t => {
	const result = await validateFilePath(smallFile, 'text');
	t.true(result.allowed);
});

test.serial('blocks text files over 50 KB', async t => {
	const result = await validateFilePath(largeFile, 'text');
	t.false(result.allowed);
	t.truthy(result.reason?.includes('too large'));
});

test.serial('allows large files in media mode (under 50 MB)', async t => {
	const result = await validateFilePath(largeFile, 'media');
	t.true(result.allowed);
});

// --- Edge cases ---

test.serial('returns not-found for nonexistent files', async t => {
	const result = await validateFilePath(
		path.join(os.homedir(), 'nonexistent-file-abc123.txt'),
	);
	t.false(result.allowed);
	t.truthy(result.reason?.includes('not found'));
});
