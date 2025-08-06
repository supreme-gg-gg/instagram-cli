import {IgApiClient} from 'instagram-private-api';
import {SessionManager} from './session.js';
import {ConfigManager} from './config.js';
import type {Thread, Message, User} from './types/instagram.js';

export interface LoginResult {
	success: boolean;
	error?: string;
	username?: string;
}

export class InstagramClient {
	private ig: IgApiClient;
	private sessionManager: SessionManager | null = null;
	private configManager: ConfigManager;
	private username: string | null = null;
	private userCache: Map<string, string> = new Map(); // Cache for user ID -> username mapping

	constructor(username?: string) {
		this.ig = new IgApiClient();
		this.configManager = ConfigManager.getInstance();

		if (username) {
			this.username = username;
			this.sessionManager = new SessionManager(username);
		}
	}

	public async login(
		username: string,
		password: string,
		verificationCode?: string,
	): Promise<LoginResult> {
		try {
			this.username = username;
			this.sessionManager = new SessionManager(username);

			// Check if we should load existing session first
			const sessionExists = await this.sessionManager.sessionExists();
			if (sessionExists) {
				try {
					const sessionData = await this.sessionManager.loadSession();
					if (sessionData) {
						await this.ig.state.deserialize(sessionData);
						// Preserve device UUIDs from old session
						const oldSettings = await this.ig.state.serialize();
						this.ig.state.generateDevice(username);
						if (oldSettings.deviceString) {
							// Restore device string to maintain consistency
							await this.ig.state.deserialize({
								...sessionData,
								deviceString: oldSettings.deviceString,
							});
						}
					}
				} catch (error) {
					console.log('Could not load existing session, creating new one');
				}
			}

			// Generate device for this username
			this.ig.state.generateDevice(username);

			// Set up request listener to save session after each request
			this.ig.request.end$.subscribe(async () => {
				await this.saveSessionState();
			});

			// Perform login
			await this.ig.simulate.preLoginFlow();

			if (verificationCode) {
				// If 2FA is needed, this would need to be handled differently
				// For now, we'll assume the verification code is provided upfront
				await this.ig.account.login(username, password);
			} else {
				await this.ig.account.login(username, password);
			}

			// Save session and update config
			await this.saveSessionState();
			await this.configManager.set('login.currentUsername', username);

			// Set as default username if none exists
			const defaultUsername = this.configManager.get<string>(
				'login.defaultUsername',
			);
			if (!defaultUsername) {
				await this.configManager.set('login.defaultUsername', username);
			}

			return {success: true, username};
		} catch (error) {
			console.error('Login failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown login error',
			};
		}
	}

	public async loginBySession(): Promise<LoginResult> {
		if (!this.sessionManager) {
			return {success: false, error: 'No session manager initialized'};
		}

		try {
			const sessionData = await this.sessionManager.loadSession();
			if (!sessionData) {
				return {success: false, error: 'No session file found'};
			}

			// Deserialize the session state
			await this.ig.state.deserialize(sessionData);

			// Test if session is valid by making a simple request
			const currentUser = await this.ig.account.currentUser();
			this.username = currentUser.username;

			// Save the session after successful login
			await this.saveSessionState();
			await this.configManager.set('login.currentUsername', this.username);

			return {success: true, username: this.username};
		} catch (error) {
			console.error('Failed to login with session:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown session error',
			};
		}
	}

	private async saveSessionState(): Promise<void> {
		if (!this.sessionManager) {
			return;
		}

		try {
			const serialized = await this.ig.state.serialize();
			await this.sessionManager.saveSession(serialized);
		} catch (error) {
			console.error('Error saving session state:', error);
		}
	}

	public async logout(): Promise<void> {
		try {
			if (this.sessionManager) {
				await this.sessionManager.deleteSession();
			}
			await this.configManager.set('login.currentUsername', null);
		} catch (error) {
			console.error('Error during logout:', error);
		}
	}

	public getInstagramClient(): IgApiClient {
		return this.ig;
	}

	public getUsername(): string | null {
		return this.username;
	}

	async getThreads(): Promise<Thread[]> {
		try {
			const inbox = await this.ig.feed.directInbox().items();

			// Clear and populate user cache from all threads
			this.userCache.clear();
			inbox.forEach(thread => {
				if (thread.users) {
					thread.users.forEach((user: any) => {
						this.userCache.set(
							user.pk.toString(),
							user.username || user.full_name || `User_${user.pk}`,
						);
					});
				}
			});

			return inbox.map(thread => ({
				id: thread.thread_id,
				title: this.getThreadTitle(thread),
				users: this.getThreadUsers(thread),
				lastMessage: this.getLastMessage(thread),
				lastActivity: new Date(Number(thread.last_activity_at) / 1000),
				unreadCount: (thread as any).read_state?.unseen_count || 0,
			}));
		} catch (error) {
			console.error('Failed to fetch threads:', error);
			throw error;
		}
	}

	async getMessages(
		threadId: string,
		cursor?: string,
	): Promise<{messages: Message[]; cursor: string | undefined}> {
		try {
			const thread = this.ig.feed.directThread({
				thread_id: threadId,
				oldest_cursor: cursor || '',
			});
			const items = await thread.items();

			return {
				messages: items
					// for now we only handle text messages
					.filter(item => item.item_type === 'text')
					.map(item => ({
						id: item.item_id,
						text: item.text || '',
						itemType: item.item_type,
						timestamp: new Date((item.timestamp as any) / 1000),
						userId: item.user_id.toString(),
						username: this.getUsernameFromCache(item.user_id, this.userCache),
						isOutgoing: item.user_id.toString() === this.ig.state.cookieUserId,
						threadId: threadId,
					}))
					.reverse(), // Show newest messages at bottom
				cursor: (thread as any).oldestCursor,
			};
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
		// for now we only handle text messages
		const lastItem = items.find((item: any) => item.item_type === 'text');

		if (!lastItem) {
			return undefined;
		}

		return {
			id: lastItem.item_id,
			text: lastItem.text || '',
			itemType: lastItem.item_type,
			timestamp: new Date(lastItem.timestamp / 1000),
			userId: lastItem.user_id.toString(),
			username: this.getUsernameFromCache(lastItem.user_id, this.userCache),
			isOutgoing: lastItem.user_id.toString() === this.ig.state.cookieUserId,
			threadId: thread.thread_id,
		};
	}

	private getUsernameFromCache(
		userId: number,
		userCache: Map<string, string>,
	): string {
		const userIdStr = userId.toString();

		// Check if it's the current user
		if (userIdStr === this.ig.state.cookieUserId) {
			return 'You';
		}

		// Look up in the user cache
		const username = userCache.get(userIdStr);
		return username || `User_${userId}`;
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
