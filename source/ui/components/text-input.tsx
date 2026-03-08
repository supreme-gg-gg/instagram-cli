/**
 * Custom TextInput component with cursor control support.
 *
 * Drop-in replacement for `ink-text-input` with an additional `cursorOffset`
 * prop that allows setting the cursor position directly (used by InputBox's
 * internal mouse click-to-cursor handler).
 *
 * Based on ink-text-input's implementation but with cursor position control
 * and mouse escape sequence filtering.
 */
import React, {useState, useEffect} from 'react';
import {Text, useInput} from 'ink';
import chalk from 'chalk';

type TextInputProperties = {
	/** Current text value (controlled). */
	readonly value: string;
	/** Called when the text value changes. */
	readonly onChange: (value: string) => void;
	/** Called when Enter is pressed. */
	readonly onSubmit?: (value: string) => void;
	/** Text shown when value is empty. */
	readonly placeholder?: string;
	/** Whether this input is focused and accepting input. */
	readonly focus?: boolean;
	/** Whether to show the cursor. */
	readonly showCursor?: boolean;
	/**
	 * External cursor offset. When set, overrides the internal cursor position.
	 * Uses a timestamp to distinguish repeated sets to the same offset.
	 */
	readonly cursorOffset?: {offset: number; timestamp: number};
};

export default function TextInput({
	value: originalValue,
	onChange,
	onSubmit,
	placeholder = '',
	focus = true,
	showCursor = true,
	cursorOffset: externalCursorOffset,
}: TextInputProperties) {
	const [internalCursorOffset, setInternalCursorOffset] = useState(
		originalValue.length,
	);

	// Apply external cursor offset when provided
	useEffect(() => {
		if (externalCursorOffset !== undefined) {
			const clamped = Math.max(
				0,
				Math.min(externalCursorOffset.offset, originalValue.length),
			);
			setInternalCursorOffset(clamped);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [externalCursorOffset]);

	// Keep cursor in bounds when value shrinks
	useEffect(() => {
		setInternalCursorOffset(previous => {
			if (!focus || !showCursor) return previous;
			if (previous > originalValue.length) {
				return originalValue.length;
			}

			return previous;
		});
	}, [originalValue, focus, showCursor]);

	// Regex to detect mouse escape sequences that Ink's input pipeline delivers
	// to useInput with the leading ESC already stripped.
	// SGR format: [<button;col;row[mM]   X11 format: [M + 3 raw bytes

	const MOUSE_INPUT_RE = /^\[(<\d+;\d+;\d+[Mm]|M[\s\S]{3})/;

	useInput(
		(input, key) => {
			if (
				key.upArrow ||
				key.downArrow ||
				(key.ctrl && input === 'c') ||
				key.tab ||
				(key.shift && key.tab)
			) {
				return;
			}

			if (key.return) {
				onSubmit?.(originalValue);
				return;
			}

			// Discard mouse escape sequences that leak through Ink's input pipeline
			if (MOUSE_INPUT_RE.test(input)) {
				return;
			}

			let nextCursorOffset = internalCursorOffset;
			let nextValue = originalValue;

			if (key.leftArrow) {
				if (showCursor) {
					nextCursorOffset = Math.max(0, nextCursorOffset - 1);
				}
			} else if (key.rightArrow) {
				if (showCursor) {
					nextCursorOffset = Math.min(
						originalValue.length,
						nextCursorOffset + 1,
					);
				}
			} else if (key.backspace || key.delete) {
				if (internalCursorOffset > 0) {
					nextValue =
						originalValue.slice(0, internalCursorOffset - 1) +
						originalValue.slice(internalCursorOffset);
					nextCursorOffset = internalCursorOffset - 1;
				}
			} else {
				nextValue =
					originalValue.slice(0, internalCursorOffset) +
					input +
					originalValue.slice(internalCursorOffset);
				nextCursorOffset = internalCursorOffset + input.length;
			}

			// Clamp
			if (nextCursorOffset < 0) nextCursorOffset = 0;
			if (nextCursorOffset > nextValue.length)
				nextCursorOffset = nextValue.length;

			setInternalCursorOffset(nextCursorOffset);

			if (nextValue !== originalValue) {
				onChange(nextValue);
			}
		},
		{isActive: focus},
	);

	// ── Rendering ──────────────────────────────────────────────────────────

	const value = originalValue;
	let renderedValue = value;
	let renderedPlaceholder: string | undefined = placeholder
		? chalk.grey(placeholder)
		: undefined;

	if (showCursor && focus) {
		renderedPlaceholder =
			placeholder.length > 0
				? chalk.inverse(placeholder[0]) + chalk.grey(placeholder.slice(1))
				: chalk.inverse(' ');

		renderedValue = value.length > 0 ? '' : chalk.inverse(' ');

		let i = 0;
		for (const char of value) {
			renderedValue += i === internalCursorOffset ? chalk.inverse(char) : char;
			i++;
		}

		if (value.length > 0 && internalCursorOffset === value.length) {
			renderedValue += chalk.inverse(' ');
		}
	}

	return (
		<Text>
			{placeholder
				? value.length > 0
					? renderedValue
					: renderedPlaceholder
				: renderedValue}
		</Text>
	);
}
