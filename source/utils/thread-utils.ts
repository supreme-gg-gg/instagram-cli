import type {Thread, Message} from '../types/instagram.js';

/**
 * Returns a short, human-readable preview of a message's content,
 * suitable for thread list previews and notifications.
 */
export function getMessagePreviewText(message: Message): string {
	switch (message.itemType) {
		case 'text': {
			return message.text;
		}

		case 'media': {
			return '[Media]';
		}

		case 'media_share': {
			return `[Shared post by @${message.mediaSharePost.user.username}]`;
		}

		case 'link': {
			return message.link.text;
		}

		case 'placeholder': {
			return message.text;
		}

		default: {
			return '[Unsupported Message]';
		}
	}
}

export type UpdateThreadByMessageOptions = {
	/**
	 * Whether to mark the thread as unread
	 * @default preserve the thread's existing unread state
	 */
	readonly markAsUnread?: boolean;
};

/**
 * Updates a thread based on a message and moves it to the top of the list.
 *
 * @param threads - Current thread list
 * @param message - New message
 * @param options - Update options
 * @returns Updated thread list (returns original if thread not found)
 *
 * @example
 * ```typescript
 * const updatedThreads = updateThreadByMessage(threads, message, {
 *   markAsUnread: true
 * });
 * ```
 */
export function updateThreadByMessage(
	threads: Thread[],
	message: Message,
	options?: UpdateThreadByMessageOptions,
): Thread[] {
	const threadIndex = threads.findIndex(
		thread => thread.id === message.threadId,
	);

	if (threadIndex === -1) {
		// Return original if thread not found (preserve immutability)
		return threads;
	}

	const updatedThreads = [...threads];
	const threadToUpdate = updatedThreads[threadIndex]!;

	// Update thread: last activity, last message, unread status
	const updatedThread: Thread = {
		...threadToUpdate,
		lastActivity: message.timestamp,
		lastMessage: message,
		unread: options?.markAsUnread ?? threadToUpdate.unread,
	};

	// Move to top (splice + unshift)
	updatedThreads.splice(threadIndex, 1);
	updatedThreads.unshift(updatedThread);

	return updatedThreads;
}

export type MessagePage = {
	messages: Message[];
	cursor: string | undefined;
};

/**
 * Collects the `limit` most recent messages for the `read` command, starting
 * at `cursor`. Older pages are fetched until the limit is met or the thread
 * runs out. Messages are returned oldest first.
 *
 * When some fetched messages are not returned, the cursor points at the oldest
 * returned message, so passing it back continues right after the last message
 * the user saw instead of skipping the rest of the page.
 */
export async function collectReadMessages(
	fetchPage: (cursor?: string) => Promise<MessagePage>,
	limit: number,
	cursor?: string,
): Promise<MessagePage> {
	if (limit <= 0) return {messages: [], cursor};

	let collected: Message[] = [];
	let nextCursor = cursor;

	do {
		// eslint-disable-next-line no-await-in-loop
		const page = await fetchPage(nextCursor);
		collected = [...page.messages, ...collected];
		nextCursor = page.cursor;
		if (page.messages.length === 0) break;
	} while (collected.length < limit && nextCursor);

	if (collected.length > limit) {
		const messages = collected.slice(-limit);
		return {messages, cursor: messages[0]!.id};
	}

	return {messages: collected, cursor: nextCursor};
}
