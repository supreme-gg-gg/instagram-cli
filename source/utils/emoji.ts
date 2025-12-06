import emojiData from 'unicode-emoji-json/data-by-emoji.json' with {type: 'json'};
import EmojiNameMap from 'emoji-name-map';
import Fuse from 'fuse.js';

const {emoji: emojiAliases} = EmojiNameMap;

type EmojiEntry = {
	name: string;
	emoji: string;
};

const emojiAliasesEntries = Object.entries(emojiAliases).map(
	([name, emoji]) => ({
		name: name.replaceAll('-', '_'),
		emoji,
	}),
);

const emojiNamesEntries = Object.entries(
	emojiData as Record<string, {slug: string}>,
).map(([emoji, data]) => ({name: data.slug.replaceAll('-', '_'), emoji}));

const emojiEntries: EmojiEntry[] = [
	...emojiAliasesEntries,
	...emojiNamesEntries,
];

type Options = {
	exact?: boolean;
	threshold?: number;
};

const defaultOptions: Options = {
	exact: false,
	threshold: 0.3,
};

export function getEmojiByName(
	name: string,
	options: Options = defaultOptions,
): string | undefined {
	const {exact = false, threshold = 0.3} = options;
	const fuse = new Fuse(emojiEntries, {
		keys: ['name'],
		threshold: exact ? 0 : threshold,
	});

	const result = fuse.search(name);
	if (!result || result.length === 0 || !result[0]?.item) {
		return undefined;
	}

	return result[0].item.emoji;
}
