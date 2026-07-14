import fs from 'node:fs/promises';
import path, {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {fileURLToPath} from 'node:url';
import notifier from 'node-notifier';
import playSound from 'play-sound';
import {readPackageUp} from 'read-package-up';
import {ConfigManager} from '../config.js';
import {createContextualLogger} from './logger.js';

const logger = createContextualLogger('DesktopNotifier');
const player = playSound();

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

	player.play(soundFile, error => {
		if (error) {
			// No known audio player available on this system; skip silently.
			logger.debug(`Failed to play notification sound: ${error.message}`);
		}
	});
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
	if (!config.get<boolean>('notifications.desktop', false)) {
		return;
	}

	const soundEnabled = config.get<boolean>('notifications.sound', false);
	const icon = await resolveIconPath(iconUrl);

	notifier.notify(
		{
			title,
			message,
			icon,
			// Sound is played separately via play-sound; node-notifier's own
			// `sound` option is unreliable across platforms and OS versions.
			sound: false,
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
