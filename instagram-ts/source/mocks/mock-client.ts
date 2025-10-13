import {EventEmitter} from 'node:events';
import type {InstagramClient, LoginResult, RealtimeStatus} from '../client.js';
import type {Thread, Message, User} from '../types/instagram.js';
import {
	mockThreads,
	mockMessages,
	generateThread,
	mockUsers,
} from './mock-data.js';

// eslint-disable-next-line unicorn/prefer-event-target
class MockClient extends EventEmitter {
	// Static cleanup methods
	static async cleanupSessions(): Promise<void> {
		console.log('Mock: Sessions cleaned up');
	}

	static async cleanupCache(): Promise<void> {
		console.log('Mock: Cache cleaned up');
	}

	private readonly sentMessages: Message[] = [];

	private readonly sentReactions = new Map<
		string,
		Array<{emoji: string; senderId: string}>
	>();

	private get realtimeStatus(): RealtimeStatus {
		return 'disconnected';
	}

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

		// Add mock reactions to messages
		const messagesWithReactions = threadMessages.map(message => {
			const additionalReactions = this.sentReactions.get(message.id);
			if (additionalReactions) {
				return {
					...message,
					reactions: [...(message.reactions ?? []), ...additionalReactions],
				};
			}

			return message;
		});

		return {
			messages: messagesWithReactions,
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

		// Emit the message event to simulate realtime
		this.emit('message', newMessage);
	}

	async sendReaction(
		threadId: string,
		itemId: string,
		emoji: string,
	): Promise<void> {
		// Simulate sending a reaction
		const reaction = {
			emoji,
			senderId: 'current_user',
		};

		const existingReactions = this.sentReactions.get(itemId) ?? [];
		this.sentReactions.set(itemId, [...existingReactions, reaction]);

		// Simulate network delay
		await new Promise(resolve => {
			setTimeout(resolve, 50);
		});

		console.log(
			`Mock: Added reaction ${emoji} to message ${itemId} in thread ${threadId}`,
		);
	}

	async sendReply(
		threadId: string,
		text: string,
		replyToMessage: Message,
	): Promise<void> {
		// Simulate sending a reply
		const newMessage: Message = {
			id: `reply_${Date.now()}`,
			timestamp: new Date(),
			userId: 'current_user',
			username: 'current_user',
			isOutgoing: true,
			threadId,
			itemType: 'text',
			text,
			repliedTo: {
				id: replyToMessage.id,
				userId: replyToMessage.userId,
				username: replyToMessage.username,
				text:
					replyToMessage.itemType === 'text'
						? replyToMessage.text
						: replyToMessage.itemType === 'link'
							? replyToMessage.link.text
							: replyToMessage.itemType === 'media'
								? '[Media]'
								: '[Unsupported Media]',
				itemType: replyToMessage.itemType,
			},
		};

		this.sentMessages.push(newMessage);
		await new Promise(resolve => {
			setTimeout(resolve, 150);
		});
		this.emit('message', newMessage);
	}

	async sendPhoto(threadId: string, filePath: string): Promise<void> {
		// Simulate sending a photo
		const newMessage: Message = {
			id: `photo_${Date.now()}`,
			timestamp: new Date(),
			userId: 'current_user',
			username: 'current_user',
			isOutgoing: true,
			threadId,
			itemType: 'media',
			media: {
				id: `media_${Date.now()}`,
				media_type: 1, // Image
				image_versions2: {
					candidates: [
						{
							url: filePath,
							width: 1080,
							height: 1080,
						},
					],
				},
				original_width: 1080,
				original_height: 1080,
			},
		};

		this.sentMessages.push(newMessage);
		await new Promise(resolve => {
			setTimeout(resolve, 200);
		});
		this.emit('message', newMessage);
	}

	async sendVideo(threadId: string, filePath: string): Promise<void> {
		// Simulate sending a video
		const newMessage: Message = {
			id: `video_${Date.now()}`,
			timestamp: new Date(),
			userId: 'current_user',
			username: 'current_user',
			isOutgoing: true,
			threadId,
			itemType: 'media',
			media: {
				id: `media_${Date.now()}`,
				media_type: 2, // Video
				video_versions: [
					{
						url: filePath,
						width: 1080,
						height: 1920,
					},
				],
				original_width: 1080,
				original_height: 1920,
			},
		};

		this.sentMessages.push(newMessage);
		await new Promise(resolve => {
			setTimeout(resolve, 300);
		});
		this.emit('message', newMessage);
	}

	async unsendMessage(threadId: string, messageId: string): Promise<void> {
		// Remove from sent messages
		const messageIndex = this.sentMessages.findIndex(
			msg => msg.id === messageId,
		);
		if (messageIndex !== -1) {
			this.sentMessages.splice(messageIndex, 1);
		}

		// Remove any reactions for this message
		this.sentReactions.delete(messageId);

		await new Promise(resolve => {
			setTimeout(resolve, 100);
		});
		console.log(`Mock: Unsent message ${messageId} from thread ${threadId}`);
	}

	async getCurrentUser(): Promise<User | undefined> {
		return {
			pk: 'current_user',
			username: 'mock_user',
			fullName: 'Mock User',
			profilePicUrl: 'https://via.placeholder.com/150',
			isVerified: false,
		};
	}

	// Login methods
	async login(
		username: string,
		_password: string,
		_options?: {initializeRealtime: boolean},
	): Promise<LoginResult> {
		await new Promise(resolve => {
			setTimeout(resolve, 500);
		}); // Simulate login delay
		return {success: true, username};
	}

	async twoFactorLogin(_options: {
		verificationCode: string;
		twoFactorIdentifier: string;
		totp_two_factor_on: boolean;
	}): Promise<LoginResult> {
		await new Promise(resolve => {
			setTimeout(resolve, 300);
		});
		return {success: true, username: 'mock_user'};
	}

	async startChallenge(): Promise<void> {
		await new Promise(resolve => {
			setTimeout(resolve, 200);
		});
		console.log('Mock: Challenge started');
	}

	async sendChallengeCode(_code: string): Promise<LoginResult> {
		await new Promise(resolve => {
			setTimeout(resolve, 300);
		});
		return {success: true, username: 'mock_user'};
	}

	async loginBySession(_options?: {
		initializeRealtime: boolean;
	}): Promise<LoginResult> {
		// Simulate checking existing session
		await new Promise(resolve => {
			setTimeout(resolve, 200);
		});
		return {success: true, username: 'mock_user'};
	}

	async logout(_usernameToLogout?: string): Promise<void> {
		await new Promise(resolve => {
			setTimeout(resolve, 100);
		});
		console.log('Mock: Logged out');
	}

	async shutdown(): Promise<void> {
		console.log('Mock: Client shutdown');
	}

	async switchUser(username: string): Promise<void> {
		await new Promise(resolve => {
			setTimeout(resolve, 100);
		});
		console.log(`Mock: Switched to user ${username}`);
	}

	getUsername(): string | undefined {
		return 'mock_user';
	}

	getRealtimeStatus(): RealtimeStatus {
		return this.realtimeStatus;
	}
}

// Type assertion to match InstagramClient interface
export const mockClient = new MockClient() as unknown as InstagramClient;
