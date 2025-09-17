import React from 'react';
import {Text} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import {Alert} from '@inkjs/ui';
import {InstagramClient} from '../../client.js';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'username',
			description: 'Instagram username to switch to',
		}),
	),
]);

type Properties = {
	readonly args: zod.infer<typeof args>;
};

export default function Switch({args}: Properties) {
	const username = args[0];
	const [result, setResult] = React.useState<string | undefined>(undefined);
	const [error, setError] = React.useState<string | undefined>(undefined);

	React.useEffect(() => {
		(async () => {
			try {
				const client = new InstagramClient(username);
				await client.switchUser(username);
				setResult(`✅ Switched to @${username}`);
			} catch (error_) {
				setError(
					`Switch error: ${
						error_ instanceof Error ? error_.message : String(error_)
					}`,
				);
			}
		})();
	}, [username]);

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	return <Text>{result ?? `Switching to @${username}...`}</Text>;
}
