import fs from 'node:fs/promises';
import path from 'node:path';
import {fileTypeFromFile} from 'file-type';
import type {InstagramClient} from '../client.js';

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

	// 0. Handle escaped colons '::' to single ':'
	if (processedText.startsWith('::')) {
		processedText = processedText.slice(1);
	}

	// 1. Emoji Handling: Replace :emoji_name: with a placeholder
	// eslint-disable-next-line unicorn/prefer-string-replace-all
	processedText = processedText.replace(/:(\w+):/g, '🧂');

	// 2. File Path Handling: Find #<path.ext> patterns
	const filePathRegex = /#(\S+\.\w+)/g;
	const matches = [...processedText.matchAll(filePathRegex)];

	for (const match of matches) {
		const filePath = match[1];
		if (!filePath) continue;

		const absolutePath = path.resolve(filePath);

		try {
			// eslint-disable-next-line no-await-in-loop
			const fileType = await fileTypeFromFile(absolutePath);

			if (fileType?.mime.startsWith('image/')) {
				// It's an image, upload it and remove the tag from the text
				// eslint-disable-next-line no-await-in-loop
				await context.client.sendPhoto(context.threadId, absolutePath);
				processedText = processedText.replace(match[0], ''); // Remove the @<path> part
			} else {
				// Assume it could be a text file if not identified as a known binary type that isn't an image.
				// We'll read it and check for binary content.
				// eslint-disable-next-line no-await-in-loop
				const content = await fs.readFile(absolutePath, 'utf8');

				// Simple check for binary content by looking for the null character.
				if (content.includes('\u0000')) {
					// This is likely a binary file we don't handle, so do nothing.
					continue;
				}

				// It's a text file. Queue its content for appending.
				// The @<path> tag will be preserved in the main message body.
				const formattedContent = `\n--- ${path.basename(
					absolutePath,
				)} ---\n${content}`;
				textContents.push(formattedContent);
			}
		} catch {
			// If any file operation fails (e.g., file not found, permission denied),
			// leave the @<path> in the message as-is for the user to see the error.
		}
	}

	// 3. Append all collected text file contents at the very end
	if (textContents.length > 0) {
		processedText += textContents.join('');
	}

	return processedText.trim();
}
