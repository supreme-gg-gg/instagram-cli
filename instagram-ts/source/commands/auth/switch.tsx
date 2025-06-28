import React from 'react';
import {Text} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import {ConfigManager} from '../../config.js';
import {SessionManager} from '../../session.js';
import {Alert} from '@inkjs/ui';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'username',
			description: 'Instagram username to switch to',
		}),
	),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function Switch({args}: Props) {
	const username = args[0];
	const [result, setResult] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async () => {
			try {
				const configManager = ConfigManager.getInstance();
				await configManager.initialize();
				const sessionManager = new SessionManager(username);
				const sessionExists = await sessionManager.sessionExists();

				if (!sessionExists) {
					setError(
						`Cannot switch to @${username}. No session found.\nTry logging in with @${username} first.`,
					);
					return;
				}

				await configManager.set('login.currentUsername', username);
				setResult(`✅ Switched to @${username}`);
			} catch (err) {
				setError(
					`Switch error: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		})();
	}, [username]);

	if (error) {
		return <Alert variant="error">❌ {error}</Alert>;
	}

	return <Text>{result ? result : `Switching to @${username}...`}</Text>;
}
