import React from 'react';
import {Box} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import ChatView from '../ui/views/ChatView.js';
import {ClientContext} from '../ui/context/ClientContext.js';
import {Alert} from '@inkjs/ui';
import {useInstagramClient} from '../ui/hooks/useInstagramClient.js';

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
	const {client, isLoading, error} = useInstagramClient(args[0]);

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
