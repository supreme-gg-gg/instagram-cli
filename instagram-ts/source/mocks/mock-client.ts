import type {InstagramClient, LoginResult} from '../client.js';
import type {Thread, Message} from '../types/instagram.js';
import {
	mockThreads,
	mockMessages,
	generateThread,
	mockUsers,
} from './mock-data.js';

class MockClient {
	private readonly sentMessages: Message[] = [];

	async getThreads(): Promise<Thread[]> {
		// Add some variety with generated threads
		const generatedThreads = [
			generateThread('thread4', 'John Doe', [mockUsers[0]!], true, 1),
			generateThread('thread5', 'Sarah Wilson', [mockUsers[1]!], false, 3),
			generateThread('thread6', 'Mike Chen', [mockUsers[2]!], true, 6),
			generateThread('thread7', 'Lisa Garcia', [mockUsers[3]!], false, 12),
		];

		return [...mockThreads, ...generatedThreads];
	}

	async getMessages(
		threadId: string,
		_cursor?: string,
	): Promise<{
		messages: Message[];
		cursor: string | undefined;
	}> {
		// Filter messages for the specific thread
		const threadMessages = [
			...mockMessages.filter(message => message.threadId === threadId),
			...this.sentMessages.filter(message => message.threadId === threadId),
		].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

		return {
			messages: threadMessages,
			cursor: undefined, // No pagination for mocks
		};
	}

	async sendMessage(threadId: string, text: string): Promise<void> {
		// Simulate sending a message
		const newMessage: Message = {
			id: `sent_${Date.now()}`,
			timestamp: new Date(),
			userId: 'current_user',
			username: 'current_user',
			isOutgoing: true,
			threadId,
			itemType: 'text',
			text,
		};

		this.sentMessages.push(newMessage);

		// Simulate network delay
		await new Promise(resolve => {
			setTimeout(resolve, 100);
		});
	}

	async loginBySession(): Promise<LoginResult> {
		return {success: true};
	}

	getUsername(): string | undefined {
		return 'mock_user';
	}
}

// Type assertion to match InstagramClient interface
export const mockClient = new MockClient() as unknown as InstagramClient;
