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
				const cleanupType = args[0] || 'all';
				let output = '';

				if (cleanupType === 'all' || cleanupType === 'sessions') {
					await InstagramClient.cleanupSessions();
					output += '✅ Sessions cleaned up\n';
				}

				if (cleanupType === 'all' || cleanupType === 'cache') {
					await InstagramClient.cleanupCache();
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
