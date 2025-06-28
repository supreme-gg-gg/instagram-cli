import React from 'react';
import {Text} from 'ink';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import {ConfigManager} from '../config.js';
import fs from 'fs/promises';
import path from 'path';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'type',
				description: 'Type of cleanup: sessions, cache, or all (default: all)',
			}),
		),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function Cleanup({args}: Props) {
	const [result, setResult] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async () => {
			try {
				const configManager = ConfigManager.getInstance();
				await configManager.initialize();

				const cleanupType = args[0] || 'all';
				let output = '';

				if (cleanupType === 'all' || cleanupType === 'sessions') {
					// Clean up current username
					await configManager.set('login.currentUsername', null);
					output += '✅ Config cleaned up\n';

					// Clean up session files
					const usersDir = configManager.get('advanced.usersDir') as string;
					try {
						const userDirs = await fs.readdir(usersDir);
						for (const userDir of userDirs) {
							const sessionFile = path.join(usersDir, userDir, 'session.json');
							try {
								await fs.unlink(sessionFile);
							} catch {}
						}
						output += '✅ Session files cleaned up\n';
					} catch {}
				}

				if (cleanupType === 'all' || cleanupType === 'cache') {
					// Clean up all cache directories
					const cacheDir = configManager.get('advanced.cacheDir') as string;
					const mediaDir = configManager.get('advanced.mediaDir') as string;
					const generatedDir = configManager.get(
						'advanced.generatedDir',
					) as string;
					output += `🔄 Cleaning up cache: ${cacheDir}, ${mediaDir}, ${generatedDir}\n`;

					for (const dir of [cacheDir, mediaDir, generatedDir]) {
						try {
							const files = await fs.readdir(dir);
							for (const file of files) {
								await fs.unlink(path.join(dir, file as string));
							}
						} catch {}
					}
					output += '✅ Cache cleaned up\n';
				}

				output += '✅ Cleanup complete';
				setResult(output);
			} catch (err) {
				setError(
					`Cleanup error: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		})();
	}, [args]);

	if (error) {
		return <Alert variant="error">❌ {error}</Alert>;
	}

	return <Text>{result ? result : 'Cleaning up...'}</Text>;
}
