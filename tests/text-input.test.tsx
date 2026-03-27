/* eslint-disable @typescript-eslint/no-unsafe-call */

import chalk from 'chalk';
import React from 'react';
import test from 'ava';
import {render} from 'ink-testing-library';
import InputBox from '../source/ui/components/input-box.js';
import {MouseProvider} from '../source/ui/context/mouse-context.js';

// Force chalk to emit ANSI color codes so cursor highlight is visible in
// captured frame output. Must be set before any rendering occurs.
chalk.level = 3;

// ── Helpers ──────────────────────────────────────────────────────────────────

const delay = async (ms: number): Promise<void> =>
	new Promise(resolve => {
		setTimeout(resolve, ms);
	});

const LEFT_ARROW = '\u001B[D';
const DELETE_KEY = '\u001B[3~';
const BACKSPACE = '\u0008';

// ── Delete key tests ──────────────────────────────────────────────────────────

test('delete key removes character to the right of cursor', async t => {
	const {lastFrame, stdin, unmount} = render(
		<MouseProvider>
			<InputBox onSend={() => {}} />
		</MouseProvider>,
	);

	// Type "ab", cursor ends at index 2
	stdin.write('ab');
	await delay(100);

	// Move cursor one left: now at index 1 (on 'b')
	stdin.write(LEFT_ARROW);
	await delay(100);

	// Delete removes char at index 1 ('b'), cursor stays at 1 (now the end)
	stdin.write(DELETE_KEY);
	await delay(100);

	const frame = lastFrame()!;
	// Value is now "a", cursor at end — rendered as "a" + inverse-space
	t.true(
		frame.includes('a\u001B[7m \u001B[27m'),
		`Expected "a" with cursor at end but got: ${JSON.stringify(frame)}`,
	);
	unmount();
});

test('delete key at end of string does nothing', async t => {
	const {lastFrame, stdin, unmount} = render(
		<MouseProvider>
			<InputBox onSend={() => {}} />
		</MouseProvider>,
	);

	stdin.write('hello');
	await delay(100);

	const frameBefore = lastFrame()!;

	// Cursor is at end — nothing to the right
	stdin.write(DELETE_KEY);
	await delay(100);

	t.is(lastFrame(), frameBefore);
	unmount();
});

test('backspace removes character to the left of cursor', async t => {
	const {lastFrame, stdin, unmount} = render(
		<MouseProvider>
			<InputBox onSend={() => {}} />
		</MouseProvider>,
	);

	// Type "ab", cursor ends at index 2
	stdin.write('ab');
	await delay(100);

	// Move cursor one left: now at index 1 (on 'b')
	stdin.write(LEFT_ARROW);
	await delay(100);

	// Backspace removes char at index 0 ('a'), cursor moves to 0
	stdin.write(BACKSPACE);
	await delay(100);

	const frame = lastFrame()!;
	// Value is now "b", cursor at index 0 — rendered as inverse-'b'
	t.true(
		frame.includes('\u001B[7mb\u001B[27m'),
		`Expected cursor on "[b]" but got: ${JSON.stringify(frame)}`,
	);
	unmount();
});

test('backspace at start of string does nothing', async t => {
	const {lastFrame, stdin, unmount} = render(
		<MouseProvider>
			<InputBox onSend={() => {}} />
		</MouseProvider>,
	);

	// Single char so one left arrow puts cursor at index 0
	stdin.write('a');
	await delay(100);

	stdin.write(LEFT_ARROW);
	await delay(100);

	const frameBefore = lastFrame()!;

	// Cursor is at index 0 — nothing to the left
	stdin.write(BACKSPACE);
	await delay(100);

	t.is(lastFrame(), frameBefore);
	unmount();
});
