import React from 'react';
import {Box} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import {Alert} from '@inkjs/ui';
import ChatView from '../ui/views/chat-view.js';
import {ClientContext} from '../ui/context/client-context.js';
import {useInstagramClient} from '../ui/hooks/use-instagram-client.js';
import AltScreen from '../ui/components/alt-screen.js';

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

type Properties = {
	readonly args: zod.infer<typeof args>;
};

export default function Chat({args}: Properties) {
	const {client, isLoading, error} = useInstagramClient(args[0]);

	if (isLoading) {
		return (
			<Box>
				<Alert variant="info">Starting Instagram Chat...</Alert>
			</Box>
		);
	}

	if (error) {
		return (
			<Box>
				<Alert variant="error">{error}</Alert>
			</Box>
		);
	}

	if (!client) {
		return (
			<Box>
				<Alert variant="error">Failed to initialize client</Alert>
			</Box>
		);
	}

	return (
		<AltScreen>
			<ClientContext.Provider value={client}>
				<ChatView />
			</ClientContext.Provider>
		</AltScreen>
	);
}
