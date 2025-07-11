import React from 'react';
import {Box, Text} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import {InstagramClient} from '../client.js';
import {ConfigManager} from '../config.js';
import {SessionManager} from '../session.js';
import {Alert} from '@inkjs/ui';

import { formatUsernamesInText } from '../utils/notifications.js';

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
	const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
	const [error, setError] = React.useState<string | null>(null);
	const [notifications, setNotifications] = React.useState<any>(null);

	React.useEffect(() => {
		(async () => {
			try {
				const config = ConfigManager.getInstance();
				await config.initialize();

				let targetUsername = args[0];
				if (!targetUsername) {
					targetUsername =
						config.get<string>('login.currentUsername') ||
						config.get<string>('login.defaultUsername');
				}

				if (!targetUsername) {
					setError('No username specified. Please login first or specify a username.');
					setStatus('error');
					return;
				}

				const sessionManager = new SessionManager(targetUsername);
				if (!(await sessionManager.sessionExists())) {
					setError(`No session found for ${targetUsername}. Please login first.`);
					setStatus('error');
					return;
				}

				const client = new InstagramClient(targetUsername);
				await client.loginBySession();

				const newsInbox = await client.getInstagramClient().news.inbox();

				setNotifications(newsInbox);
				setStatus('ready');
			} catch (err) {
				setError(`Notification error: ${err instanceof Error ? err.message : String(err)}`);
				setStatus('error');
			}
		})();
	}, [args]);

	if (status === 'loading') {
		return <Alert variant="info">🚀 Fetching Instagram notifications...</Alert>;
	}

	if (status === 'error') {
		return <Alert variant="error">❌ {error}</Alert>;
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Text color="cyan" bold>
				📣 Instagram Activity Dashboard
			</Text>
			<Text>
				🔔 Total Updates:{' '}
				{(notifications?.new_stories?.length || 0) + (notifications?.old_stories?.length || 0)}
			</Text>
			{notifications?.new_stories?.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<Text color="yellow">🆕 Recent Activity:</Text>
					{notifications.new_stories.map((u: any, i: number) => {
						const ts = new Date(u.args.timestamp * 1000).toLocaleString();
						return (
							<Box key={i} flexDirection="column" marginLeft={3} marginBottom={1}>
								<Text>• {formatUsernamesInText(u.args.rich_text)}</Text>
								<Text dimColor>{ts}</Text>
							</Box>
						);
					})}
				</Box>
			)}
			{notifications?.old_stories?.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<Text color="yellow">📜 Activity:</Text>
					{notifications.old_stories.slice(0, 10 - notifications.new_stories?.length).map((u: any, i: number) => { //TODO: only when new_stories are less than 10
						const ts = new Date(u.args.timestamp * 1000).toLocaleString();
						return (
							<Box key={i} flexDirection="column" marginLeft={3} marginBottom={1}>
								<Text>• {formatUsernamesInText(u.args.rich_text)}</Text>
								<Text dimColor>{ts}</Text>
							</Box>
						);
					})}
				</Box>
			)}
			{!notifications?.new_stories?.length && !notifications?.old_stories?.length && (
				<Text color="gray">No recent activity found.</Text>
			)}
		</Box>
	);
}
