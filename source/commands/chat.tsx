import React from 'react';
import {Box} from 'ink';
import zod from 'zod';
import {argument, option} from 'pastel';
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

export const options = zod.object({
	search: zod
		.string()
		.optional()
		.describe(
			option({
				alias: 's',
				description:
					'Search for a chat by username or title. If a match is found, directly enter the chat.',
			}),
		),
	searchmode: zod
		.enum(['username', 'title'])
		.optional()
		.describe(
			option({
				alias: 'm',
				description:
					'Specify the search mode when using the --search option. Defaults to username.',
			}),
		),
});

type Properties = {
	readonly args: zod.infer<typeof args>;
	readonly options: zod.infer<typeof options>;
};

export default function Chat({args, options}: Properties) {
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
				<ChatView
					initialSearchQuery={options.search}
					initialSearchMode={options.searchmode}
				/>
			</ClientContext.Provider>
		</AltScreen>
	);
}
