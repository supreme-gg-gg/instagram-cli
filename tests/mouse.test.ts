/* eslint-disable @typescript-eslint/no-unsafe-call */

import test from 'ava';
import {
	ESC,
	parseSGRMouseEvent,
	parseX11MouseEvent,
	parseMouseEvent,
	couldBeMouseSequence,
	isIncompleteMouseSequence,
} from '../source/utils/mouse.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build an SGR mouse sequence: ESC [ < button ; col ; row [mM] */
function sgr(button: number, col: number, row: number, release = false) {
	return `${ESC}[<${button};${col};${row}${release ? 'm' : 'M'}`;
}

/** Build an X11 mouse sequence: ESC [ M (3 raw bytes) */
function x11(button: number, col: number, row: number) {
	return (
		`${ESC}[M` +
		String.fromCodePoint(button + 32) +
		String.fromCodePoint(col + 32) +
		String.fromCodePoint(row + 32)
	);
}

// ── parseSGRMouseEvent ───────────────────────────────────────────────────────

test('SGR: left press', t => {
	const result = parseSGRMouseEvent(sgr(0, 10, 20));
	t.truthy(result);
	const {event, length} = result!;
	t.is(event.name, 'left-press');
	t.is(event.button, 'left');
	t.is(event.col, 10);
	t.is(event.row, 20);
	t.false(event.shift);
	t.false(event.meta);
	t.false(event.ctrl);
	t.is(length, sgr(0, 10, 20).length);
});

test('SGR: left release', t => {
	const result = parseSGRMouseEvent(sgr(0, 5, 15, true));
	t.truthy(result);
	t.is(result!.event.name, 'left-release');
	t.is(result!.event.button, 'left');
});

test('SGR: middle press', t => {
	const result = parseSGRMouseEvent(sgr(1, 1, 1));
	t.truthy(result);
	t.is(result!.event.name, 'middle-press');
	t.is(result!.event.button, 'middle');
});

test('SGR: middle release', t => {
	const result = parseSGRMouseEvent(sgr(1, 1, 1, true));
	t.truthy(result);
	t.is(result!.event.name, 'middle-release');
	t.is(result!.event.button, 'middle');
});

test('SGR: right press', t => {
	const result = parseSGRMouseEvent(sgr(2, 1, 1));
	t.truthy(result);
	t.is(result!.event.name, 'right-press');
	t.is(result!.event.button, 'right');
});

test('SGR: right release', t => {
	const result = parseSGRMouseEvent(sgr(2, 1, 1, true));
	t.truthy(result);
	t.is(result!.event.name, 'right-release');
	t.is(result!.event.button, 'right');
});

test('SGR: scroll up', t => {
	const result = parseSGRMouseEvent(sgr(64, 30, 40));
	t.truthy(result);
	t.is(result!.event.name, 'scroll-up');
	t.is(result!.event.col, 30);
	t.is(result!.event.row, 40);
});

test('SGR: scroll down', t => {
	const result = parseSGRMouseEvent(sgr(65, 30, 40));
	t.truthy(result);
	t.is(result!.event.name, 'scroll-down');
});

test('SGR: move (button 32 = motion flag)', t => {
	const result = parseSGRMouseEvent(sgr(32, 5, 5));
	t.truthy(result);
	t.is(result!.event.name, 'move');
});

test('SGR: shift modifier', t => {
	// Shift flag = bit 2 (value 4)
	const result = parseSGRMouseEvent(sgr(4, 1, 1));
	t.truthy(result);
	t.true(result!.event.shift);
	t.false(result!.event.meta);
	t.false(result!.event.ctrl);
});

test('SGR: meta modifier', t => {
	// Meta flag = bit 3 (value 8)
	const result = parseSGRMouseEvent(sgr(8, 1, 1));
	t.truthy(result);
	t.false(result!.event.shift);
	t.true(result!.event.meta);
	t.false(result!.event.ctrl);
});

test('SGR: ctrl modifier', t => {
	// Ctrl flag = bit 4 (value 16)
	const result = parseSGRMouseEvent(sgr(16, 1, 1));
	t.truthy(result);
	t.false(result!.event.shift);
	t.false(result!.event.meta);
	t.true(result!.event.ctrl);
});

test('SGR: combined modifiers (shift + ctrl)', t => {
	// Shift (4) + Ctrl (16) = 20, left button = 0, total = 20
	const result = parseSGRMouseEvent(sgr(20, 1, 1));
	t.truthy(result);
	t.true(result!.event.shift);
	t.false(result!.event.meta);
	t.true(result!.event.ctrl);
	t.is(result!.event.name, 'left-press');
});

test('SGR: large coordinates (> 223)', t => {
	const result = parseSGRMouseEvent(sgr(0, 300, 250));
	t.truthy(result);
	t.is(result!.event.col, 300);
	t.is(result!.event.row, 250);
});

test('SGR: returns correct consumed length', t => {
	const seq = sgr(0, 100, 200);
	const trailingData = 'hello';
	const result = parseSGRMouseEvent(seq + trailingData);
	t.truthy(result);
	t.is(result!.length, seq.length);
});

test('SGR: returns null for non-mouse input', t => {
	t.is(parseSGRMouseEvent('hello'), null);
	t.is(parseSGRMouseEvent(''), null);
	t.is(parseSGRMouseEvent(`${ESC}[A`), null); // arrow key
});

// ── parseX11MouseEvent ───────────────────────────────────────────────────────

test('X11: left press', t => {
	const result = parseX11MouseEvent(x11(0, 10, 20));
	t.truthy(result);
	t.is(result!.event.name, 'left-press');
	t.is(result!.event.button, 'left');
	t.is(result!.event.col, 10);
	t.is(result!.event.row, 20);
});

test('X11: middle press', t => {
	const result = parseX11MouseEvent(x11(1, 1, 1));
	t.truthy(result);
	t.is(result!.event.name, 'middle-press');
	t.is(result!.event.button, 'middle');
});

test('X11: right press', t => {
	const result = parseX11MouseEvent(x11(2, 1, 1));
	t.truthy(result);
	t.is(result!.event.name, 'right-press');
	t.is(result!.event.button, 'right');
});

test('X11: release (button code 3 = left-release)', t => {
	// X11 reports all releases as button code 3
	const result = parseX11MouseEvent(x11(3, 5, 10));
	t.truthy(result);
	t.is(result!.event.name, 'left-release');
	// button code 3 & 3 = 3 → getButtonFromCode returns 'none',
	// but the release handler overrides to 'left'
	t.is(result!.event.button, 'left');
});

test('X11: scroll up', t => {
	const result = parseX11MouseEvent(x11(64, 15, 25));
	t.truthy(result);
	t.is(result!.event.name, 'scroll-up');
});

test('X11: scroll down', t => {
	const result = parseX11MouseEvent(x11(65, 15, 25));
	t.truthy(result);
	t.is(result!.event.name, 'scroll-down');
});

test('X11: move', t => {
	const result = parseX11MouseEvent(x11(32, 5, 5));
	t.truthy(result);
	t.is(result!.event.name, 'move');
});

test('X11: shift modifier', t => {
	const result = parseX11MouseEvent(x11(4, 1, 1));
	t.truthy(result);
	t.true(result!.event.shift);
	t.false(result!.event.meta);
	t.false(result!.event.ctrl);
});

test('X11: meta modifier', t => {
	const result = parseX11MouseEvent(x11(8, 1, 1));
	t.truthy(result);
	t.true(result!.event.meta);
});

test('X11: ctrl modifier', t => {
	const result = parseX11MouseEvent(x11(16, 1, 1));
	t.truthy(result);
	t.true(result!.event.ctrl);
});

test('X11: returns correct consumed length (always 6 bytes)', t => {
	const seq = x11(0, 1, 1);
	const result = parseX11MouseEvent(seq + 'extra');
	t.truthy(result);
	t.is(result!.length, 6); // ESC [ M + 3 raw bytes
});

test('X11: returns null for non-mouse input', t => {
	t.is(parseX11MouseEvent('hello'), null);
	t.is(parseX11MouseEvent(''), null);
});

// ── parseMouseEvent (unified parser) ─────────────────────────────────────────

test('parseMouseEvent: prefers SGR over X11', t => {
	const sgrSeq = sgr(0, 10, 20);
	const result = parseMouseEvent(sgrSeq);
	t.truthy(result);
	t.is(result!.event.name, 'left-press');
	t.is(result!.event.col, 10);
	t.is(result!.event.row, 20);
});

test('parseMouseEvent: falls through to X11 when not SGR', t => {
	const x11Seq = x11(0, 10, 20);
	const result = parseMouseEvent(x11Seq);
	t.truthy(result);
	t.is(result!.event.name, 'left-press');
	t.is(result!.event.col, 10);
	t.is(result!.event.row, 20);
});

test('parseMouseEvent: returns null for garbage', t => {
	t.is(parseMouseEvent('not a mouse event'), null);
	t.is(parseMouseEvent(''), null);
});

// ── couldBeMouseSequence ─────────────────────────────────────────────────────

test('couldBeMouseSequence: empty string', t => {
	t.true(couldBeMouseSequence(''));
});

test('couldBeMouseSequence: ESC alone (prefix of both)', t => {
	t.true(couldBeMouseSequence(ESC));
});

test('couldBeMouseSequence: ESC [ (prefix of both)', t => {
	t.true(couldBeMouseSequence(`${ESC}[`));
});

test('couldBeMouseSequence: full SGR prefix', t => {
	t.true(couldBeMouseSequence(`${ESC}[<`));
});

test('couldBeMouseSequence: full X11 prefix', t => {
	t.true(couldBeMouseSequence(`${ESC}[M`));
});

test('couldBeMouseSequence: complete SGR sequence', t => {
	t.true(couldBeMouseSequence(sgr(0, 1, 1)));
});

test('couldBeMouseSequence: complete X11 sequence', t => {
	t.true(couldBeMouseSequence(x11(0, 1, 1)));
});

test('couldBeMouseSequence: unrelated input', t => {
	t.false(couldBeMouseSequence('hello'));
	t.false(couldBeMouseSequence('a'));
});

// ── isIncompleteMouseSequence ────────────────────────────────────────────────

test('isIncompleteMouseSequence: ESC alone is incomplete', t => {
	t.true(isIncompleteMouseSequence(ESC));
});

test('isIncompleteMouseSequence: ESC [ is incomplete', t => {
	t.true(isIncompleteMouseSequence(`${ESC}[`));
});

test('isIncompleteMouseSequence: SGR prefix without terminator is incomplete', t => {
	// Just the prefix, no digits or terminator yet
	t.true(isIncompleteMouseSequence(`${ESC}[<`));
	// Has some digits but no m/M terminator
	t.true(isIncompleteMouseSequence(`${ESC}[<0;10;20`));
});

test('isIncompleteMouseSequence: X11 prefix with missing bytes is incomplete', t => {
	t.true(isIncompleteMouseSequence(`${ESC}[M`));
	// Only 1 of 3 raw bytes
	t.true(isIncompleteMouseSequence(`${ESC}[M` + String.fromCodePoint(32)));
	// Only 2 of 3 raw bytes
	t.true(
		isIncompleteMouseSequence(
			`${ESC}[M` + String.fromCodePoint(32) + String.fromCodePoint(33),
		),
	);
});

test('isIncompleteMouseSequence: complete SGR is not incomplete', t => {
	t.false(isIncompleteMouseSequence(sgr(0, 1, 1)));
});

test('isIncompleteMouseSequence: complete X11 is not incomplete', t => {
	t.false(isIncompleteMouseSequence(x11(0, 1, 1)));
});
