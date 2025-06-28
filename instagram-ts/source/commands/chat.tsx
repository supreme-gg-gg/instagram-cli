import React from 'react';
import {Box} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import ChatView from '../ui/views/ChatView.js';
import {InstagramClient} from '../client.js';
import {ClientContext} from '../ui/context/ClientContext.js';
import {ConfigManager} from '../config.js';
import {SessionManager} from '../session.js';
import {Alert} from '@inkjs/ui';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'username',
				description: 'Username to login with (optional)',
			}),
		),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function Chat({args}: Props) {
	const [error, setError] = React.useState<string | null>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [client, setClient] = React.useState<InstagramClient | null>(null);

	React.useEffect(() => {
		(async () => {
			try {
				const config = ConfigManager.getInstance();
				await config.initialize();

				// Determine which username to use
				let targetUsername = args[0];
				if (!targetUsername) {
					targetUsername =
						config.get<string>('login.currentUsername') ||
						config.get<string>('login.defaultUsername');
				}

				if (!targetUsername) {
					setError(
						'No username specified. Please login first or specify a username.',
					);
					setIsLoading(false);
					return;
				}

				// Check if session exists
				const sessionManager = new SessionManager(targetUsername);
				const sessionExists = await sessionManager.sessionExists();

				if (!sessionExists) {
					setError(
						`No session found for ${targetUsername}. Please login first.`,
					);
					setIsLoading(false);
					return;
				}

				// Create and restore client session
				const instagramClient = new InstagramClient(targetUsername);
				await instagramClient.loginBySession();
				setClient(instagramClient);
				setIsLoading(false);
			} catch (err) {
				setError(
					`Failed to start chat: ${
						err instanceof Error ? err.message : String(err)
					}`,
				);
				setIsLoading(false);
			}
		})();
	}, [args]);

	if (isLoading) {
		return (
			<Box>
				<Alert variant="info">🚀 Starting Instagram Chat...</Alert>
			</Box>
		);
	}

	if (error) {
		return (
			<Box>
				<Alert variant="error">❌ {error}</Alert>
			</Box>
		);
	}

	if (!client) {
		return (
			<Box>
				<Alert variant="error">❌ Failed to initialize client</Alert>
			</Box>
		);
	}

	return (
		<ClientContext.Provider value={client}>
			<ChatView />
		</ClientContext.Provider>
	);
}
