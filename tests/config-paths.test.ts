/* eslint-disable @typescript-eslint/no-unsafe-call */

import os from 'node:os';
import path from 'node:path';
import test from 'ava';
import {resolveAdvancedPaths} from '../source/config.js';
import {expandPathVariables} from '../source/utils/path-utils.js';

const home = os.homedir();
const defaultDataDir = path.join(home, '.instagram-cli');

function advancedConfig(dataDir: string, overrides = {}) {
	return {
		debugMode: false,
		dataDir,
		usersDir: path.join(defaultDataDir, 'users'),
		cacheDir: path.join(defaultDataDir, 'cache'),
		mediaDir: path.join(defaultDataDir, 'media'),
		generatedDir: path.join(defaultDataDir, 'generated'),
		logsDir: path.join(defaultDataDir, 'logs'),
		downloadDir: path.join(defaultDataDir, 'downloads'),
		...overrides,
	};
}

// ── expandPathVariables ───────────────────────────────────────────────────────

test('expandPathVariables: expands bare and braced variables and ~', t => {
	const env = {XDG_DATA_HOME: '/xdg/data'};
	t.is(expandPathVariables('$XDG_DATA_HOME/ig', env), '/xdg/data/ig');
	// eslint-disable-next-line no-template-curly-in-string -- literal shell-style ${VAR} input
	t.is(expandPathVariables('${XDG_DATA_HOME}/ig', env), '/xdg/data/ig');
	t.is(expandPathVariables('~/ig', env), path.join(home, 'ig'));
});

test('expandPathVariables: unset XDG variables use spec defaults', t => {
	t.is(
		expandPathVariables('$XDG_DATA_HOME/ig', {}),
		path.join(home, '.local', 'share') + '/ig',
	);
	t.is(
		expandPathVariables('$XDG_CACHE_HOME/ig', {XDG_CACHE_HOME: ''}),
		path.join(home, '.cache') + '/ig',
	);
});

test('expandPathVariables: other unset variables are left as written', t => {
	t.is(expandPathVariables('$NOT_SET/ig', {}), '$NOT_SET/ig');
});

// ── resolveAdvancedPaths ──────────────────────────────────────────────────────

test('resolveAdvancedPaths: default config is unchanged', t => {
	const advanced = advancedConfig(defaultDataDir);
	t.deepEqual(resolveAdvancedPaths(advanced, {}), advanced);
});

test('resolveAdvancedPaths: changing dataDir moves default subdirectories', t => {
	const resolved = resolveAdvancedPaths(
		advancedConfig('$XDG_DATA_HOME/instagram-cli'),
		{XDG_DATA_HOME: '/xdg/data'},
	);
	const dataDir = '/xdg/data/instagram-cli';

	t.is(resolved.dataDir, dataDir);
	t.is(resolved.usersDir, path.join(dataDir, 'users'));
	t.is(resolved.cacheDir, path.join(dataDir, 'cache'));
	t.is(resolved.mediaDir, path.join(dataDir, 'media'));
	t.is(resolved.generatedDir, path.join(dataDir, 'generated'));
	t.is(resolved.logsDir, path.join(dataDir, 'logs'));
	t.is(resolved.downloadDir, path.join(dataDir, 'downloads'));
});

test('resolveAdvancedPaths: explicit subdirectories are kept and expanded', t => {
	const resolved = resolveAdvancedPaths(
		advancedConfig('/data/ig', {cacheDir: '$XDG_CACHE_HOME/instagram-cli'}),
		{XDG_CACHE_HOME: '/xdg/cache'},
	);

	t.is(resolved.cacheDir, '/xdg/cache/instagram-cli');
	t.is(resolved.usersDir, path.join('/data/ig', 'users'));
});
