import React from 'react';
import {Text} from 'ink';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import LoginForm from '../../ui/components/LoginForm.js';
import {InstagramClient} from '../../client.js';

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
	_args: zod.infer<typeof args>;
};

export default function Login(_props: Props) {
	const [result, setResult] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	if (error) {
		return <Alert variant="error">❌ {error}</Alert>;
	}

	if (result) {
		return <Text>{result}</Text>;
	}

	return (
		<LoginForm
			onSubmit={async (username, password, verificationCode) => {
				try {
					setResult(`🔄 Logging in as @${username}...`);
					const client = new InstagramClient();
					const loginResult = await client.login(
						username,
						password,
						verificationCode,
					);
					if (loginResult.success) {
						setResult(`✅ Logged in as @${loginResult.username}`);
					} else {
						setError(`Login failed: ${loginResult.error}`);
					}
				} catch (err) {
					setError(
						`Login error: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			}}
		/>
	);
}
