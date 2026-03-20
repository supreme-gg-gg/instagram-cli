import React from 'react';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import {TerminalInfoProvider} from 'ink-picture';
import {useInstagramClient} from '../../ui/hooks/use-instagram-client.js';
import PostStoryView from '../../ui/views/post-story-view.js';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'username',
				description:
					'Instagram account username (uses current session if omitted)',
			}),
		),
]);

// No flags in v1; Pastel requires this export even when empty
export const options = zod.object({});

type Properties = {
	readonly args: zod.infer<typeof args>;
};

export default function PostStory({args}: Properties) {
	const {client, isLoading, error} = useInstagramClient(args[0], {
		realtime: false,
	});

	if (isLoading) {
		return <Alert variant="info">Connecting to Instagram…</Alert>;
	}

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	if (!client) {
		return <Alert variant="error">Failed to initialize client.</Alert>;
	}

	return (
		<TerminalInfoProvider>
			<PostStoryView client={client} />
		</TerminalInfoProvider>
	);
}
