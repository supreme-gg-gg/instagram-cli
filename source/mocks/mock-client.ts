import {EventEmitter} from 'node:events';
import type {InstagramClient, LoginResult, RealtimeStatus} from '../client.js';
import type {
	Thread,
	Message,
	User,
	Story,
	StoryReel,
} from '../types/instagram.js';
import {createContextualLogger} from '../utils/logger.js';
import {mockMessages, generateThreads, mockStories} from './mock-data.js';

const logger = createContextualLogger('MockClient');

// eslint-disable-next-line unicorn/prefer-event-target
class MockClient extends EventEmitter {
	// Static cleanup methods
	static async cleanupSessions(): Promise<void> {
		logger.info('Mock: Sessions cleaned up');
	}

	static async cleanupCache(): Promise<void> {
		logger.info('Mock: Cache cleaned up');
	}

	private readonly threads: Thread[] = generateThreads(50);
	private threadsPage = 0;
	private readonly sentMessages: Message[] = [];

	private readonly sentReactions = new Map<
		string,
		Array<{emoji: string; senderId: string}>
	>();

	private get realtimeStatus(): RealtimeStatus {
		return 'disconnected';
	}

	async getThreads(
		loadMore = false,
	): Promise<{threads: Thread[]; hasMore: boolean}> {
		// Simulate network delay
		await new Promise(resolve => {
			setTimeout(resolve, 1000);
		});
		const threads_per_page = 20;
		if (!loadMore) {
			this.threadsPage = 0;
		}

		const threads = this.threads.slice(
			this.threadsPage * threads_per_page,
			(this.threadsPage + 1) * threads_per_page,
		);
		const hasMore =
			(this.threadsPage + 1) * threads_per_page < this.threads.length;
		this.threadsPage += 1;
		return {threads, hasMore};
	}

	async getMessages(
		// @ts-expect-error: cursor is not used in mock
		threadId: string,
		_cursor?: string,
	): Promise<{
		messages: Message[];
		cursor: string | undefined;
	}> {
		// Filter messages for the specific thread
		const threadMessages = [
			// ...mockMessages.filter(message => message.threadId === threadId),
			// ...this.sentMessages.filter(message => message.threadId === threadId),
			...mockMessages,
			...this.sentMessages,
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

		logger.info(
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
		logger.info(`Mock: Unsent message ${messageId} from thread ${threadId}`);
	}

	async markThreadAsSeen(threadId: string): Promise<void> {
		// Simulate marking a thread as seen
		await new Promise(resolve => {
			setTimeout(resolve, 50);
		});
		logger.info(`Mock: Marked thread ${threadId} as seen`);
	}

	async markItemAsSeen(threadId: string, itemId: string): Promise<void> {
		// Simulate marking a message as seen
		await new Promise(resolve => {
			setTimeout(resolve, 50);
		});
		logger.info(`Mock: Marked item ${itemId} as seen in thread ${threadId}`);
	}

	async getCurrentUser(): Promise<User | undefined> {
		return {
			pk: 'current_user_id',
			username: 'mock_user',
			fullName: 'Mock User',
			profilePicUrl: 'https://via.placeholder.com/150',
			isVerified: false,
		};
	}

	async getReelsTray(): Promise<StoryReel[]> {
		// Simulate network delay
		await new Promise(resolve => {
			setTimeout(resolve, 100);
		});

		const usersWithStories = new Map<number, User>();
		for (const story of mockStories) {
			if (story.user && !usersWithStories.has(story.user.pk)) {
				usersWithStories.set(story.user.pk, story.user as unknown as User);
			}
		}

		return [...usersWithStories.values()].map(user => ({
			user: {
				...user,
				pk: typeof user.pk === 'string' ? Number(user.pk) : user.pk,
			},
			stories: [],
		}));
	}

	async getStoriesForUser(
		userId?: number | string,
		username?: string,
	): Promise<Story[]> {
		// Find all stories for the given user
		let userStories: Story[] = [];
		if (username) {
			userStories = mockStories.filter(story => {
				return story.user?.username === username;
			});
		} else if (userId) {
			logger.info(`Mock: Getting stories for user ${userId}`);
			const userIdNum = typeof userId === 'string' ? Number(userId) : userId;
			userStories = mockStories.filter(story => {
				return story.user?.pk === userIdNum;
			});
		}

		// Simulate network delay
		await new Promise(resolve => {
			setTimeout(resolve, 50);
		});

		return userStories;
	}

	async markStoriesAsSeen(stories: Story[]): Promise<void> {
		// Simulate marking stories as seen
		await new Promise(resolve => {
			setTimeout(resolve, 50);
		});
		const username = stories[0]?.user?.username;
		if (username) {
			logger.info(
				`Mock: Marked ${stories.length} stories as seen for user ${username}`,
			);
		}
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
		logger.info('Mock: Challenge started');
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
		logger.info('Mock: Logged out');
	}

	async shutdown(): Promise<void> {
		logger.info('Mock: Client shutdown');
	}

	async switchUser(username: string): Promise<void> {
		await new Promise(resolve => {
			setTimeout(resolve, 100);
		});
		logger.info(`Mock: Switched to user ${username}`);
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
