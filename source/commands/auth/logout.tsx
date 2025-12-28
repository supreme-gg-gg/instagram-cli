import React, {useState, useEffect} from 'react';
import {Box, Text} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import {Alert} from '@inkjs/ui';
import {InstagramClient} from '../../client.js';
import {ConfigManager} from '../../config.js';

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

type Properties = {
	readonly args: zod.infer<typeof args>;
};

export default function Logout({args}: Properties) {
	const [message, setMessage] = useState<string | undefined>('Initializing...');
	const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
		'loading',
	);

	useEffect(() => {
		const run = async () => {
			try {
				const config = ConfigManager.getInstance();
				await config.initialize();

				const username = args[0] ?? config.get('login.currentUsername');

				if (!username) {
					setMessage('No active session found to logout from.');
					setStatus('error');
					return;
				}

				setMessage(`Logging out from @${username}...`);
				const client = new InstagramClient(username);
				await client.logout(username);

				setMessage(`Successfully logged out from @${username}`);
				setStatus('success');
			} catch (error) {
				setMessage(
					`Logout error: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
				setStatus('error');
			}
		};

		void run();
	}, [args]);

	if (status === 'error') {
		return (
			<Box>
				<Alert variant="error">{message}</Alert>
			</Box>
		);
	}

	if (status === 'success') {
		return (
			<Box>
				<Alert variant="success">{message}</Alert>
			</Box>
		);
	}

	return <Text>{message}</Text>;
}
