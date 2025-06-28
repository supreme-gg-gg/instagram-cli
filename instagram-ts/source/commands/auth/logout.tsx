import React from 'react';
import {Text} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import {ConfigManager} from '../../config.js';
import {Alert} from '@inkjs/ui';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'username',
				description: 'Username to logout from (optional)',
			}),
		),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function Logout({args}: Props) {
	const [result, setResult] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async () => {
			try {
				const configManager = ConfigManager.getInstance();
				await configManager.initialize();

				const username = args[0];
				if (username) {
					// Logout specific user
					await configManager.set(`login.sessions.${username}`, null);
					setResult(`✅ Logged out from @${username}`);
				} else {
					// Logout current user
					await configManager.set('login.currentUsername', null);
					setResult('✅ Logged out from current session');
				}
			} catch (err) {
				setError(
					`Logout error: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		})();
	}, [args]);

	if (error) {
		return <Alert variant="error">❌ {error}</Alert>;
	}

	return <Text>{result ? result : 'Logging out...'}</Text>;
}
