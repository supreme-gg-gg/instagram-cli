/* eslint-disable @typescript-eslint/no-unsafe-call */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'ava';
import {
	dropPinnedDefaults,
	resolveDataDir,
	resolveDataSubdir,
	resolvePathLayout,
} from '../source/config.js';

// Each test gets an empty fake home directory under one temporary root
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-config-'));
const makeHome = () => fs.mkdtempSync(path.join(tempRoot, 'home-'));

test.after.always(() => {
	fs.rmSync(tempRoot, {recursive: true, force: true});
});

test('an existing ~/.instagram-cli config keeps everything there', t => {
	const home = makeHome();
	const legacyDir = path.join(home, '.instagram-cli');
	fs.mkdirSync(legacyDir);
	fs.writeFileSync(path.join(legacyDir, 'config.ts.yaml'), '');

	const layout = resolvePathLayout({XDG_DATA_HOME: '/xdg/data'}, home);
	const advanced = {debugMode: false};

	t.is(layout.configFile, path.join(legacyDir, 'config.ts.yaml'));
	t.is(resolveDataDir(advanced, layout), legacyDir);
	t.is(
		resolveDataSubdir(advanced, 'usersDir', layout),
		path.join(legacyDir, 'users'),
	);
	t.is(
		resolveDataSubdir(advanced, 'cacheDir', layout),
		path.join(legacyDir, 'cache'),
	);
	t.is(
		resolveDataSubdir(advanced, 'logsDir', layout),
		path.join(legacyDir, 'logs'),
	);
});

test('without a legacy config, XDG variables are used', t => {
	const home = makeHome();
	const layout = resolvePathLayout(
		{
			XDG_CONFIG_HOME: '/xdg/config',
			XDG_DATA_HOME: '/xdg/data',
			XDG_CACHE_HOME: '/xdg/cache',
			XDG_STATE_HOME: '/xdg/state',
		},
		home,
	);
	const advanced = {debugMode: false};

	t.is(
		layout.configFile,
		path.join('/xdg/config', 'instagram-cli', 'config.ts.yaml'),
	);
	t.is(
		resolveDataDir(advanced, layout),
		path.join('/xdg/data', 'instagram-cli'),
	);
	t.is(
		resolveDataSubdir(advanced, 'usersDir', layout),
		path.join('/xdg/data', 'instagram-cli', 'users'),
	);
	t.is(
		resolveDataSubdir(advanced, 'cacheDir', layout),
		path.join('/xdg/cache', 'instagram-cli'),
	);
	t.is(
		resolveDataSubdir(advanced, 'logsDir', layout),
		path.join('/xdg/state', 'instagram-cli', 'logs'),
	);
});

test('unset, empty or relative XDG variables use the spec defaults', t => {
	const home = makeHome();
	const layout = resolvePathLayout(
		{XDG_CONFIG_HOME: '', XDG_DATA_HOME: 'relative/data'},
		home,
	);

	t.is(
		layout.configFile,
		path.join(home, '.config', 'instagram-cli', 'config.ts.yaml'),
	);
	t.is(layout.dataDir, path.join(home, '.local', 'share', 'instagram-cli'));
	t.is(
		layout.subdirDefaults.cacheDir,
		path.join(home, '.cache', 'instagram-cli'),
	);
	t.is(
		layout.subdirDefaults.logsDir,
		path.join(home, '.local', 'state', 'instagram-cli', 'logs'),
	);
});

test('dataDir and explicit overrides are respected', t => {
	const home = makeHome();
	const layout = resolvePathLayout({XDG_CACHE_HOME: '/xdg/cache'}, home);
	const advanced = {
		debugMode: false,
		dataDir: '/data/ig',
		mediaDir: 'pictures',
		logsDir: '/var/log/ig',
	};

	t.is(
		resolveDataSubdir(advanced, 'usersDir', layout),
		path.resolve('/data/ig/users'),
	);
	t.is(
		resolveDataSubdir(advanced, 'mediaDir', layout),
		path.resolve('/data/ig/pictures'),
	);
	t.is(
		resolveDataSubdir(advanced, 'logsDir', layout),
		path.resolve('/var/log/ig'),
	);
	// Cache stays in XDG_CACHE_HOME unless set explicitly
	t.is(
		resolveDataSubdir(advanced, 'cacheDir', layout),
		path.join('/xdg/cache', 'instagram-cli'),
	);
});

test('pinned default subdirectories are dropped only with the default dataDir', t => {
	const home = makeHome();
	const legacyDir = path.join(home, '.instagram-cli');
	const pinned = {
		usersDir: path.join(legacyDir, 'users'),
		cacheDir: '/custom/cache',
	};

	const withDefault = {debugMode: false, dataDir: legacyDir, ...pinned};
	t.true(dropPinnedDefaults(withDefault, home));
	t.deepEqual(withDefault, {
		debugMode: false,
		dataDir: legacyDir,
		cacheDir: '/custom/cache',
	});

	// Sessions are still in ~/.instagram-cli/users, so keep pointing there
	const withCustom = {debugMode: false, dataDir: '/data/ig', ...pinned};
	t.false(dropPinnedDefaults(withCustom, home));
	t.is(withCustom.usersDir, path.join(legacyDir, 'users'));
});
