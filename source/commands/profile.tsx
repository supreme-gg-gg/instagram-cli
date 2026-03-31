import React, {useState, useEffect} from 'react';
import {Alert} from '@inkjs/ui';
import {Text} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import {TerminalInfoProvider} from 'ink-picture';
import type {ProfileInfo} from '../types/instagram.js';
import {useInstagramClient} from '../ui/hooks/use-instagram-client.js';
import {useImageProtocol} from '../ui/hooks/use-image-protocol.js';
import ProfileView from '../ui/views/profile-view.js';
import {createContextualLogger} from '../utils/logger.js';

const logger = createContextualLogger('ProfileCommand');

export const description = 'Fetch and display Instagram profile';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'username',
			description: 'Instagram username to look up (without @)',
		}),
	),
]);

type Props = {
	readonly args: zod.infer<typeof args>;
};

export default function Profile({args: [username]}: Props) {
	const {
		client,
		isLoading: clientLoading,
		error: clientError,
	} = useInstagramClient(undefined, {realtime: false});
	const imageProtocol = useImageProtocol();
	const [profile, setProfile] = useState<ProfileInfo | undefined>();
	const [error, setError] = useState<string | undefined>();

	useEffect(() => {
		if (!client) return;

		const fetchProfile = async () => {
			try {
				const result = await client.getUserProfile(username);
				setProfile(result);
			} catch (error_) {
				const message =
					error_ instanceof Error ? error_.message : String(error_);
				logger.error(`Failed to fetch profile: ${message}`);
				setError(message);
			}
		};

		void fetchProfile();
	}, [client, username]);

	if (clientLoading) {
		return <Alert variant="info">Logging in...</Alert>;
	}

	if (clientError) {
		return <Alert variant="error">{clientError}</Alert>;
	}

	if (error) {
		return (
			<Alert variant="error">
				Could not find user &quot;{username}&quot;: {error}
			</Alert>
		);
	}

	if (!profile) {
		return <Text dimColor>Looking up @{username}...</Text>;
	}

	return (
		<TerminalInfoProvider>
			<ProfileView profile={profile} imageProtocol={imageProtocol} />
		</TerminalInfoProvider>
	);
}
