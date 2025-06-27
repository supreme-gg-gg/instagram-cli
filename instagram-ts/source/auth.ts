import {IgApiClient} from 'instagram-private-api';
import {SessionManager} from './session.js';
import {ConfigManager} from './config.js';

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

	constructor(username?: string) {
		this.ig = new IgApiClient();
		this.configManager = ConfigManager.getInstance();

		if (username) {
			this.username = username;
			this.sessionManager = new SessionManager(username);
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
}

// Legacy function for backward compatibility
export async function login(
	username: string,
	password: string,
): Promise<LoginResult> {
	const client = new InstagramClient();
	return client.login(username, password);
}
