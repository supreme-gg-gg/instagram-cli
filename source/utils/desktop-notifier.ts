import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import notifier from 'node-notifier';
import {ConfigManager} from '../config.js';
import {createContextualLogger} from './logger.js';

const logger = createContextualLogger('DesktopNotifier');

export type DesktopNotificationOptions = {
	readonly title: string;
	readonly message: string;
	readonly iconUrl?: string;
};

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
			sound: soundEnabled,
		},
		error => {
			if (error) {
				logger.error('Failed to send desktop notification', error);
			}
		},
	);
}
