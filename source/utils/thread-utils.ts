import type {Thread, Message} from '../types/instagram.js';

export type UpdateThreadByMessageOptions = {
	/**
	 * 스레드를 읽지 않음(unread) 상태로 표시할지 여부
	 * @default thread의 기존 unread 상태 유지
	 */
	readonly markAsUnread?: boolean;
};

/**
 * 메시지를 기준으로 스레드를 업데이트하고 목록 맨 위로 이동시킵니다.
 *
 * @param threads - 현재 스레드 목록
 * @param message - 새 메시지
 * @param options - 업데이트 옵션
 * @returns 업데이트된 스레드 목록 (스레드를 찾지 못하면 원본 반환)
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
		// 스레드를 찾지 못하면 원본 반환 (불변성 유지)
		return threads;
	}

	const updatedThreads = [...threads];
	const threadToUpdate = updatedThreads[threadIndex]!;

	// 스레드 업데이트: 마지막 활동, 마지막 메시지, 읽지 않음 상태
	const updatedThread: Thread = {
		...threadToUpdate,
		lastActivity: message.timestamp,
		lastMessage: message,
		unread: options?.markAsUnread ?? threadToUpdate.unread,
	};

	// 맨 위로 이동 (splice + unshift)
	updatedThreads.splice(threadIndex, 1);
	updatedThreads.unshift(updatedThread);

	return updatedThreads;
}
