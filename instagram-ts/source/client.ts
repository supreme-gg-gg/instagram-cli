import {join} from 'node:path';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import {
	type IgApiClient,
	IgCheckpointError,
	IgLoginTwoFactorRequiredError,
	type DirectInboxFeedResponseThreadsItem,
	type DirectInboxFeedResponseUsersItem,
	type DirectThreadFeedResponseItemsItem,
	type AccountRepositoryLoginErrorResponseTwoFactorInfo,
} from 'instagram-private-api';
import {
	withRealtime,
	GraphQLSubscriptions,
	SkywalkerSubscriptions,
	type RealtimeClient,
	IgApiClientExt,
} from 'instagram_mqtt';
import {SessionManager} from './session.js';
import {ConfigManager} from './config.js';
import type {Thread, Message, User} from './types/instagram.js';
import {parseMessageItem, parseReactionEvent} from './utils/message-parser.js';
import {createContextualLogger} from './utils/logger.js';

export type LoginResult = {
	success: boolean;
	error?: string;
	username?: string;
	checkpointError?: IgCheckpointError;
	twoFactorInfo?: AccountRepositoryLoginErrorResponseTwoFactorInfo;
};

export type RealtimeStatus =
	| 'disconnected'
	| 'connecting'
	| 'connected'
	| 'error';

// eslint-disable-next-line unicorn/prefer-event-target
export class InstagramClient extends EventEmitter {
	public static async cleanupSessions(): Promise<void> {
		try {
			const configManager = ConfigManager.getInstance();
			await configManager.initialize();

			await configManager.set('login.currentUsername', undefined);

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
					} catch {}
				}
			} catch {}
		} catch (error) {
			const logger = createContextualLogger('cleanupSessions');
			logger.error('Error during session cleanup', error);
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
				} catch {}
			}
		} catch (error) {
			const logger = createContextualLogger('cleanupCache');
			logger.error('Error during cache cleanup', error);
			throw error;
		}
	}

	private readonly ig: IgApiClientExt;
	private realtime: RealtimeClient | undefined;
	private realtimeStatus: RealtimeStatus = 'disconnected';

	private sessionManager: SessionManager | undefined = undefined;
	private readonly configManager: ConfigManager;
	private username: string | undefined = undefined;
	private readonly userCache = new Map<string, string>();
	private readonly logger = createContextualLogger('InstagramClient');

	constructor(username?: string) {
		super();
		this.ig = new IgApiClientExt();
		this.configManager = ConfigManager.getInstance();

		if (username) {
			this.username = username;
			this.sessionManager = new SessionManager(username);
		}
	}

	/**
	 * Attempts to log in to Instagram using the provided username and password.
	 *
	 * Performs pre-login flow and on successful login saves session states and config values.
	 * Handles two-factor authentication and checkpoint challenges by returning relevant information.
	 *
	 * @param username - The Instagram username to log in with.
	 * @param password - The password for the specified username.
	 * @param options - Optional settings for login, including whether to initialize the realtime connection.
	 * @returns A promise that resolves to a `LoginResult` indicating success or failure, and additional info if required.
	 *
	 * @remarks
	 * This method performs a full credential-based login, which differs from session-based login.
	 * This is the default fallback method for session-based login when it fails (e.g. session expired)
	 *
	 *  @note If you do not wish to initialize realtime client, you can pass in the options parameter with false.
	 * 		  If this is the case, all responses will be handled by the API client instead
	 */
	public async login(
		username: string,
		password: string,
		options?: {initializeRealtime: boolean},
	): Promise<LoginResult> {
		const loginOptions = options ?? {initializeRealtime: true};
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

			if (loginOptions.initializeRealtime) {
				try {
					await this.initializeRealtime();
				} catch (error) {
					this.setRealtimeStatus('error');
					this.emit(
						'error',
						new Error(
							`Realtime connection failed: ${(error as Error).message}`,
						),
					);
				}
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

			this.logger.error('Login failed', error);
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
			const verificationMethod = totp_two_factor_on ? '0' : '1';
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
			this.logger.error('2FA Login failed', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown 2FA error',
			};
		}
	}

	public async startChallenge(): Promise<void> {
		await this.ig.challenge.auto(true);
	}

	public async sendChallengeCode(code: string): Promise<LoginResult> {
		try {
			await this.ig.challenge.sendSecurityCode(code);

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
			this.logger.error('Sending challenge code failed', error);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : 'Unknown challenge error',
			};
		}
	}

	public async loginBySession(options?: {
		initializeRealtime: boolean;
	}): Promise<LoginResult> {
		const sessionOptions = options ?? {initializeRealtime: true};
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

			this.ig.state.generateDevice(this.username);

			this.ig.request.end$.subscribe(async () => {
				await this.saveSessionState();
			});

			await this.ig.state.deserialize(sessionData);

			const currentUser = await this.ig.account.currentUser();
			this.username = currentUser.username;

			await this.saveSessionState();
			await this.configManager.set('login.currentUsername', this.username);

			if (sessionOptions.initializeRealtime) {
				try {
					await this.initializeRealtime();
				} catch (error) {
					this.setRealtimeStatus('error');
					this.emit(
						'error',
						new Error(
							`Realtime connection failed: ${(error as Error).message}`,
						),
					);
				}
			}

			return {success: true, username: this.username ?? undefined};
		} catch (error) {
			if (error instanceof IgCheckpointError) {
				return {success: false, checkpointError: error};
			}

			this.logger.error('Failed to login with session', error);
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
				if (
					this.configManager.get('login.currentUsername') === targetUsername
				) {
					await this.configManager.set('login.currentUsername', undefined);
				}
			} else {
				await this.configManager.set('login.currentUsername', undefined);
			}
		} catch (error) {
			this.logger.error('Error during logout', error);
			throw error;
		}
	}

	/**
	 * Disconnects the realtime client if it is connected.
	 *
	 * @remarks This destructor must be invoked by the view using the client.
	 * However, calling this is not strictly necessary based on the library examples.
	 * For example when the app quits by Ctrl+C, it is not disconnected but it's ok.
	 */
	public async shutdown(): Promise<void> {
		if (this.realtime) {
			await this.realtime.disconnect();
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
			this.username = username;
		} catch (error) {
			this.logger.error('Error during switchUser', error);
			throw error;
		}
	}

	public getInstagramClient(): IgApiClient {
		return this.ig;
	}

	public getUsername(): string | undefined {
		return this.username;
	}

	public getRealtimeStatus(): RealtimeStatus {
		return this.realtimeStatus;
	}

	public async getCurrentUser(): Promise<User | undefined> {
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
			this.logger.error('Failed to get current user', error);
			return undefined;
		}
	}

	public async getThreads(): Promise<Thread[]> {
		try {
			const inbox = await this.ig.feed.directInbox().items();

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
			this.logger.error('Failed to fetch threads', error);
			throw error;
		}
	}

	public async getMessages(
		threadId: string,
		cursor?: string,
	): Promise<{messages: Message[]; cursor: string | undefined}> {
		try {
			const thread = this.ig.feed.directThread({
				thread_id: threadId,
				oldest_cursor: cursor ?? '',
			});
			const items = await thread.items();
			const messages = items
				.map(item =>
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					parseMessageItem(item as any, threadId, {
						userCache: this.userCache,
						currentUserId: this.ig.state.cookieUserId,
					}),
				)
				.filter((message): message is Message => message !== undefined);
			
			// Mark messages as seen
			messages.forEach(message => {
				this.ig.entity.directThread(threadId).markItemSeen(message.id);
			});

			return {
				messages: messages.reverse(),
				cursor: thread.cursor,
			};
		} catch (error) {
			this.logger.error('Failed to fetch messages', error);
			throw error;
		}
	}

	public async sendMessage(threadId: string, text: string): Promise<void> {
		if (this.realtimeStatus === 'connected' && this.realtime?.direct) {
			try {
				await this.realtime.direct.sendText({threadId, text});
				return;
			} catch {
				this.logger.warn('MQTT sendMessage failed, falling back to API.');
			}
		}

		// Fallback to API if MQTT not available, failed, or not ready
		try {
			await this.ig.entity.directThread(threadId).broadcastText(text);
		} catch (error) {
			this.logger.error('Failed to send message', error);
			throw error;
		}
	}

	public async sendReply(
		threadId: string,
		text: string,
		replyToMessage: Message,
	): Promise<void> {
		try {
			await this.ig.entity
				.directThread(threadId)
				// The APi only requires item_id and client_context which are already present
				.broadcastText(
					text,
					replyToMessage as unknown as DirectThreadFeedResponseItemsItem,
				);
		} catch (error) {
			this.logger.error('Failed to send reply', error);
			throw error;
		}
	}

	public async sendReaction(
		threadId: string,
		itemId: string,
		emoji: string,
	): Promise<void> {
		if (this.realtimeStatus === 'connected' && this.realtime) {
			try {
				await this.realtime.direct?.sendReaction({
					threadId,
					itemId,
					emoji,
					reactionStatus: 'created',
				});
			} catch (error) {
				this.logger.warn('MQTT sendReaction failed.');
				throw error;
			}
		} else {
			throw new Error('Real-time client not connected. Cannot send reaction.');
		}
	}

	public async sendPhoto(threadId: string, filePath: string): Promise<void> {
		try {
			const fileBuffer = await fs.promises.readFile(filePath);
			await this.ig.entity.directThread(threadId).broadcastPhoto({
				file: fileBuffer,
			});
		} catch (error) {
			this.logger.error('Failed to send photo', error);
			throw error;
		}
	}

	public async sendVideo(threadId: string, filePath: string): Promise<void> {
		try {
			const fileBuffer = await fs.promises.readFile(filePath);
			await this.ig.entity.directThread(threadId).broadcastVideo({
				video: fileBuffer,
			});
		} catch (error) {
			this.logger.error('Failed to send video', error);
			throw error;
		}
	}

	public async unsendMessage(
		threadId: string,
		messageId: string,
	): Promise<void> {
		try {
			await this.ig.entity.directThread(threadId).deleteItem(messageId);
		} catch (error) {
			this.logger.error('Failed to unsend message', error);
			throw error;
		}
	}

	public async markMessageAsSeen(threadId: string, itemId: string): Promise<void> {
		if (this.realtimeStatus === 'connected' && this.realtime?.direct) {
			try {
				await this.realtime.direct.markAsSeen({threadId: threadId,  itemId: itemId});
				return;
			} catch {
				this.logger.warn('MQTT sendMessage Failed');
			}
		} else {
			throw new Error('Real-time client not connected. Cannot send reaction.');
		}
	}

	private setRealtimeStatus(status: RealtimeStatus) {
		this.realtimeStatus = status;
		this.emit('realtimeStatus', status);
	}

	private async initializeRealtime(): Promise<void> {
		this.setRealtimeStatus('connecting');
		this.realtime = withRealtime(this.ig).realtime;

		this.realtime.on('error', error => {
			this.logger.error('Realtime Error', error);
			this.setRealtimeStatus('error');
			this.emit('error', error);
		});

		this.realtime.on('close', () => {
			this.setRealtimeStatus('disconnected');
		});

		this.realtime.on('directStatus', (wrapper: any) => {
			this.logger.info(
				`Received MQTT "directStatus": ${JSON.stringify(wrapper)}`,
			);
		});

		
		this.realtime.on('threadUpdate', (wrapper: any) => {
			this.logger.info(
				`Received MQTT "directStatus": ${JSON.stringify(wrapper)}`,
			);
		});


		this.realtime.on('message', (wrapper: any) => {
			this.logger.debug(`Received MQTT "message": ${JSON.stringify(wrapper)}`);
			// Handle reaction events
			if (
				wrapper.delta_type === 'deltaCreateReaction' &&
				wrapper.message?.action_type !== 'action_log'
			) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				const reactionData = parseReactionEvent(wrapper.message);
				if (reactionData) {
					this.emit('reaction', reactionData);
				} else {
					this.logger.warn(
						`Failed to parse realtime reaction event: ${JSON.stringify(wrapper)}`,
					);
				}

				return;
			}

			// Handle regular message events
			// ThreadId must exist otherwise it's not possible to identify where this event belongs
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const threadId =
				wrapper?.message?.thread_id ?? wrapper?.message?.thread_v2_id;
			if (!threadId) return;

			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			const parsedMessage = parseMessageItem(wrapper.message, threadId, {
				userCache: this.userCache,
				currentUserId: this.ig.state.cookieUserId,
			});
			if (parsedMessage) {
				this.emit('message', parsedMessage);
			}
		});

		await this.realtime.connect({
			graphQlSubs: [
				GraphQLSubscriptions.getAppPresenceSubscription(),
				GraphQLSubscriptions.getZeroProvisionSubscription(
					this.ig.state.phoneId,
				),
				GraphQLSubscriptions.getDirectStatusSubscription(),
				GraphQLSubscriptions.getDirectTypingSubscription(
					this.ig.state.cookieUserId,
				),
				GraphQLSubscriptions.getAsyncAdSubscription(this.ig.state.cookieUserId),
			],
			skywalkerSubs: [
				SkywalkerSubscriptions.directSub(this.ig.state.cookieUserId),
				SkywalkerSubscriptions.liveSub(this.ig.state.cookieUserId),
			],
			irisData: await this.ig.feed.directInbox().request(),
		});

		this.setRealtimeStatus('connected');
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
			this.logger.error('Error saving session state', error);
		}
	}

	private getThreadTitle(thread: DirectInboxFeedResponseThreadsItem): string {
		if (thread.thread_title) {
			return thread.thread_title;
		}

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

		return parseMessageItem(
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			lastItem as any,
			thread.thread_id,
			{
				userCache: this.userCache,
				currentUserId: this.ig.state.cookieUserId,
			},
			{
				isPreview: true,
			},
		);
	}
}
