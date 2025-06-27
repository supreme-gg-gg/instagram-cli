import fs from 'fs/promises';
import path from 'path';
import {ConfigManager} from './config.js';

export async function cleanup(deleteAll = false): Promise<void> {
	const configManager = ConfigManager.getInstance();
	await configManager.initialize();

	// Clear current username
	await configManager.set('login.currentUsername', null);
	console.log('✅ Config cleaned up');

	// Clean up session files
	const usersDir = configManager.get<string>('advanced.usersDir');
	try {
		const userDirs = await fs.readdir(usersDir);
		for (const userDir of userDirs) {
			const userPath = path.join(usersDir, userDir);
			const stat = await fs.stat(userPath);
			if (stat.isDirectory()) {
				const sessionFile = path.join(userPath, 'session.json');
				try {
					await fs.unlink(sessionFile);
				} catch (error) {
					// File might not exist, which is fine
				}
			}
		}
		console.log('✅ Session files cleaned up');
	} catch (error) {
		// Users directory might not exist
		console.log('ℹ️  No session files to clean up');
	}

	if (!deleteAll) {
		return;
	}

	// Clean up all cache directories
	const cacheDir = configManager.get<string>('advanced.cacheDir');
	const mediaDir = configManager.get<string>('advanced.mediaDir');
	const generatedDir = configManager.get<string>('advanced.generatedDir');

	console.log(`🔄 Cleaning up cache directories...`);

	for (const dir of [cacheDir, mediaDir, generatedDir]) {
		try {
			const dirExists = await fs
				.access(dir)
				.then(() => true)
				.catch(() => false);
			if (dirExists) {
				const files = await fs.readdir(dir);
				for (const file of files) {
					const filePath = path.join(dir, file);
					const stat = await fs.stat(filePath);
					if (stat.isFile()) {
						await fs.unlink(filePath);
					}
				}
			}
		} catch (error) {
			// Directory might not exist or be empty
		}
	}

	console.log('✅ Cleanup complete');
}
