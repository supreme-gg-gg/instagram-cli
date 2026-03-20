/* eslint-disable @typescript-eslint/no-unsafe-call */

import test from 'ava';
import {truncateText, graphemeLength} from '../source/utils/text-utils.js';

// ── graphemeLength ────────────────────────────────────────────────────────────

test('graphemeLength: ASCII string', t => {
	t.is(graphemeLength('hello'), 5);
});

test('graphemeLength: emoji counts as one grapheme', t => {
	t.is(graphemeLength('😀'), 1);
	t.is(graphemeLength('😀😀'), 2);
});

test('graphemeLength: Arabic text with diacritics', t => {
	// Each Arabic letter with combining marks is one grapheme cluster
	const arabic = 'مرحبا'; // 5 base letters
	t.is(graphemeLength(arabic), 5);
});

test('graphemeLength: Hindi (Devanagari) conjunct clusters', t => {
	// 'क्ष' is two codepoints but one grapheme cluster (consonant + virama)
	t.is(graphemeLength('क्ष'), 1);
});

// ── truncateText ──────────────────────────────────────────────────────────────

test('truncateText: short string is returned unchanged', t => {
	t.is(truncateText('hello', 10), 'hello');
});

test('truncateText: string at exact limit is returned unchanged', t => {
	t.is(truncateText('hello', 5), 'hello');
});

test('truncateText: ASCII string over limit is truncated with suffix', t => {
	t.is(truncateText('hello world', 5), 'hello...');
});

test('truncateText: custom suffix', t => {
	t.is(truncateText('hello world', 5, '…'), 'hello…');
});

test('truncateText: empty suffix', t => {
	t.is(truncateText('hello world', 5, ''), 'hello');
});

test('truncateText: emoji does not get split', t => {
	// '😀😀😀' — 3 graphemes, limit 2 → keep 2 emoji, not split a codepoint
	t.is(truncateText('😀😀😀', 2), '😀😀...');
});

test('truncateText: Arabic text does not corrupt combining marks', t => {
	const arabic = 'مرحبا بالعالم'; // "Hello world" in Arabic
	const result = truncateText(arabic, 5);

	// Result must end with suffix and have exactly 5 graphemes before it
	t.true(result.endsWith('...'));
	t.is(graphemeLength(result.slice(0, -3)), 5);
});

test('truncateText: Vietnamese combining diacritics are preserved', t => {
	// 'Xin chào' — 'à' in 'chào' is a base letter + combining grave + combining tone
	const vietnamese = 'Xin chào thế giới';
	const result = truncateText(vietnamese, 8);

	t.true(result.endsWith('...'));
	// No broken characters — each cluster boundary is respected
	t.is(graphemeLength(result.slice(0, -3)), 8);
});
