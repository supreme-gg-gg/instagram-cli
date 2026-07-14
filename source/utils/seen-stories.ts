import fs from 'node:fs/promises';
import path from 'node:path';
import {ConfigManager} from '../config.js';
import {createContextualLogger} from './logger.js';

const logger = createContextualLogger('SeenStories');

export type SeenStoriesData = {
	lastUpdated: number;
	users: Record<string, {seenStories: string[]}>;
};

export class SeenStoriesManager {
	private data: SeenStoriesData;
	private readonly filePath: string;
	private saveTimeout: ReturnType<typeof setTimeout> | undefined;
	private readonly configManager: ConfigManager;

	constructor(username: string) {
		this.configManager = ConfigManager.getInstance();
		const storageDir = path.join(
			this.configManager.get('advanced.dataDir'),
			'storage',
		);
		this.filePath = path.join(storageDir, `seen-stories_${username}.json`);
		this.data = {lastUpdated: 0, users: {}};
	}

	async load(): Promise<void> {
		try {
			await fs.mkdir(path.dirname(this.filePath), {recursive: true});
			const content = await fs.readFile(this.filePath, 'utf8');
			this.data = JSON.parse(content) as SeenStoriesData;
		} catch {
			this.data = {lastUpdated: 0, users: {}};
		}
	}

	registerUser(userPk: string): void {
		if (!this.data.users[userPk]) {
			this.data.users[userPk] = {seenStories: []};
			this.scheduleSave();
		}
	}

	registerStoryId(userPk: string, storyId: string): void {
		this.data.users[userPk] ||= {seenStories: []};

		const user = this.data.users[userPk];
		if (user && !user.seenStories.includes(storyId)) {
			user.seenStories.push(storyId);
			this.scheduleSave();
		}
	}

	getSeenStories(userPk: string): string[] {
		return this.data.users[userPk]?.seenStories ?? [];
	}

	private scheduleSave(): void {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}

		this.saveTimeout = setTimeout(() => {
			void this.save();
		}, 500);
	}

	private async save(): Promise<void> {
		try {
			await fs.mkdir(path.dirname(this.filePath), {recursive: true});
			this.data.lastUpdated = Math.floor(Date.now() / 1000);
			const content = JSON.stringify(this.data, null, 2);
			await fs.writeFile(this.filePath, content, {mode: 0o600});
		} catch (error) {
			logger.error('Failed to save seen stories:', error);
		}
	}
}
