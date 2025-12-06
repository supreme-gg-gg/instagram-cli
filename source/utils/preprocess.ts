import fs from 'node:fs/promises';
import path from 'node:path';
import {fileTypeFromFile} from 'file-type';
import type {InstagramClient} from '../client.js';
import {resolveUserPath} from './path-utils.js';
import {getEmojiByName} from './emoji.js';
import {createContextualLogger} from './logger.js';

const logger = createContextualLogger('preprocessMessage');

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

	// 1. Emoji Handling: Replace :emoji_name: with actual emojis
	// eslint-disable-next-line unicorn/prefer-string-replace-all
	processedText = processedText.replace(/:(\w+):/g, (_, emojiName: string) => {
		return getEmojiByName(emojiName) ?? `:${emojiName}:`;
	});

	// 2. File Path Handling: Find #<path> patterns with file indicators
	const filePathRegex = /#([^\s#]*[./~][^\s#]*)/g;
	const matches = [...processedText.matchAll(filePathRegex)];

	for (const match of matches) {
		const rawFilePath = match[1];
		if (!rawFilePath) continue;

		const filePath = rawFilePath
			.replace(/^["'(<]+/, '')
			.replace(/[)"'>.,!?]*$/, '');
		if (filePath.length === 0) continue;

		const absolutePath = resolveUserPath(filePath);

		try {
			// eslint-disable-next-line no-await-in-loop
			const fileType = await fileTypeFromFile(absolutePath);
			logger.debug(
				`Processing file: ${absolutePath}, type: ${fileType?.mime ?? 'text'}`,
			);

			if (fileType?.mime.startsWith('image/')) {
				// It's an image, upload it and remove the tag from the text
				// eslint-disable-next-line no-await-in-loop
				await context.client.sendPhoto(context.threadId, absolutePath);
				logger.info(`Uploaded image: ${path.basename(absolutePath)}`);
				processedText = processedText.replace(match[0], ''); // Remove the #<path> part
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
				logger.info(`Embedded text file: ${path.basename(absolutePath)}`);
			}
		} catch (error) {
			// If any file operation fails (e.g., file not found, permission denied),
			// leave the @<path> in the message as-is for the user to see the error.
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			logger.warn(`Failed to process file ${absolutePath}: ${errorMessage}`);
		}
	}

	// 3. Append all collected text file contents at the very end
	if (textContents.length > 0) {
		processedText += textContents.join('');
	}

	return processedText.trim();
}
