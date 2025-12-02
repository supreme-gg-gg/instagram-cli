import {ConfigManager} from './config.js';
import {InstagramClient} from './client.js';

export async function cleanup(deleteAll = false): Promise<void> {
	const configManager = ConfigManager.getInstance();
	await configManager.initialize();

	// Clear current username
	await configManager.set('login.currentUsername', null);

	// Clean up session files
	try {
		await InstagramClient.cleanupSessions();
	} catch {
		// Users directory might not exist
	}

	if (!deleteAll) {
		return;
	}

	// Clean up all cache directories
	await InstagramClient.cleanupCache();

	// Clean up logs directory
	try {
		await InstagramClient.cleanupLogs();
	} catch {
		// Logs directory might not exist
	}
}
