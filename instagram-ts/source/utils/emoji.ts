import emojiData from 'unicode-emoji-json' with {type: 'json'};

export const emojiMap: Record<string, string> = Object.fromEntries(
	Object.entries(emojiData as Record<string, {slug: string}>).map(
		([emoji, data]) => [data.slug, emoji],
	),
);
