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

type Props = {
	args: zod.infer<typeof args>;
};

export default function Logout({args}: Props) {
	const [result, setResult] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async () => {
			try {
				const username = args[0];
				const client = new InstagramClient(username || undefined);
				await client.logout(username || undefined);

				if (username) {
					setResult(`✅ Logged out from @${username}`);
				} else {
					setResult('✅ Logged out from current session');
				}
			} catch (err) {
				setError(
					`Logout error: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		})();
	}, [args]);

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	return <Text>{result ? result : 'Logging out...'}</Text>;
}
