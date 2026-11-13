import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'ava';
import {findConfigFile, resolveDataSubdir} from '../source/config.js';

const home = os.homedir();
const defaultDataDir = path.join(home, '.instagram-cli');

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
test('default dataDir resolves to the same paths as before', t => {
	const advanced = {debugMode: false, dataDir: defaultDataDir};
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	t.deepEqual(
		[
			resolveDataSubdir(advanced, 'usersDir'),
			resolveDataSubdir(advanced, 'downloadDir'),
		],
		[
			path.join(defaultDataDir, 'users'),
			path.join(defaultDataDir, 'downloads'),
		],
	);
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
test('changing dataDir moves the subdirectories', t => {
	const advanced = {debugMode: false, dataDir: '/data/ig'};
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	t.deepEqual(
		[
			resolveDataSubdir(advanced, 'cacheDir'),
			resolveDataSubdir(advanced, 'logsDir'),
		],
		[path.resolve('/data/ig/cache'), path.resolve('/data/ig/logs')],
	);
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
test('absolute, relative and ~ overrides are respected', t => {
	const advanced = {
		debugMode: false,
		dataDir: '/data/ig',
		cacheDir: '/var/cache/ig',
		mediaDir: 'pictures',
		logsDir: '~/ig-logs',
	};
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	t.deepEqual(
		[
			resolveDataSubdir(advanced, 'cacheDir'),
			resolveDataSubdir(advanced, 'mediaDir'),
			resolveDataSubdir(advanced, 'logsDir'),
		],
		[
			path.resolve('/var/cache/ig'),
			path.resolve('/data/ig/pictures'),
			path.join(home, 'ig-logs'),
		],
	);
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
test('config lookup prefers the XDG location when that file exists', t => {
	const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-config-'));
	const legacyFile = path.join(fakeHome, '.instagram-cli', 'config.ts.yaml');
	const xdgFile = path.join(
		fakeHome,
		'.config',
		'instagram-cli',
		'config.ts.yaml',
	);

	const before = findConfigFile({}, fakeHome);
	fs.mkdirSync(path.dirname(xdgFile), {recursive: true});
	fs.writeFileSync(xdgFile, '');
	const after = findConfigFile({}, fakeHome);
	const otherXdg = findConfigFile(
		{XDG_CONFIG_HOME: path.join(fakeHome, 'elsewhere')},
		fakeHome,
	);
	fs.rmSync(fakeHome, {recursive: true, force: true});

	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	t.deepEqual([before, after, otherXdg], [legacyFile, xdgFile, legacyFile]);
});
