/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import chalk from 'chalk';
import React from 'react';
import test, {type ExecutionContext} from 'ava';
import {render} from 'ink-testing-library';
import InputBox, {
	clickToCharOffset,
} from '../source/ui/components/input-box.js';
import {MouseProvider} from '../source/ui/context/mouse-context.js';

// Force chalk to emit ANSI color codes so the cursor highlight is visible in
// the captured frame output. This must be set before any rendering occurs.
chalk.level = 3;

// ── Helpers ──────────────────────────────────────────────────────────────────

const delay = async (ms: number): Promise<void> => {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
};

/**
 * Build an SGR mouse left-press sequence (1-indexed col/row).
 * Uses Unicode escapes to satisfy the linter's unicorn/no-hex-escape rule.
 */
function sgrLeftPress(col: number, row: number): string {
	return `\u001B[<0;${col};${row}M`;
}

// In the test environment the outer box fills the full 100-column viewport:
//   layout = { x: 0, y: 0, width: 100, height: 3 }
// The bordered inner box (borderStyle="round", paddingX={1}) positions text at:
//   inputTextX = layout.x + 2 = 2  (0-indexed)
//   inputTextY = layout.y + 1 = 1  (0-indexed)
// Translating to 1-indexed SGR coordinates:
//   SGR col = inputTextX + colInLine + 1
//   SGR row = inputTextY + lineIndex + 1
const INPUT_TEXT_X = 2; // 0-indexed column where text starts
const INPUT_TEXT_Y = 1; // 0-indexed row where text starts

/** Convert a (lineIndex, colInLine) pair to an SGR left-press sequence. */
function clickAt(lineIndex: number, colInLine: number): string {
	return sgrLeftPress(
		INPUT_TEXT_X + colInLine + 1,
		INPUT_TEXT_Y + lineIndex + 1,
	);
}

// ── clickToCharOffset unit tests ─────────────────────────────────────────────

test('clickToCharOffset: ASCII single line', (t: ExecutionContext) => {
	// "hello" — all width-1 chars; visual col equals char index
	t.is(clickToCharOffset('hello', 96, 0, 0), 0);
	t.is(clickToCharOffset('hello', 96, 0, 2), 2);
	t.is(clickToCharOffset('hello', 96, 0, 4), 4);
	t.is(clickToCharOffset('hello', 96, 0, 99), 5); // past end → clamp to end
});

test('clickToCharOffset: wide emoji (width 2)', (t: ExecutionContext) => {
	// "😀ab" — emoji spans visual cols 0-1, 'a' at col 2, 'b' at col 3.
	// Clicking any cell occupied by the emoji places the cursor at the emoji.
	t.is(clickToCharOffset('\u{1F600}ab', 96, 0, 0), 0); // left cell of emoji → at emoji
	t.is(clickToCharOffset('\u{1F600}ab', 96, 0, 1), 0); // right cell of emoji → still at emoji
	t.is(clickToCharOffset('\u{1F600}ab', 96, 0, 2), 1); // 'a'
	t.is(clickToCharOffset('\u{1F600}ab', 96, 0, 3), 2); // 'b'
});

test('clickToCharOffset: CJK wide character (width 2)', (t: ExecutionContext) => {
	// "你好" — each char is width-2; clicking either cell places cursor at that char.
	t.is(clickToCharOffset('\u{4F60}\u{597D}', 96, 0, 0), 0); // left cell of '你' → at '你'
	t.is(clickToCharOffset('\u{4F60}\u{597D}', 96, 0, 1), 0); // right cell of '你' → still at '你'
	t.is(clickToCharOffset('\u{4F60}\u{597D}', 96, 0, 2), 1); // left cell of '好' → at '好'
	t.is(clickToCharOffset('\u{4F60}\u{597D}', 96, 0, 3), 1); // right cell of '好' → still at '好'
});

test('clickToCharOffset: multi-line ASCII wrapping', (t: ExecutionContext) => {
	// "abcde" with lineWidth=3: line 0 = "abc", line 1 = "de"
	t.is(clickToCharOffset('abcde', 3, 0, 0), 0); // 'a'
	t.is(clickToCharOffset('abcde', 3, 0, 2), 2); // 'c'
	t.is(clickToCharOffset('abcde', 3, 1, 0), 3); // 'd' — first char on line 1
	t.is(clickToCharOffset('abcde', 3, 1, 1), 4); // 'e'
});

// ── Integration tests: mouse click → cursor highlight in rendered frame ──────

test('mouse click places cursor on correct ASCII character', async (t: ExecutionContext) => {
	const {lastFrame, stdin} = render(
		<MouseProvider>
			<InputBox onSend={() => {}} />
		</MouseProvider>,
	);

	stdin.write('hello');
	await delay(100);

	// Click on 'l' (index 2, visual col 2)
	stdin.write(clickAt(0, 2));
	await delay(100);

	const frame = lastFrame()!;
	// Cursor is rendered as chalk.inverse(char) = ESC[7m{char}ESC[27m
	t.true(
		frame.includes('\u001B[7ml\u001B[27m'),
		`Expected cursor on "l" but got: ${JSON.stringify(frame)}`,
	);
});

test('mouse click places cursor at start of text (col 0)', async (t: ExecutionContext) => {
	const {lastFrame, stdin} = render(
		<MouseProvider>
			<InputBox onSend={() => {}} />
		</MouseProvider>,
	);

	stdin.write('hello');
	await delay(100);

	stdin.write(clickAt(0, 0));
	await delay(100);

	const frame = lastFrame()!;
	t.true(
		frame.includes('\u001B[7mh\u001B[27m'),
		`Expected cursor on "h" but got: ${JSON.stringify(frame)}`,
	);
});

test('mouse click on left cell of emoji places cursor at emoji', async (t: ExecutionContext) => {
	const {lastFrame, stdin} = render(
		<MouseProvider>
			<InputBox onSend={() => {}} />
		</MouseProvider>,
	);

	stdin.write('\u{1F600}abc');
	await delay(100);

	// Emoji spans visual cols 0-1. Clicking col 0 (left cell) → cursor at emoji (index 0).
	stdin.write(clickAt(0, 0));
	await delay(100);

	const frame = lastFrame()!;
	t.true(
		frame.includes(`\u001B[7m\u{1F600}\u001B[27m`),
		`Expected cursor on emoji but got: ${JSON.stringify(frame)}`,
	);
});

test('mouse click on right cell of emoji places cursor at emoji', async (t: ExecutionContext) => {
	const {lastFrame, stdin} = render(
		<MouseProvider>
			<InputBox onSend={() => {}} />
		</MouseProvider>,
	);

	stdin.write('\u{1F600}abc');
	await delay(100);

	// Emoji spans visual cols 0-1. Clicking col 1 (right cell) still places
	// the cursor at the emoji (index 0) — not after it.
	stdin.write(clickAt(0, 1));
	await delay(100);

	const frame = lastFrame()!;
	t.true(
		frame.includes(`\u001B[7m\u{1F600}\u001B[27m`),
		`Expected cursor on emoji but got: ${JSON.stringify(frame)}`,
	);
});

test('mouse click after emoji places cursor at correct character', async (t: ExecutionContext) => {
	const {lastFrame, stdin} = render(
		<MouseProvider>
			<InputBox onSend={() => {}} />
		</MouseProvider>,
	);

	stdin.write('\u{1F600}abc');
	await delay(100);

	// 'a' starts at visual col 2 (emoji takes cols 0-1)
	stdin.write(clickAt(0, 2));
	await delay(100);

	const frame = lastFrame()!;
	t.true(
		frame.includes('\u001B[7ma\u001B[27m'),
		`Expected cursor on "a" but got: ${JSON.stringify(frame)}`,
	);
});

test('mouse click above text area is ignored', async (t: ExecutionContext) => {
	const {lastFrame, stdin} = render(
		<MouseProvider>
			<InputBox onSend={() => {}} />
		</MouseProvider>,
	);

	stdin.write('hello');
	await delay(100);

	// After typing, cursor should be at end of "hello"
	const frameBefore = lastFrame()!;

	// Click on the top border row (SGR row = INPUT_TEXT_Y, i.e. 0-indexed row 0
	// which is the border — outside the text area)
	stdin.write(sgrLeftPress(INPUT_TEXT_X + 3, INPUT_TEXT_Y));
	await delay(100);

	// Frame should be unchanged — cursor still at end
	t.is(lastFrame(), frameBefore);
});
