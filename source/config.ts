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
	dataDir?: string;
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

const APP_NAME = 'instagram-cli';
const CONFIG_FILE_NAME = 'config.ts.yaml';

// Subdirectories of dataDir. Unset ones use the layout default; relative ones
// resolve against dataDir.
const DATA_SUBDIRS = {
	usersDir: 'users',
	cacheDir: 'cache',
	mediaDir: 'media',
	generatedDir: 'generated',
	logsDir: 'logs',
	downloadDir: 'downloads',
} as const;

type DataSubdir = keyof typeof DATA_SUBDIRS;

export type PathLayout = {
	configFile: string;
	dataDir: string;
	/** Defaults for unset subdirectories that live outside dataDir */
	subdirDefaults: Partial<Record<DataSubdir, string>>;
};

// Per the XDG spec, an unset, empty or relative variable means the default.
function xdgBaseDir(
	env: NodeJS.ProcessEnv,
	name: string,
	fallback: string,
): string {
	const value = env[name] ?? '';
	return path.isAbsolute(value) ? value : fallback;
}

/**
 * Where config and data live. An existing ~/.instagram-cli/config.ts.yaml keeps
 * everything under ~/.instagram-cli (legacy mode); otherwise XDG locations are used.
 */
export function resolvePathLayout(
	env: NodeJS.ProcessEnv = process.env,
	home: string = os.homedir(),
): PathLayout {
	const legacyDir = path.join(home, `.${APP_NAME}`);
	const legacyFile = path.join(legacyDir, CONFIG_FILE_NAME);
	if (existsSync(legacyFile)) {
		return {configFile: legacyFile, dataDir: legacyDir, subdirDefaults: {}};
	}

	const base = (name: string, ...fallback: string[]) =>
		path.join(xdgBaseDir(env, name, path.join(home, ...fallback)), APP_NAME);
	return {
		configFile: path.join(base('XDG_CONFIG_HOME', '.config'), CONFIG_FILE_NAME),
		dataDir: base('XDG_DATA_HOME', '.local', 'share'),
		subdirDefaults: {
			cacheDir: base('XDG_CACHE_HOME', '.cache'),
			logsDir: path.join(base('XDG_STATE_HOME', '.local', 'state'), 'logs'),
		},
	};
}

export function resolveDataDir(
	advanced: AdvancedConfig,
	layout: PathLayout,
): string {
	return advanced.dataDir
		? path.resolve(expandTilde(advanced.dataDir))
		: layout.dataDir;
}

export function resolveDataSubdir(
	advanced: AdvancedConfig,
	key: DataSubdir,
	layout: PathLayout,
): string {
	const dataDir = resolveDataDir(advanced, layout);
	const value = advanced[key];
	if (value) return path.resolve(dataDir, expandTilde(value));
	return layout.subdirDefaults[key] ?? path.join(dataDir, DATA_SUBDIRS[key]);
}

/**
 * Older versions wrote dataDir (~/.instagram-cli) and the default subdirectories
 * (~/.instagram-cli/<name>) into the config file. Drop them so they follow the
 * layout again: in legacy mode that is still ~/.instagram-cli, and a config moved
 * to XDG follows the XDG paths. Subdirectories are only dropped while dataDir is
 * the old default: anyone who set a custom dataDir back then still has their
 * sessions under ~/.instagram-cli. Returns whether anything was removed.
 */
export function dropPinnedDefaults(
	advanced: AdvancedConfig,
	home: string = os.homedir(),
): boolean {
	const legacyDir = path.join(home, `.${APP_NAME}`);
	if (advanced.dataDir !== undefined && advanced.dataDir !== legacyDir) {
		return false;
	}

	let removed = false;
	if (advanced.dataDir === legacyDir) {
		Reflect.deleteProperty(advanced, 'dataDir');
		removed = true;
	}

	for (const [key, name] of Object.entries(DATA_SUBDIRS)) {
		if (advanced[key as DataSubdir] === path.join(legacyDir, name)) {
			Reflect.deleteProperty(advanced, key);
			removed = true;
		}
	}

	return removed;
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
	private readonly layout: PathLayout;
	private readonly configDir: string;
	private readonly configFile: string;
	private readonly logger = createContextualLogger('ConfigManager');

	private constructor() {
		this.layout = resolvePathLayout();
		this.configFile = this.layout.configFile;
		this.configDir = path.dirname(this.configFile);
		this.config = {...DEFAULT_CONFIG};
	}

	public async initialize(): Promise<void> {
		await this.loadConfig();
	}

	public get<T = string>(keyPath: string, defaultValue?: T): T {
		const keys = keyPath.split('.');
		const [section, key] = keys;
		if (section === 'advanced' && keys.length === 2 && key) {
			if (key === 'dataDir') {
				return resolveDataDir(this.config.advanced, this.layout) as T;
			}

			if (Object.hasOwn(DATA_SUBDIRS, key)) {
				return resolveDataSubdir(
					this.config.advanced,
					key as DataSubdir,
					this.layout,
				) as T;
			}
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
				if (dropPinnedDefaults(this.config.advanced)) await this.saveConfig();
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
