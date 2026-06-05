import {type InstagramClient} from '../client.js';
import {type Message} from '../types/instagram.js';

type MessageFetcher = Pick<InstagramClient, 'getMessages'>;

export async function collectReadMessages(
	client: MessageFetcher,
	threadId: string,
	limit: number,
	cursor?: string,
	maxPages = 10,
): Promise<{messages: Message[]; cursor: string | undefined}> {
	if (limit <= 0) {
		return {messages: [], cursor};
	}

	const collected: Message[] = [];
	let nextCursor = cursor;
	let hasMore = false;
	let pages = 0;

	do {
		// eslint-disable-next-line no-await-in-loop
		const result = await client.getMessages(threadId, nextCursor);
		collected.unshift(...result.messages);
		nextCursor = result.cursor;
		hasMore = nextCursor !== undefined;
		pages++;
	} while (collected.length < limit && nextCursor && pages < maxPages);

	const messages = collected.slice(-limit);
	const oldestDisplayed = messages[0];

	return {
		messages,
		cursor:
			oldestDisplayed && (hasMore || collected.length > messages.length)
				? oldestDisplayed.id
				: undefined,
	};
}
