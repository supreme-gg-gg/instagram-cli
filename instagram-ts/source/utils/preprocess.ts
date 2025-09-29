import fs from 'node:fs/promises';
import path from 'node:path';
import type {InstagramClient} from '../client.js';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif']);
// A list of common text file extensions
const TEXT_EXTENSIONS = new Set([
	'.txt',
	'.md',
	'.js',
	'.ts',
	'.tsx',
	'.json',
	'.html',
	'.css',
	'.py',
	'.sh',
	'.yaml',
	'.yml',
	'.log',
]);

type PreprocessContext = {
	readonly client: InstagramClient;
	readonly threadId: string;
};

/**
 * Preprocesses a message to handle special syntax for file embedding and emojis.
 * @param text The raw message text.
 * @param context The context containing the client and thread ID.
 * @returns The processed message text to be sent.
 */
export async function preprocessMessage(
	text: string,
	context: PreprocessContext,
): Promise<string> {
	let processedText = text;
	const textContents: string[] = [];

	// 1. Emoji Handling: Replace :emoji_name: with a placeholder
	// eslint-disable-next-line unicorn/prefer-string-replace-all
	processedText = processedText.replace(/:(\w+):/g, '✨');

	// 2. File Path Handling: Find @<path.ext> patterns
	const filePathRegex = /@(\S+\.\w+)/g;
	const matches = [...processedText.matchAll(filePathRegex)];

	for (const match of matches) {
		const filePath = match[1];
		if (!filePath) continue;

		const absolutePath = path.resolve(filePath);
		const extension = path.extname(absolutePath).toLowerCase();

		if (IMAGE_EXTENSIONS.has(extension)) {
			// It's an image, upload it and remove the tag from the text
			try {
				// eslint-disable-next-line no-await-in-loop
				await context.client.sendPhoto(context.threadId, absolutePath);
				processedText = processedText.replace(match[0], ''); // Remove the @<path> part
			} catch {
				// If upload fails, leave the @<path> in the message as-is for the user to see the error.
			}
		} else if (TEXT_EXTENSIONS.has(extension)) {
			// It's a text file. Read it and queue its content for appending.
			// The @<path> tag will be preserved in the main message body.
			try {
				// eslint-disable-next-line no-await-in-loop
				const content = await fs.readFile(absolutePath, 'utf8');

				// Simple check for binary content by looking for the null character.
				if (content.includes('\u0000')) {
					// This is likely a binary file, so we do nothing.
					continue;
				}

				const formattedContent = `\n--- ${path.basename(
					absolutePath,
				)} ---\n${content}`;
				textContents.push(formattedContent);
			} catch {
				// If read fails (e.g., not valid utf8), do nothing. The tag will remain in the message.
			}
		}
	}

	// 3. Append all collected text file contents at the very end
	if (textContents.length > 0) {
		processedText += textContents.join('');
	}

	return processedText.trim();
}
