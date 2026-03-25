import path from 'node:path';
import React, {useCallback} from 'react';
import zod from 'zod';
import {argument, option} from 'pastel';
import {
	OneTurnCommand,
	outputJson,
	jsonSuccess,
	outputText,
	resolveRecipient,
} from '../utils/one-turn.js';
import {type InstagramClient} from '../client.js';

export const description = 'Send a text message, photo, or video to a user';

const PHOTO_EXTENSIONS = new Set([
	'.jpg',
	'.jpeg',
	'.png',
	'.gif',
	'.webp',
	'.heic',
]);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv']);

function detectMediaType(filePath: string): 'photo' | 'video' {
	const ext = path.extname(filePath).toLowerCase();
	if (PHOTO_EXTENSIONS.has(ext)) return 'photo';
	if (VIDEO_EXTENSIONS.has(ext)) return 'video';
	throw new Error(
		`Cannot detect media type for extension "${ext}". Use --type photo|video to override.`,
	);
}

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'recipient',
			description: 'Username of the recipient',
		}),
	),
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'message',
				description: 'Message text to send (omit when using --file)',
			}),
		),
]);

export const options = zod.object({
	username: zod
		.string()
		.optional()
		.describe(
			option({
				alias: 'u',
				description: 'Account username to use',
			}),
		),
	output: zod
		.string()
		.optional()
		.describe(
			option({
				alias: 'o',
				description: 'Output format (json)',
			}),
		),
	file: zod
		.string()
		.optional()
		.describe(
			option({
				description: 'Path to a media file to send (photo or video)',
			}),
		),
	type: zod
		.enum(['photo', 'video'])
		.optional()
		.describe(
			option({
				description:
					'Media type override (photo|video); auto-detected if omitted',
			}),
		),
});

type Properties = {
	readonly args: zod.infer<typeof args>;
	readonly options: zod.infer<typeof options>;
};

export default function Send({args: commandArgs, options}: Properties) {
	const run = useCallback(
		async (client: InstagramClient) => {
			const [recipient, message] = commandArgs;
			const isJson = options.output === 'json';

			const {threadId} = await resolveRecipient(client, recipient);

			if (options.file) {
				const mediaType = options.type ?? detectMediaType(options.file);
				const messageId =
					mediaType === 'photo'
						? await client.sendPhoto(threadId, options.file)
						: await client.sendVideo(threadId, options.file);

				if (isJson) {
					outputJson(
						jsonSuccess({
							threadId,
							recipient,
							messageId,
							file: options.file,
							mediaType,
							sent: true,
						}),
					);
				} else {
					const label = mediaType === 'photo' ? 'Photo' : 'Video';
					outputText(`${label} sent to @${recipient}`);
				}

				return;
			}

			if (!message) {
				throw new Error(
					'A message is required when not using --file. Usage: send <recipient> <message>',
				);
			}

			const messageId = await client.sendMessage(threadId, message);

			if (isJson) {
				outputJson(jsonSuccess({threadId, recipient, messageId, sent: true}));
			} else {
				outputText(`Message sent to @${recipient}`);
			}
		},
		[commandArgs, options],
	);

	return (
		<OneTurnCommand
			username={options.username}
			output={options.output}
			run={run}
		/>
	);
}
