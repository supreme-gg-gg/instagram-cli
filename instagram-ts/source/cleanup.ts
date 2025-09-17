import {ConfigManager} from './config.js';
import {InstagramClient} from './client.js';

export async function cleanup(deleteAll = false): Promise<void> {
	const configManager = ConfigManager.getInstance();
	await configManager.initialize();

	// Clear current username
	await configManager.set('login.currentUsername', null);
	console.log('✅ Config cleaned up');

	// Clean up session files
	try {
		await InstagramClient.cleanupSessions();
		console.log('✅ Session files cleaned up');
	} catch (error) {
		// Users directory might not exist
		console.log('ℹ️  No session files to clean up');
	}

	if (!deleteAll) {
		return;
	}

	// Clean up all cache directories
	console.log(`🔄 Cleaning up cache directories...`);
	await InstagramClient.cleanupCache();
	console.log('✅ Cleanup complete');
}
