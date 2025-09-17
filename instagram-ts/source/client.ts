import {join} from 'node:path';
import fs from 'node:fs';
import {
	IgApiClient,
	IgCheckpointError,
	IgLoginTwoFactorRequiredError,
	type DirectInboxFeedResponseThreadsItem,
	type DirectInboxFeedResponseUsersItem,
	type AccountRepositoryLoginErrorResponseTwoFactorInfo,
} from 'instagram-private-api';
import {SessionManager} from './session.js';
import {ConfigManager} from './config.js';
import type {Thread, Message, User} from './types/instagram.js';

export type LoginResult = {
	success: boolean;
	error?: string;
	username?: string;
	checkpointError?: IgCheckpointError;
	twoFactorInfo?: AccountRepositoryLoginErrorResponseTwoFactorInfo; // Add this to carry 2FA info
};

export class InstagramClient {
	public static async cleanupSessions(): Promise<void> {
		try {
			const configManager = ConfigManager.getInstance();
			await configManager.initialize();

			// Clean up current username in config
			await configManager.set('login.currentUsername', null);

			// Clean up session files
			const usersDirectory = configManager.get('advanced.usersDir');
			try {
				const userDirectories = fs.readdirSync(usersDirectory);
				for (const userSubdirectory of userDirectories) {
					const sessionFile = join(
						usersDirectory,
						userSubdirectory,
						'session.ts.json',
					);
					try {
						fs.unlinkSync(sessionFile);
					} catch {
						// Ignore if file doesn't exist
					}
				}
			} catch {
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

			const cacheDirectory = configManager.get('advanced.cacheDir');
			const mediaDirectory = configManager.get('advanced.mediaDir');
			const generatedDirectory = configManager.get('advanced.generatedDir');

			for (const directory of [
				cacheDirectory,
				mediaDirectory,
				generatedDirectory,
			]) {
				try {
					const files = fs.readdirSync(directory);
					for (const file of files) {
						fs.unlinkSync(join(directory, file));
					}
				} catch {
					// Ignore if directory or files don't exist
				}
			}
		} catch (error) {
			console.error('Error during cache cleanup:', error);
			throw error;
		}
	}

	private readonly ig: IgApiClient;
	private sessionManager: SessionManager | undefined = undefined;
	private readonly configManager: ConfigManager;
	private username: string | undefined = undefined;
	private readonly userCache = new Map<string, string>(); // Cache for user ID -> username mapping

	constructor(username?: string) {
		this.ig = new IgApiClient();
		this.configManager = ConfigManager.getInstance();

		if (username) {
			this.username = username;
			this.sessionManager = new SessionManager(username);
		}
	}

	public async login(username: string, password: string): Promise<LoginResult> {
		try {
			this.username = username;
			this.sessionManager = new SessionManager(username);

			this.ig.state.generateDevice(username);

			this.ig.request.end$.subscribe(async () => {
				await this.saveSessionState();
			});

			await this.ig.simulate.preLoginFlow();
			await this.ig.account.login(username, password);

			await this.saveSessionState();
			await this.configManager.set('login.currentUsername', username);

			const defaultUsername = this.configManager.get('login.defaultUsername');
			if (!defaultUsername) {
				await this.configManager.set('login.defaultUsername', username);
			}

			return {success: true, username};
		} catch (error) {
			if (error instanceof IgLoginTwoFactorRequiredError) {
				return {
					success: false,
					twoFactorInfo: error.response.body.two_factor_info,
				};
			}

			if (error instanceof IgCheckpointError) {
				return {success: false, checkpointError: error};
			}

			console.error('Login failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown login error',
			};
		}
	}

	public async twoFactorLogin({
		verificationCode,
		twoFactorIdentifier,
		totp_two_factor_on,
	}: {
		verificationCode: string;
		twoFactorIdentifier: string;
		totp_two_factor_on: boolean;
	}): Promise<LoginResult> {
		try {
			const verificationMethod = totp_two_factor_on ? '0' : '1'; // 0 = TOTP, 1 = SMS
			await this.ig.account.twoFactorLogin({
				username: this.username!,
				verificationCode,
				twoFactorIdentifier,
				verificationMethod,
			});

			await this.saveSessionState();
			if (this.username) {
				await this.configManager.set('login.currentUsername', this.username);
			}

			return {success: true, username: this.username ?? undefined};
		} catch (error) {
			console.error('2FA Login failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown 2FA error',
			};
		}
	}

	public async startChallenge(): Promise<void> {
		// This handles automatically choosing challenge type etc.
		await this.ig.challenge.auto(true);
	}

	public async sendChallengeCode(code: string): Promise<LoginResult> {
		try {
			await this.ig.challenge.sendSecurityCode(code);

			// After sending code, the user should be logged in.
			// The session should be saved by the hook.
			await this.saveSessionState();
			if (this.username) {
				await this.configManager.set('login.currentUsername', this.username);
				const defaultUsername = this.configManager.get('login.defaultUsername');
				if (!defaultUsername) {
					await this.configManager.set('login.defaultUsername', this.username);
				}
			}

			return {success: true, username: this.username ?? undefined};
		} catch (error) {
			console.error('Sending challenge code failed:', error);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : 'Unknown challenge error',
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

			return {success: true, username: this.username ?? undefined};
		} catch (error) {
			if (error instanceof IgCheckpointError) {
				return {success: false, checkpointError: error};
			}

			console.error('Failed to login with session:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown session error',
			};
		}
	}

	public async logout(usernameToLogout?: string): Promise<void> {
		try {
			const targetUsername = usernameToLogout ?? this.username;
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

	public getInstagramClient(): IgApiClient {
		return this.ig;
	}

	public getUsername(): string | undefined {
		return this.username;
	}

	async getCurrentUser(): Promise<User | undefined> {
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
			return undefined;
		}
	}

	async getThreads(): Promise<Thread[]> {
		try {
			const inbox = await this.ig.feed.directInbox().items();

			// Clear and populate user cache from all threads
			this.userCache.clear();
			for (const thread of inbox) {
				if (thread.users) {
					for (const user of thread.users) {
						this.userCache.set(
							user.pk.toString(),
							user.username ?? user.full_name ?? `User_${user.pk}`,
						);
					}
				}
			}

			return inbox.map(thread => ({
				id: thread.thread_id,
				title: this.getThreadTitle(thread),
				users: this.getThreadUsers(thread),
				lastMessage: this.getLastMessage(thread),
				lastActivity: new Date(Number(thread.last_activity_at) / 1000),
				unread: Boolean(thread.has_newer),
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
				oldest_cursor: cursor ?? '',
			});
			const items = await thread.items();

			const messages = items.map(item => {
				const baseMessage = {
					id: item.item_id,
					timestamp: new Date(Number(item.timestamp) / 1000),
					userId: item.user_id.toString(),
					username: this.getUsernameFromCache(item.user_id, this.userCache),
					isOutgoing: item.user_id.toString() === this.ig.state.cookieUserId,
					threadId,
				};

				switch (item.item_type) {
					case 'text': {
						return {...baseMessage, itemType: 'text', text: item.text || ''};
					}

					case 'media': {
						return {
							...baseMessage,
							itemType: 'media',
							// Somehow the types do not contain non-text message fields so we need to cast it
							// this is verified by examining the API response directly
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
							media: (item as any).media,
						};
					}

					case 'clip': {
						return {...baseMessage, itemType: 'clip', clip: undefined};
					}

					default: {
						return {
							...baseMessage,
							itemType: 'placeholder',
							text: `[Unsupported message type: ${item.item_type}]`,
						};
					}
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

	private async saveSessionState(): Promise<void> {
		if (!this.sessionManager) {
			return;
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const serialized = await this.ig.state.serialize();
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			await this.sessionManager.saveSession(serialized);
		} catch (error) {
			console.error('Error saving session state:', error);
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
				otherUsers[0]?.username ?? otherUsers[0]?.full_name ?? 'Unknown User'
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
			case 'text': {
				return {...baseMessage, itemType: 'text', text: lastItem.text ?? ''};
			}

			case 'media': {
				return {
					...baseMessage,
					itemType: 'media',
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					media: (lastItem as any).media,
				};
			}

			case 'clip': {
				return {...baseMessage, itemType: 'clip', clip: undefined};
			}

			case 'placeholder': {
				return {
					...baseMessage,
					itemType: 'placeholder',
					text: lastItem.placeholder?.message ?? 'Placeholder message',
				};
			}

			default: {
				return {
					...baseMessage,
					itemType: 'placeholder',
					text: `[Unsupported message type: ${lastItem.item_type}]`,
				};
			}
		}
	}

	private getUsernameFromCache(
		userId: number,
		userCache: Map<string, string>,
	): string {
		const userIdString = userId.toString();

		// Check if it's the current user
		if (userIdString === this.ig.state.cookieUserId) {
			return 'You';
		}

		// Look up in the user cache
		const username = userCache.get(userIdString);
		return username ?? `User_${userId}`;
	}
}
