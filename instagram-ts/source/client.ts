import {IgApiClient} from 'instagram-private-api';
import {SessionManager} from './session.js';
import type {Thread, Message, User} from './types/instagram.js';

export class InstagramClient {
	private ig: IgApiClient;
	private sessionManager: SessionManager | null = null;

	constructor() {
		this.ig = new IgApiClient();
	}

	async login(username: string, password: string): Promise<boolean> {
		try {
			this.sessionManager = new SessionManager(username);

			// Generate device for this username
			this.ig.state.generateDevice(username);

			// Subscribe to save state after each request
			this.ig.request.end$.subscribe(async () => {
				const serialized = await this.ig.state.serialize();
				delete serialized.constants;
				await this.sessionManager!.saveSession(serialized);
			});

			// Attempt login
			await this.ig.account.login(username, password);
			return true;
		} catch (error) {
			console.error('Login failed:', error);
			return false;
		}
	}

	async restoreSession(username: string): Promise<boolean> {
		try {
			this.sessionManager = new SessionManager(username);

			const sessionData = await this.sessionManager.loadSession();
			if (!sessionData) {
				return false;
			}

			this.ig.state.generateDevice(username);

			// Subscribe to save state after each request
			this.ig.request.end$.subscribe(async () => {
				const serialized = await this.ig.state.serialize();
				delete serialized.constants;
				await this.sessionManager!.saveSession(serialized);
			});

			await this.ig.state.deserialize(sessionData);

			// Test if the session is still valid
			await this.ig.user.info(this.ig.state.cookieUserId);
			return true;
		} catch (error) {
			console.error('Session restoration failed:', error);
			return false;
		}
	}

	async getThreads(): Promise<Thread[]> {
		try {
			const inbox = await this.ig.feed.directInbox().items();

			return inbox.map(thread => ({
				id: thread.thread_id,
				title: this.getThreadTitle(thread),
				users: this.getThreadUsers(thread),
				lastMessage: this.getLastMessage(thread),
				lastActivity: new Date(thread.last_activity_at),
				unreadCount: (thread as any).read_state?.unseen_count || 0,
			}));
		} catch (error) {
			console.error('Failed to fetch threads:', error);
			throw error;
		}
	}

	async getMessages(threadId: string): Promise<Message[]> {
		try {
			const thread = this.ig.feed.directThread({
				thread_id: threadId,
				oldest_cursor: '',
			});
			const items = await thread.items();

			return items
				.filter(item => item.item_type === 'text')
				.map(item => ({
					id: item.item_id,
					text: item.text || '',
					timestamp: new Date((item.timestamp as any) / 1000),
					userId: item.user_id.toString(),
					username: this.getUsernameFromId(item.user_id),
					isOutgoing: item.user_id.toString() === this.ig.state.cookieUserId,
					threadId: threadId,
				}))
				.reverse(); // Show newest messages at bottom
		} catch (error) {
			console.error('Failed to fetch messages:', error);
			throw error;
		}
	}

	async sendMessage(threadId: string, text: string): Promise<void> {
		try {
			await this.ig.entity.directThread(threadId).broadcastText(text);
		} catch (error) {
			console.error('Failed to send message:', error);
			throw error;
		}
	}

	private getThreadTitle(thread: any): string {
		if (thread.thread_title) {
			return thread.thread_title;
		}

		// For threads without titles, use usernames
		const users = thread.users || [];
		const otherUsers = users.filter(
			(user: any) => user.pk.toString() !== this.ig.state.cookieUserId,
		);

		if (otherUsers.length === 0) {
			return 'You';
		}

		if (otherUsers.length === 1) {
			return (
				otherUsers[0].username || otherUsers[0].full_name || 'Unknown User'
			);
		}

		return otherUsers
			.map((user: any) => user.username || user.full_name)
			.join(', ');
	}

	private getThreadUsers(thread: any): User[] {
		const users = thread.users || [];
		return users.map((user: any) => ({
			pk: user.pk.toString(),
			username: user.username || '',
			fullName: user.full_name || '',
			profilePicUrl: user.profile_pic_url,
			isVerified: user.is_verified || false,
		}));
	}

	private getLastMessage(thread: any): Message | undefined {
		const items = thread.items || [];
		const lastItem = items.find((item: any) => item.item_type === 'text');

		if (!lastItem) {
			return undefined;
		}

		return {
			id: lastItem.item_id,
			text: lastItem.text || '',
			timestamp: new Date(lastItem.timestamp / 1000),
			userId: lastItem.user_id.toString(),
			username: this.getUsernameFromId(lastItem.user_id),
			isOutgoing: lastItem.user_id.toString() === this.ig.state.cookieUserId,
			threadId: thread.thread_id,
		};
	}

	private getUsernameFromId(userId: number): string {
		// This is a simplified implementation
		// In a real app, you'd maintain a user cache
		return userId.toString() === this.ig.state.cookieUserId
			? 'You'
			: `User_${userId}`;
	}

	async getCurrentUser(): Promise<User | null> {
		try {
			const user = await this.ig.user.info(this.ig.state.cookieUserId);
			return {
				pk: user.pk.toString(),
				username: user.username,
				fullName: user.full_name,
				profilePicUrl: user.profile_pic_url,
				isVerified: user.is_verified,
			};
		} catch (error) {
			console.error('Failed to get current user:', error);
			return null;
		}
	}
}
