import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';

interface LoginConfig {
	defaultUsername?: string;
	currentUsername?: string;
}

interface ChatConfig {
	layout: string;
	colors: boolean;
}

interface SchedulingConfig {
	defaultScheduleDuration: string;
}

interface PrivacyConfig {
	invisibleMode: boolean;
}

interface AdvancedConfig {
	debugMode: boolean;
	dataDir: string;
	usersDir: string;
	cacheDir: string;
	mediaDir: string;
	generatedDir: string;
}

interface Config {
	language: string;
	login: LoginConfig;
	chat: ChatConfig;
	scheduling: SchedulingConfig;
	privacy: PrivacyConfig;
	advanced: AdvancedConfig;
}

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
	scheduling: {
		defaultScheduleDuration: '01:00', // 1 hour
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
};

export class ConfigManager {
	private static instance: ConfigManager;
	private config: Config;
	private configDir: string;
	private configFile: string;

	private constructor() {
		this.configDir = DEFAULT_CONFIG.advanced.dataDir;
		this.configFile = path.join(this.configDir, 'config.ts.yaml');
		this.config = {...DEFAULT_CONFIG};
	}

	public static getInstance(): ConfigManager {
		if (!ConfigManager.instance) {
			ConfigManager.instance = new ConfigManager();
		}
		return ConfigManager.instance;
	}

	public async initialize(): Promise<void> {
		await this.loadConfig();
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
				const loadedConfig = yaml.load(configData) as Partial<Config>;
				this.config = this.mergeConfig(DEFAULT_CONFIG, loadedConfig);
			} else {
				await this.saveConfig();
			}
		} catch (error) {
			console.error('Error loading config:', error);
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
			scheduling: {...defaultConfig.scheduling, ...loadedConfig.scheduling},
			privacy: {...defaultConfig.privacy, ...loadedConfig.privacy},
			advanced: {...defaultConfig.advanced, ...loadedConfig.advanced},
		};
	}

	private async saveConfig(): Promise<void> {
		try {
			await fs.mkdir(this.configDir, {recursive: true});
			const yamlContent = yaml.dump(this.config);
			await fs.writeFile(this.configFile, yamlContent, 'utf8');
		} catch (error) {
			console.error('Error saving config:', error);
		}
	}

	public get<T>(keyPath: string, defaultValue?: T): T {
		const keys = keyPath.split('.');
		let value: any = this.config;

		for (const key of keys) {
			if (value && typeof value === 'object' && key in value) {
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
				current = current[key];
			}
		}

		const lastKey = keys[keys.length - 1];
		if (lastKey) {
			current[lastKey] = value;
		}
		await this.saveConfig();
	}

	public getConfig(): Config {
		return {...this.config};
	}
}
