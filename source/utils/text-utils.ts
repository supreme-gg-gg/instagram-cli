const segmenter = new Intl.Segmenter();

/**
 * Returns the number of grapheme clusters in a string.
 *
 * Unlike `String.prototype.length`, which counts UTF-16 code units, this
 * correctly handles multi-codepoint characters (emoji, Arabic, Hindi,
 * Vietnamese combining marks, etc.).
 */
export function graphemeLength(text: string): number {
	return [...segmenter.segment(text)].length;
}

/**
 * Truncates a string to at most `maxGraphemes` grapheme clusters, appending
 * `suffix` when truncation occurs.
 *
 * Safe for all scripts: Arabic, Devanagari, Vietnamese combining characters,
 * emoji, CJK, and all other Unicode ranges.
 *
 * @param text - The string to truncate.
 * @param maxGraphemes - Maximum number of grapheme clusters to keep.
 * @param suffix - Appended when the string is truncated. Defaults to `'...'`.
 */
export function truncateText(
	text: string,
	maxGraphemes: number,
	suffix = '...',
): string {
	const iter = segmenter.segment(text)[Symbol.iterator]();
	const kept: string[] = [];

	for (let i = 0; i < maxGraphemes; i++) {
		const {value, done} = iter.next();
		if (done) return text; // at or under limit — return original
		kept.push(value.segment);
	}

	// One more peek: if exhausted we're exactly at the limit, no suffix needed
	if (iter.next().done) return text;

	return kept.join('') + suffix;
}
