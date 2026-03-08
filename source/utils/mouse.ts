/**
 * Mouse event parsing for terminal ANSI escape sequences.
 *
 * Terminals report mouse events using two main protocols:
 * - SGR (Select Graphic Rendition) extended mode: ESC [ < button ; col ; row [mM]
 * - X11 normal mode: ESC [ M (3 raw bytes for button, col, row)
 *
 * SGR is preferred because it supports coordinates > 223 and distinguishes
 * press from release. We enable both via:
 *   \x1b[?1002h  -- button-event tracking (clicks, drags, scroll wheel)
 *   \x1b[?1006h  -- SGR extended mouse mode
 *
 * Reference: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const ESC = '\u001B';
export const SGR_EVENT_PREFIX = `${ESC}[<`;
export const X11_EVENT_PREFIX = `${ESC}[M`;

// eslint-disable-next-line no-control-regex
export const SGR_MOUSE_REGEX = /^\u001B\[<(\d+);(\d+);(\d+)([mM])/;
// X11 is ESC [ M followed by 3 bytes
// eslint-disable-next-line no-control-regex
export const X11_MOUSE_REGEX = /^\u001B\[M([\s\S]{3})/;

// ── Types ────────────────────────────────────────────────────────────────────

export type MouseEventName =
	| 'left-press'
	| 'left-release'
	| 'right-press'
	| 'right-release'
	| 'middle-press'
	| 'middle-release'
	| 'scroll-up'
	| 'scroll-down'
	| 'move';

export type MouseButton = 'left' | 'middle' | 'right' | 'none';

export type MouseEvent = {
	name: MouseEventName;
	col: number;
	row: number;
	shift: boolean;
	meta: boolean;
	ctrl: boolean;
	button: MouseButton;
};

export type MouseHandler = (event: MouseEvent) => void | boolean;

// ── Escape sequence helpers ──────────────────────────────────────────────────

/** Write to stdout to enable mouse button-event tracking + SGR extended mode. */
export function enableMouseTracking(stdout: NodeJS.WriteStream): void {
	stdout.write('\u001B[?1002h\u001B[?1006h');
}

/** Write to stdout to disable mouse tracking. */
export function disableMouseTracking(stdout: NodeJS.WriteStream): void {
	stdout.write('\u001B[?1006l\u001B[?1002l');
}

// ── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Map a raw button code + release flag to a named event.
 * Returns null for unrecognised codes.
 */
function getMouseEventName(
	buttonCode: number,
	isRelease: boolean,
): MouseEventName | undefined {
	const isMove = (buttonCode & 32) !== 0;

	// Scroll wheel (bit 6 set)
	if ((buttonCode & 64) === 64) {
		return (buttonCode & 1) === 0 ? 'scroll-up' : 'scroll-down';
	}

	if (isMove) {
		return 'move';
	}

	// Regular button
	const button = buttonCode & 3;
	const type = isRelease ? 'release' : 'press';
	switch (button) {
		case 0: {
			return `left-${type}`;
		}

		case 1: {
			return `middle-${type}`;
		}

		case 2: {
			return `right-${type}`;
		}

		default: {
			return null;
		}
	}
}

/** Extract the button identifier from a raw code. */
function getButtonFromCode(code: number): MouseButton {
	const button = code & 3;
	switch (button) {
		case 0: {
			return 'left';
		}

		case 1: {
			return 'middle';
		}

		case 2: {
			return 'right';
		}

		default: {
			return 'none';
		}
	}
}

/** Try to parse an SGR-format mouse sequence at the start of the buffer. */
export function parseSGRMouseEvent(
	buffer: string,
): {event: MouseEvent; length: number} | undefined {
	const match = SGR_MOUSE_REGEX.exec(buffer);
	if (!match) return null;

	const buttonCode = Number.parseInt(match[1]!, 10);
	const col = Number.parseInt(match[2]!, 10);
	const row = Number.parseInt(match[3]!, 10);
	const isRelease = match[4] === 'm';

	const shift = (buttonCode & 4) !== 0;
	const meta = (buttonCode & 8) !== 0;
	const ctrl = (buttonCode & 16) !== 0;

	const name = getMouseEventName(buttonCode, isRelease);
	if (!name) return null;

	return {
		event: {
			name,
			ctrl,
			meta,
			shift,
			col,
			row,
			button: getButtonFromCode(buttonCode),
		},
		length: match[0].length,
	};
}

/** Try to parse an X11-format mouse sequence at the start of the buffer. */
export function parseX11MouseEvent(
	buffer: string,
): {event: MouseEvent; length: number} | undefined {
	const match = X11_MOUSE_REGEX.exec(buffer);
	if (!match) return null;

	const raw = match[1]!;
	const b = raw.codePointAt(0)! - 32;
	const col = raw.codePointAt(1)! - 32;
	const row = raw.codePointAt(2)! - 32;

	const shift = (b & 4) !== 0;
	const meta = (b & 8) !== 0;
	const ctrl = (b & 16) !== 0;
	const isMove = (b & 32) !== 0;
	const isWheel = (b & 64) !== 0;

	let name: MouseEventName | undefined = null;

	if (isWheel) {
		name = (b & 1) === 0 ? 'scroll-up' : 'scroll-down';
	} else if (isMove) {
		name = 'move';
	} else {
		const button = b & 3;
		if (button === 3) {
			// X11 reports release as button 3 for all buttons
			name = 'left-release';
		} else {
			switch (button) {
				case 0: {
					name = 'left-press';
					break;
				}

				case 1: {
					name = 'middle-press';
					break;
				}

				case 2: {
					name = 'right-press';
					break;
				}

				default: {
					break;
				}
			}
		}
	}

	if (!name) return null;

	let button = getButtonFromCode(b);
	if (name === 'left-release' && button === 'none') {
		button = 'left';
	}

	return {
		event: {name, ctrl, meta, shift, col, row, button},
		length: match[0].length,
	};
}

/** Try to parse any mouse sequence at the start of the buffer (SGR first, then X11). */
export function parseMouseEvent(
	buffer: string,
): {event: MouseEvent; length: number} | undefined {
	return parseSGRMouseEvent(buffer) ?? parseX11MouseEvent(buffer);
}

/** Check whether the buffer could be a partial/prefix of a mouse sequence. */
export function couldBeMouseSequence(buffer: string): boolean {
	if (buffer.length === 0) return true;
	if (
		SGR_EVENT_PREFIX.startsWith(buffer) ||
		buffer.startsWith(SGR_EVENT_PREFIX)
	)
		return true;
	if (
		X11_EVENT_PREFIX.startsWith(buffer) ||
		buffer.startsWith(X11_EVENT_PREFIX)
	)
		return true;
	return false;
}

/**
 * Returns true if the buffer looks like the start of a mouse sequence
 * but doesn't yet contain enough bytes to parse.
 */
export function isIncompleteMouseSequence(buffer: string): boolean {
	if (!couldBeMouseSequence(buffer)) return false;
	if (parseMouseEvent(buffer)) return false;

	if (buffer.startsWith(X11_EVENT_PREFIX)) {
		return buffer.length < X11_EVENT_PREFIX.length + 3;
	}

	if (buffer.startsWith(SGR_EVENT_PREFIX)) {
		// SGR sequences end with 'm' or 'M'
		return !/[mM]/.test(buffer) && buffer.length < 50;
	}

	// It's a prefix of the prefix (e.g. just ESC or ESC [)
	return true;
}
