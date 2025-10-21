import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';
import {createContextualLogger} from './utils/logger.js';

type LoginConfig = {
	defaultUsername?: string;
	currentUsername?: string;
};

type ChatConfig = {
	layout: string;
	colors: boolean;
};

type PrivacyConfig = {
	invisibleMode: boolean;
};

type FeedConfig = {
	feedType: 'timeline' | 'list';
};

type ImageConfig = {
	protocol: string;
};

type AdvancedConfig = {
	debugMode: boolean;
	dataDir: string;
	usersDir: string;
	cacheDir: string;
	mediaDir: string;
	generatedDir: string;
};

type Config = {
	language: string;
	login: LoginConfig;
	chat: ChatConfig;
	privacy: PrivacyConfig;
	feed: FeedConfig;
	image: ImageConfig;
	advanced: AdvancedConfig;
};

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.instagram-cli');

const DEFAULT_CONFIG: Config = {
	language: 'en',
	login: {
		defaultUsername: undefined,
		currentUsername: undefined,
	},
	chat: {
		layout: 'compact',
		colors: true,
	},
	privacy: {
		invisibleMode: false,
	},
	advanced: {
		debugMode: false,
		dataDir: DEFAULT_DATA_DIR,
		usersDir: path.join(DEFAULT_DATA_DIR, 'users'),
		cacheDir: path.join(DEFAULT_DATA_DIR, 'cache'),
		mediaDir: path.join(DEFAULT_DATA_DIR, 'media'),
		generatedDir: path.join(DEFAULT_DATA_DIR, 'generated'),
	},
	feed: {
		feedType: 'list',
	},
	image: {
		protocol: 'ascii',
	},
};

export class ConfigManager {
	public static getInstance(): ConfigManager {
		ConfigManager.instance ||= new ConfigManager();
		return ConfigManager.instance;
	}

	private static instance: ConfigManager;
	private config: Config;
	private readonly configDir: string;
	private readonly configFile: string;
	private readonly logger = createContextualLogger('ConfigManager');

	private constructor() {
		this.configDir = DEFAULT_CONFIG.advanced.dataDir;
		this.configFile = path.join(this.configDir, 'config.ts.yaml');
		this.config = {...DEFAULT_CONFIG};
	}

	public async initialize(): Promise<void> {
		await this.loadConfig();
	}

	public get<T = string>(keyPath: string, defaultValue?: T): T {
		const keys = keyPath.split('.');
		let value: any = this.config;

		for (const key of keys) {
			if (value && typeof value === 'object' && key in value) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				value = value[key];
			} else {
				return defaultValue as T;
			}
		}

		return value as T;
	}

	public async set(keyPath: string, value: any): Promise<void> {
		const keys = keyPath.split('.');
		let current: any = this.config;

		for (let i = 0; i < keys.length - 1; i++) {
			const key = keys[i];
			if (key && !(key in current)) {
				current[key] = {};
			}

			if (key) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				current = current[key];
			}
		}

		const lastKey = keys.at(-1);
		if (lastKey) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			current[lastKey] = value;
		}

		await this.saveConfig();
	}

	public getConfig(): Config {
		return {...this.config};
	}

	private async loadConfig(): Promise<void> {
		try {
			await fs.mkdir(this.configDir, {recursive: true});

			const configExists = await fs
				.access(this.configFile)
				.then(() => true)
				.catch(() => false);

			if (configExists) {
				const configData = await fs.readFile(this.configFile, 'utf8');
				// eslint-disable-next-line import/no-named-as-default-member
				const loadedConfig = yaml.load(configData) as Partial<Config>;
				this.config = this.mergeConfig(DEFAULT_CONFIG, loadedConfig);
			} else {
				await this.saveConfig();
			}
		} catch (error) {
			this.logger.error('Error loading config:', error);
			this.config = {...DEFAULT_CONFIG};
		}
	}

	private mergeConfig(
		defaultConfig: Config,
		loadedConfig: Partial<Config>,
	): Config {
		return {
			...defaultConfig,
			...loadedConfig,
			login: {...defaultConfig.login, ...loadedConfig.login},
			chat: {...defaultConfig.chat, ...loadedConfig.chat},
			privacy: {...defaultConfig.privacy, ...loadedConfig.privacy},
			feed: {...defaultConfig.feed, ...loadedConfig.feed},
			image: {...defaultConfig.image, ...loadedConfig.image},
			advanced: {...defaultConfig.advanced, ...loadedConfig.advanced},
		};
	}

	private async saveConfig(): Promise<void> {
		try {
			await fs.mkdir(this.configDir, {recursive: true});
			// eslint-disable-next-line import/no-named-as-default-member
			const yamlContent = yaml.dump(this.config);
			await fs.writeFile(this.configFile, yamlContent, 'utf8');
		} catch (error) {
			this.logger.error('Error saving config:', error);
		}
	}
}
