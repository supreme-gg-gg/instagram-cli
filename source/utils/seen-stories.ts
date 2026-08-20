import fs from 'node:fs/promises';
import path from 'node:path';
import {ConfigManager} from '../config.js';
import {createContextualLogger} from './logger.js';

const logger = createContextualLogger('SeenStories');

// Seen state is tracked per user as the `taken_at` of the last viewed story,
// mirroring the API's per-reel `seen` value. Everything else is derived:
//   - all stories seen   -> seen >= latest_reel_media
//   - first unseen index -> first story with taken_at > seen
// Timestamps use the API `taken_at` unit (seconds).
export type SeenStoriesData = {
	lastUpdated: number;
	users: Record<string, number>;
};

export class SeenStoriesManager {
	private data: SeenStoriesData;
	private readonly filePath: string;
	private saveTimeout: ReturnType<typeof setTimeout> | undefined;
	private readonly configManager: ConfigManager;
	private readonly memoryOnly: boolean;

	constructor(username: string, baseDir?: string, memoryOnly = false) {
		this.memoryOnly = memoryOnly;
		this.configManager = ConfigManager.getInstance();
		if (memoryOnly) {
			this.filePath = '';
		} else {
			const defaultDataDir = this.configManager.get('advanced.dataDir');
			const dataDir = baseDir ?? defaultDataDir;
			const storageDir = path.join(dataDir, 'storage');
			this.filePath = path.join(storageDir, `seen-stories_${username}.json`);
		}

		this.data = {lastUpdated: 0, users: {}};
	}

	async load(): Promise<void> {
		if (this.memoryOnly) {
			return;
		}

		try {
			await fs.mkdir(path.dirname(this.filePath), {recursive: true});
			const content = await fs.readFile(this.filePath, 'utf8');
			this.data = JSON.parse(content) as SeenStoriesData;
		} catch {
			this.data = {lastUpdated: 0, users: {}};
		}
	}

	registerSeenTimestamp(userPk: string, takenAt: number): void {
		if (takenAt > (this.data.users[userPk] ?? 0)) {
			this.data.users[userPk] = takenAt;
			this.scheduleSave();
		}
	}

	getSeenTimestamp(userPk: string): number {
		return this.data.users[userPk] ?? 0;
	}

	areAllStoriesSeen(userPk: string, latestReelMedia: number): boolean {
		if (latestReelMedia <= 0) return false;
		return this.getSeenTimestamp(userPk) >= latestReelMedia;
	}

	getFirstUnseenIndex(
		userPk: string,
		stories: ReadonlyArray<{taken_at: number}>,
	): number {
		const seen = this.getSeenTimestamp(userPk);
		const index = stories.findIndex(story => story.taken_at > seen);
		return index === -1 ? 0 : index;
	}

	syncUsers(currentlyActiveUserPks: string[]): void {
		const activeSet = new Set(currentlyActiveUserPks);
		const newUsers: Record<string, number> = {};

		for (const [userPk, seen] of Object.entries(this.data.users)) {
			if (activeSet.has(userPk)) {
				newUsers[userPk] = seen;
			}
		}

		if (Object.keys(newUsers).length !== Object.keys(this.data.users).length) {
			this.data.users = newUsers;
			this.scheduleSave();
		}
	}

	async flush(): Promise<void> {
		if (this.memoryOnly) {
			return;
		}

		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
			this.saveTimeout = undefined;
		}

		await this.save();
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
