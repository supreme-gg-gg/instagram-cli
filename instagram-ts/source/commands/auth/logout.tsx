import React from 'react';
import {Text} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import {Alert} from '@inkjs/ui';
import {InstagramClient} from '../../client.js';

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
	readonly logOutArgs: zod.infer<typeof args>;
};

export default function Logout({logOutArgs}: Properties) {
	const [result, setResult] = React.useState<string | undefined>(undefined);
	const [error, setError] = React.useState<string | undefined>(undefined);

	React.useEffect(() => {
		(async () => {
			try {
				const username = logOutArgs[0];
				const client = new InstagramClient(username ?? undefined);
				await client.logout(username ?? undefined);

				if (username) {
					setResult(`✅ Logged out from @${username}`);
				} else {
					setResult('✅ Logged out from current session');
				}
			} catch (error_) {
				setError(
					`Logout error: ${
						error_ instanceof Error ? error_.message : String(error_)
					}`,
				);
			}
		})();
	}, [logOutArgs]);

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	return <Text>{result ?? 'Logging out...'}</Text>;
}
