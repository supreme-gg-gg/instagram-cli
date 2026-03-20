/* eslint-disable @typescript-eslint/no-unsafe-call */

import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'ava';
import {SessionManager} from '../source/session.js';
import {ConfigManager} from '../source/config.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const configManager = ConfigManager.getInstance();

async function withTempUsersDir(
	fn: (tmpDir: string) => Promise<void>,
): Promise<void> {
	await configManager.initialize();
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ig-cli-test-'));
	const originalUsersDir = configManager.get('advanced.usersDir');

	try {
		await configManager.set('advanced.usersDir', tmpDir);
		await fn(tmpDir);
	} finally {
		await configManager.set('advanced.usersDir', originalUsersDir);
		await fs.rm(tmpDir, {recursive: true, force: true});
	}
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.serial(
	'SessionManager: session file is written with owner-only permissions',
	async t => {
		await withTempUsersDir(async tmpDir => {
			const manager = new SessionManager('test-user');
			await manager.saveSession({test: 'data'});

			const sessionPath = path.join(tmpDir, 'test-user', 'session.ts.json');
			const stat = await fs.stat(sessionPath);

			t.is(
				stat.mode & 0o777,
				0o600,
				'Session file should be owner read/write only (0o600)',
			);
		});
	},
);

test.serial(
	'SessionManager: session directory is created with owner-only permissions',
	async t => {
		await withTempUsersDir(async tmpDir => {
			const manager = new SessionManager('test-user-dir');
			await manager.saveSession({test: 'data'});

			const dirPath = path.join(tmpDir, 'test-user-dir');
			const stat = await fs.stat(dirPath);

			t.is(
				stat.mode & 0o777,
				0o700,
				'Session directory should be owner-only (0o700)',
			);
		});
	},
);
