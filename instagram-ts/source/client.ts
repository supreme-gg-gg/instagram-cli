import {
	IgApiClient,
	type DirectInboxFeedResponseThreadsItem,
	type DirectInboxFeedResponseUsersItem,
} from 'instagram-private-api';
import {join} from 'path';
import fs from 'fs/promises';
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

			// Generate device for this username FIRST (as per official docs)
			this.ig.state.generateDevice(username);

			// Set up request listener to save session after each request
			this.ig.request.end$.subscribe(async () => {
				await this.saveSessionState();
			});

			// Check if we should load existing session first
			const sessionExists = await this.sessionManager.sessionExists();
			if (sessionExists) {
				try {
					const sessionData = await this.sessionManager.loadSession();
					if (sessionData) {
						// Try to use existing session
						await this.ig.state.deserialize(sessionData);
						// Test if session is still valid
						try {
							await this.ig.account.currentUser();
							// Session is valid, no need to login
							await this.configManager.set('login.currentUsername', username);
							const defaultUsername = this.configManager.get<string>(
								'login.defaultUsername',
							);
							if (!defaultUsername) {
								await this.configManager.set('login.defaultUsername', username);
							}
							return {success: true, username};
						} catch (sessionError) {
							console.log(
								'Existing session invalid, proceeding with fresh login',
							);
							// Reset device and continue with fresh login
							this.ig.state.generateDevice(username);
						}
					}
				} catch (error) {
					console.log('Could not load existing session, creating new one');
					// Reset device and continue with fresh login
					this.ig.state.generateDevice(username);
				}
			}

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

			if (!this.username) {
				return {success: false, error: 'No username set for session login'};
			}

			// Step 1: Generate device FIRST (as per official docs)
			this.ig.state.generateDevice(this.username);

			// Step 2: Set up request listener to save session after each request
			this.ig.request.end$.subscribe(async () => {
				await this.saveSessionState();
			});

			// Step 3: Deserialize the session state
			await this.ig.state.deserialize(sessionData);

			// Step 4: Test if session is valid by making a simple request
			// Most of the time you don't have to login after loading the state (as per docs)
			const currentUser = await this.ig.account.currentUser();
			this.username = currentUser.username;

			// Save the session after successful validation
			await this.saveSessionState();
			await this.configManager.set('login.currentUsername', this.username);

			return {success: true, username: this.username || undefined};
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

	public async logout(usernameToLogout?: string): Promise<void> {
		try {
			const targetUsername = usernameToLogout || this.username;
			if (targetUsername) {
				const sessionManager = new SessionManager(targetUsername);
				await sessionManager.deleteSession();
				// If the logged out user is the current user, clear currentUsername
				if (
					this.configManager.get('login.currentUsername') === targetUsername
				) {
					await this.configManager.set('login.currentUsername', null);
				}
			} else {
				// If no specific username, just clear the current username
				await this.configManager.set('login.currentUsername', null);
			}
		} catch (error) {
			console.error('Error during logout:', error);
			throw error; // Re-throw to be caught by the command
		}
	}

	public async switchUser(username: string): Promise<void> {
		try {
			const sessionManager = new SessionManager(username);
			const sessionExists = await sessionManager.sessionExists();

			if (!sessionExists) {
				throw new Error(
					`No session found for @${username}. Please login first.`,
				);
			}

			await this.configManager.set('login.currentUsername', username);
			this.username = username; // Update the client's internal username
		} catch (error) {
			console.error('Error during switchUser:', error);
			throw error; // Re-throw to be caught by the command
		}
	}

	public static async cleanupSessions(): Promise<void> {
		try {
			const configManager = ConfigManager.getInstance();
			await configManager.initialize();

			// Clean up current username in config
			await configManager.set('login.currentUsername', null);

			// Clean up session files
			const usersDir = configManager.get('advanced.usersDir') as string;
			try {
				const userDirs = await fs.readdir(usersDir);
				for (const userDir of userDirs) {
					const sessionFile = join(usersDir, userDir, 'session.ts.json');
					try {
						await fs.unlink(sessionFile);
					} catch (error) {
						// Ignore if file doesn't exist
					}
				}
			} catch (error) {
				// Ignore if usersDir doesn't exist
			}
		} catch (error) {
			console.error('Error during session cleanup:', error);
			throw error;
		}
	}

	public static async cleanupCache(): Promise<void> {
		try {
			const configManager = ConfigManager.getInstance();
			await configManager.initialize();

			const cacheDir = configManager.get('advanced.cacheDir') as string;
			const mediaDir = configManager.get('advanced.mediaDir') as string;
			const generatedDir = configManager.get('advanced.generatedDir') as string;

			for (const dir of [cacheDir, mediaDir, generatedDir]) {
				try {
					const files = await fs.readdir(dir);
					for (const file of files) {
						await fs.unlink(join(dir, file as string));
					}
				} catch (error) {
					// Ignore if directory or files don't exist
				}
			}
		} catch (error) {
			console.error('Error during cache cleanup:', error);
			throw error;
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
					thread.users.forEach((user: DirectInboxFeedResponseUsersItem) => {
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
				unread: thread.has_newer ? true : false,
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

			const messages = items.map(item => {
				const baseMessage = {
					id: item.item_id,
					timestamp: new Date(Number(item.timestamp) / 1000),
					userId: item.user_id.toString(),
					username: this.getUsernameFromCache(item.user_id, this.userCache),
					isOutgoing: item.user_id.toString() === this.ig.state.cookieUserId,
					threadId: threadId,
				};

				switch (item.item_type) {
					case 'text':
						return {...baseMessage, itemType: 'text', text: item.text || ''};
					case 'media':
						return {
							...baseMessage,
							itemType: 'media',
							// somehow the types do not contain non-text message fields so we need to cast it
							// this is verified by examining the API response directly
							media: (item as any).media,
						};
					case 'clip':
						return {...baseMessage, itemType: 'clip', clip: undefined};
					default:
						return {
							...baseMessage,
							itemType: 'placeholder',
							text: `[Unsupported message type: ${item.item_type}]`,
						};
				}
			}) as Message[];

			return {
				messages: messages.reverse(), // Show newest messages at top
				cursor: thread.cursor,
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

	private getThreadTitle(thread: DirectInboxFeedResponseThreadsItem): string {
		if (thread.thread_title) {
			return thread.thread_title;
		}

		// For threads without titles, use usernames
		const users = thread.users || [];
		const otherUsers = users.filter(
			(user: DirectInboxFeedResponseUsersItem) =>
				user.pk.toString() !== this.ig.state.cookieUserId,
		);

		if (otherUsers.length === 0) {
			return 'You';
		}

		if (otherUsers.length === 1) {
			return (
				otherUsers[0]?.username || otherUsers[0]?.full_name || 'Unknown User'
			);
		}

		return otherUsers
			.map(
				(user: DirectInboxFeedResponseUsersItem) =>
					user.username || user.full_name,
			)
			.join(', ');
	}

	private getThreadUsers(thread: DirectInboxFeedResponseThreadsItem): User[] {
		const users = thread.users || [];
		return users.map((user: DirectInboxFeedResponseUsersItem) => ({
			pk: user.pk.toString(),
			username: user.username || '',
			fullName: user.full_name || '',
			profilePicUrl: user.profile_pic_url,
			isVerified: user.is_verified || false,
		}));
	}

	private getLastMessage(
		thread: DirectInboxFeedResponseThreadsItem,
	): Message | undefined {
		const items = thread.items || [];
		const lastItem = items[0];

		if (!lastItem) {
			return undefined;
		}

		const baseMessage = {
			id: lastItem.item_id,
			timestamp: new Date(Number(lastItem.timestamp) / 1000),
			userId: lastItem.user_id.toString(),
			username: this.getUsernameFromCache(lastItem.user_id, this.userCache),
			isOutgoing: lastItem.user_id.toString() === this.ig.state.cookieUserId,
			threadId: thread.thread_id,
		};

		switch (lastItem.item_type) {
			case 'text':
				return {...baseMessage, itemType: 'text', text: lastItem.text || ''};
			case 'media':
				return {
					...baseMessage,
					itemType: 'media',
					media: (lastItem as any).media,
				};
			case 'clip':
				return {...baseMessage, itemType: 'clip', clip: undefined};
			case 'placeholder':
				return {
					...baseMessage,
					itemType: 'placeholder',
					text: lastItem.placeholder?.message || 'Placeholder message',
				};
			default:
				return {
					...baseMessage,
					itemType: 'placeholder',
					text: `[Unsupported message type: ${lastItem.item_type}]`,
				};
		}
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
