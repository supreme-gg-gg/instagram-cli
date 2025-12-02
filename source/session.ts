import fs from 'node:fs';
import path from 'node:path';
import {ConfigManager} from './config.js';
import {createContextualLogger} from './utils/logger.js';

export type SerializedState = Record<string, any>;

export class SessionManager {
	private username: string | undefined;
	private readonly configManager: ConfigManager;
	private readonly logger = createContextualLogger('SessionManager');

	constructor(username?: string) {
		this.configManager = ConfigManager.getInstance();
		this.username = username ?? undefined;

		if (!this.username) {
			this.username = this.getDefaultUsername();
			if (!this.username) {
				throw new Error(
					'No username provided and no default username found in config',
				);
			}
		}
	}

	public getUsername(): string | undefined {
		return this.username;
	}

	public setUsername(username: string): void {
		this.username = username;
	}

	public async saveSession(serializedState: SerializedState): Promise<void> {
		await this.ensureSessionDir();
		const sessionPath = this.getSessionPath();

		try {
			// Remove constants to always use the latest version
			const {constants, ...stateToSave} = serializedState;
			fs.writeFileSync(
				sessionPath,
				JSON.stringify(stateToSave, null, 2),
				'utf8',
			);
		} catch (error) {
			this.logger.error('Error saving session:', error);
			throw error;
		}
	}

	public async loadSession(): Promise<SerializedState | undefined> {
		const sessionPath = this.getSessionPath();

		try {
			let sessionExists;
			try {
				fs.accessSync(sessionPath);
				sessionExists = true;
			} catch {
				sessionExists = false;
			}

			if (!sessionExists) {
				return undefined;
			}

			const sessionData = fs.readFileSync(sessionPath, 'utf8');
			return JSON.parse(sessionData) as SerializedState;
		} catch (error) {
			this.logger.error('Error loading session:', error);
			return undefined;
		}
	}

	public async deleteSession(): Promise<void> {
		const sessionPath = this.getSessionPath();

		try {
			fs.unlinkSync(sessionPath);
		} catch (error) {
			// Session file doesn't exist, which is fine
			if ((error as any).code !== 'ENOENT') {
				this.logger.error('Error deleting session:', error);
				throw error;
			}
		}
	}

	public async sessionExists(): Promise<boolean> {
		const sessionPath = this.getSessionPath();
		try {
			fs.accessSync(sessionPath);
			return true;
		} catch {
			return false;
		}
	}

	private getDefaultUsername(): string | undefined {
		const current = this.configManager.get('login.currentUsername');
		if (current) {
			return current;
		}

		const defaultUsername = this.configManager.get('login.defaultUsername');
		if (defaultUsername) {
			return defaultUsername;
		}

		return undefined;
	}

	private getSessionPath(): string {
		if (!this.username) {
			throw new Error('Username is not set');
		}

		const usersDirectory = this.configManager.get('advanced.usersDir');
		return path.join(usersDirectory, this.username, 'session.ts.json');
	}

	private async ensureSessionDir(): Promise<string> {
		if (!this.username) {
			throw new Error('Username is not set');
		}

		const usersDirectory = this.configManager.get('advanced.usersDir');
		const sessionDirectory = path.join(usersDirectory, this.username);
		fs.mkdirSync(sessionDirectory, {recursive: true});
		return sessionDirectory;
	}
}
