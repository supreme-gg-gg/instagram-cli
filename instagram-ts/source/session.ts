import fs from 'fs/promises';
import path from 'path';
import {ConfigManager} from './config.js';

export interface SerializedState {
	[key: string]: any;
}

export class SessionManager {
	private username: string | null;
	private configManager: ConfigManager;

	constructor(username?: string) {
		this.configManager = ConfigManager.getInstance();
		this.username = username || null;

		if (!this.username) {
			this.username = this.getDefaultUsername();
			if (!this.username) {
				throw new Error(
					'No username provided and no default username found in config',
				);
			}
		}
	}

	private getDefaultUsername(): string | null {
		const current = this.configManager.get<string>('login.currentUsername');
		if (current) {
			return current;
		}

		const defaultUsername = this.configManager.get<string>(
			'login.defaultUsername',
		);
		if (defaultUsername) {
			return defaultUsername;
		}

		return null;
	}

	public getUsername(): string | null {
		return this.username;
	}

	public setUsername(username: string): void {
		this.username = username;
	}

	private getSessionPath(): string {
		if (!this.username) {
			throw new Error('Username is not set');
		}

		const usersDir = this.configManager.get<string>('advanced.usersDir');
		return path.join(usersDir, this.username, 'session-ts.json');
	}

	private async ensureSessionDir(): Promise<string> {
		if (!this.username) {
			throw new Error('Username is not set');
		}

		const usersDir = this.configManager.get<string>('advanced.usersDir');
		const sessionDir = path.join(usersDir, this.username);
		await fs.mkdir(sessionDir, {recursive: true});
		return sessionDir;
	}

	public async saveSession(serializedState: SerializedState): Promise<void> {
		await this.ensureSessionDir();
		const sessionPath = this.getSessionPath();

		try {
			// Remove constants to always use the latest version
			const {constants, ...stateToSave} = serializedState;
			await fs.writeFile(
				sessionPath,
				JSON.stringify(stateToSave, null, 2),
				'utf8',
			);
		} catch (error) {
			console.error('Error saving session:', error);
			throw error;
		}
	}

	public async loadSession(): Promise<SerializedState | null> {
		const sessionPath = this.getSessionPath();

		try {
			const sessionExists = await fs
				.access(sessionPath)
				.then(() => true)
				.catch(() => false);
			if (!sessionExists) {
				return null;
			}

			const sessionData = await fs.readFile(sessionPath, 'utf8');
			return JSON.parse(sessionData) as SerializedState;
		} catch (error) {
			console.error('Error loading session:', error);
			return null;
		}
	}

	public async deleteSession(): Promise<void> {
		const sessionPath = this.getSessionPath();

		try {
			await fs.unlink(sessionPath);
		} catch (error) {
			// Session file doesn't exist, which is fine
			if ((error as any).code !== 'ENOENT') {
				console.error('Error deleting session:', error);
				throw error;
			}
		}
	}

	public async sessionExists(): Promise<boolean> {
		const sessionPath = this.getSessionPath();
		return fs
			.access(sessionPath)
			.then(() => true)
			.catch(() => false);
	}
}
