import React from 'react';
import {Text} from 'ink';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import {InstagramClient} from '../client.js';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'type',
				description:
					'Type of cleanup: sessions, cache, logs, or all (default: all)',
			}),
		),
]);

type Properties = {
	readonly args: zod.infer<typeof args>;
};

export default function Cleanup({args}: Properties) {
	const [result, setResult] = React.useState<string | undefined>(undefined);
	const [error, setError] = React.useState<string | undefined>(undefined);

	React.useEffect(() => {
		(async () => {
			try {
				const cleanupType = args[0] ?? 'all';
				let output = '';

				if (cleanupType === 'all' || cleanupType === 'sessions') {
					await InstagramClient.cleanupSessions();
					output += '✅ Sessions cleaned up\n';
				}

				if (cleanupType === 'all' || cleanupType === 'cache') {
					await InstagramClient.cleanupCache();
					output += '✅ Cache cleaned up\n';
				}

				if (cleanupType === 'all' || cleanupType === 'logs') {
					await InstagramClient.cleanupLogs();
					output += '✅ Logs cleaned up\n';
				}

				output += '✅ Cleanup complete';
				setResult(output);
			} catch (error_) {
				setError(
					`Cleanup error: ${
						error_ instanceof Error ? error_.message : String(error_)
					}`,
				);
			}
		})();
	}, [args]);

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	return <Text>{result ?? 'Cleaning up...'}</Text>;
}
