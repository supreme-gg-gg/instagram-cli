import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import yaml from 'js-yaml';
import {createContextualLogger} from './utils/logger.js';
import {expandTilde} from './utils/path-utils.js';

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

type NotificationsConfig = {
	desktop: boolean;
	sound: boolean;
};

type ImageConfig = {
	protocol?: string;
};

type AdvancedConfig = {
	debugMode: boolean;
	dataDir: string;
	usersDir?: string;
	cacheDir?: string;
	mediaDir?: string;
	generatedDir?: string;
	logsDir?: string;
	downloadDir?: string;
};

type Config = {
	language: string;
	login: LoginConfig;
	chat: ChatConfig;
	privacy: PrivacyConfig;
	notifications: NotificationsConfig;
	image: ImageConfig;
	advanced: AdvancedConfig;
};

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.instagram-cli');

// Subdirectories of dataDir. Unset ones follow dataDir; relative ones resolve against it.
const DATA_SUBDIRS = {
	usersDir: 'users',
	cacheDir: 'cache',
	mediaDir: 'media',
	generatedDir: 'generated',
	logsDir: 'logs',
	downloadDir: 'downloads',
} as const;

type DataSubdir = keyof typeof DATA_SUBDIRS;

export function resolveDataSubdir(
	advanced: AdvancedConfig,
	key: DataSubdir,
): string {
	return path.resolve(
		expandTilde(advanced.dataDir),
		expandTilde(advanced[key] ?? DATA_SUBDIRS[key]),
	);
}

// Prefer $XDG_CONFIG_HOME/instagram-cli/config.ts.yaml when it exists.
// Per the spec, an unset, empty or relative XDG_CONFIG_HOME means ~/.config.
export function findConfigFile(
	env: NodeJS.ProcessEnv = process.env,
	home: string = os.homedir(),
): string {
	const xdgEnv = env['XDG_CONFIG_HOME'] ?? '';
	const xdgConfigHome = path.isAbsolute(xdgEnv)
		? xdgEnv
		: path.join(home, '.config');
	const xdgFile = path.join(xdgConfigHome, 'instagram-cli', 'config.ts.yaml');
	return existsSync(xdgFile)
		? xdgFile
		: path.join(home, '.instagram-cli', 'config.ts.yaml');
}

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
	notifications: {
		desktop: false,
		sound: false,
	},
	advanced: {
		debugMode: false,
		dataDir: DEFAULT_DATA_DIR,
	},
	image: {},
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
		this.configFile = findConfigFile();
		this.configDir = path.dirname(this.configFile);
		this.config = {...DEFAULT_CONFIG};
	}

	public async initialize(): Promise<void> {
		await this.loadConfig();
	}

	public get<T = string>(keyPath: string, defaultValue?: T): T {
		const keys = keyPath.split('.');
		const [section, key] = keys;
		if (
			section === 'advanced' &&
			keys.length === 2 &&
			key &&
			Object.hasOwn(DATA_SUBDIRS, key)
		) {
			return resolveDataSubdir(this.config.advanced, key as DataSubdir) as T;
		}

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

		const lastKey = keys.at(-1);
		if (lastKey) {
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
				const loadedConfig = yaml.load(configData) as Partial<Config>;
				this.config = this.mergeConfig(DEFAULT_CONFIG, loadedConfig);

				// Older versions wrote the default subdirectories into the file,
				// which pinned them to ~/.instagram-cli. Drop them once.
				let removedDefaults = false;
				for (const [key, name] of Object.entries(DATA_SUBDIRS)) {
					const {advanced} = this.config;
					if (
						advanced[key as DataSubdir] === path.join(DEFAULT_DATA_DIR, name)
					) {
						Reflect.deleteProperty(advanced, key);
						removedDefaults = true;
					}
				}

				if (removedDefaults) await this.saveConfig();
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
			notifications: {
				...defaultConfig.notifications,
				...loadedConfig.notifications,
			},
			image: {...defaultConfig.image, ...loadedConfig.image},
			advanced: {...defaultConfig.advanced, ...loadedConfig.advanced},
		};
	}

	private async saveConfig(): Promise<void> {
		try {
			await fs.mkdir(this.configDir, {recursive: true});
			const yamlContent = yaml.dump(this.config);
			await fs.writeFile(this.configFile, yamlContent, 'utf8');
		} catch (error) {
			this.logger.error('Error saving config:', error);
		}
	}
}
