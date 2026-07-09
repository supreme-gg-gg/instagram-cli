import fs from 'node:fs/promises';
import path, {dirname} from 'node:path';
import process from 'node:process';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {Buffer} from 'node:buffer';
import {fileURLToPath} from 'node:url';
import notifier from 'node-notifier';
import {readPackageUp} from 'read-package-up';
import {ConfigManager} from '../config.js';
import {createContextualLogger} from './logger.js';

const logger = createContextualLogger('DesktopNotifier');

export type DesktopNotificationOptions = {
	readonly title: string;
	readonly message: string;
	readonly iconUrl?: string;
};

let soundFilePromise: Promise<string | undefined> | undefined;

/**
 * Resolves the bundled notification chime, relative to the package root
 * (not `import.meta.url`'s own directory, since bundling flattens file layout).
 */
async function getSoundFilePath(): Promise<string | undefined> {
	soundFilePromise ??= (async () => {
		const scriptDir = dirname(fileURLToPath(import.meta.url));
		const package_ = await readPackageUp({cwd: scriptDir});
		if (!package_) {
			return undefined;
		}

		return path.join(
			dirname(package_.path),
			'resource',
			'sounds',
			'notification.wav',
		);
	})();

	return soundFilePromise;
}

async function playNotificationSound(): Promise<void> {
	const soundFile = await getSoundFilePath();
	if (!soundFile) {
		return;
	}

	if (process.platform === 'linux') {
		spawn('paplay', [soundFile], {stdio: 'ignore'}).on('error', () => {
			// PulseAudio/PipeWire unavailable; try ALSA directly instead.
			spawn('aplay', [soundFile], {stdio: 'ignore'}).on('error', () => {
				// No known audio player available; skip the sound silently.
			});
		});
		return;
	}

	if (process.platform === 'darwin') {
		spawn('afplay', [soundFile], {stdio: 'ignore'}).on('error', () => {
			// afplay is always present on macOS, but skip silently just in case.
		});
	}

	// On Windows, node-notifier's own `sound: true` option (used below) covers this.
}

/**
 * Downloads and caches a remote avatar so it can be used as a local notification
 * icon (OS notifiers require a local file path, not a URL).
 */
async function resolveIconPath(iconUrl?: string): Promise<string | undefined> {
	if (!iconUrl) {
		return undefined;
	}

	try {
		const config = ConfigManager.getInstance();
		const iconsDir = path.join(
			config.get('advanced.cacheDir'),
			'notification-icons',
		);
		const hash = createHash('sha1').update(iconUrl).digest('hex');
		const iconPath = path.join(iconsDir, `${hash}.jpg`);

		const isCached = await fs
			.access(iconPath)
			.then(() => true)
			.catch(() => false);
		if (isCached) {
			return iconPath;
		}

		const response = await fetch(iconUrl);
		if (!response.ok) {
			return undefined;
		}

		await fs.mkdir(iconsDir, {recursive: true});
		await fs.writeFile(iconPath, Buffer.from(await response.arrayBuffer()));
		return iconPath;
	} catch (error) {
		logger.error('Failed to download notification icon', error);
		return undefined;
	}
}

/**
 * Sends an OS-level desktop notification (e.g. via notify-send on Linux,
 * Notification Center on macOS, or toast on Windows).
 * No-op if the user has disabled `notifications.desktop` in their config.
 */
export async function sendDesktopNotification({
	title,
	message,
	iconUrl,
}: DesktopNotificationOptions): Promise<void> {
	const config = ConfigManager.getInstance();
	if (!config.get<boolean>('notifications.desktop', true)) {
		return;
	}

	const soundEnabled = config.get<boolean>('notifications.sound', true);
	const icon = await resolveIconPath(iconUrl);

	notifier.notify(
		{
			title,
			message,
			icon,
			// Linux has no native sound support in node-notifier; handled separately below.
			sound: soundEnabled && process.platform !== 'linux',
		},
		error => {
			if (error) {
				logger.error('Failed to send desktop notification', error);
			}
		},
	);

	if (soundEnabled) {
		void playNotificationSound();
	}
}
