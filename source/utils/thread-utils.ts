import type {Thread, Message} from '../types/instagram.js';

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
