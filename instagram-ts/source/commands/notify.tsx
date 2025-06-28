import React from 'react';
import {Text} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import {InstagramClient} from '../client.js';
import {ConfigManager} from '../config.js';
import {Alert} from '@inkjs/ui';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'username',
				description: 'Username to fetch notifications for (optional)',
			}),
		),
]);

type Props = {
	args: zod.infer<typeof args>;
};

export default function Notify({args}: Props) {
	const [result, setResult] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);

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
					return;
				}

				const client = new InstagramClient(targetUsername);
				await client.loginBySession();
				const notifications = await client.getInstagramClient().news.inbox();
				setResult(`✅ Fetched notifications for @${targetUsername}`);
				console.log(notifications);
			} catch (err) {
				setError(
					`Notification error: ${
						err instanceof Error ? err.message : String(err)
					}`,
				);
			}
		})();
	}, [args]);

	if (error) {
		return <Alert variant="error">❌ {error}</Alert>;
	}

	return <Text>{result ? result : 'Fetching notifications...'}</Text>;
}
