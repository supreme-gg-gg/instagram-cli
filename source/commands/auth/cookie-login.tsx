import React, {useEffect, useRef, useState} from 'react';
import {Alert} from '@inkjs/ui';
import {Box} from 'ink';
import {
	InstagramClient,
	type BrowserCookies,
	type LoginResult,
} from '../../client.js';
import CookieLoginForm from '../../ui/components/cookie-login-form.js';

export const description =
	'Experimentally log in with browser cookies using masked prompts';

export default function CookieLogin() {
	const clientReference = useRef<InstagramClient | undefined>(undefined);
	clientReference.current ??= new InstagramClient();
	const client = clientReference.current;
	const [result, setResult] = useState<LoginResult>();
	const [isLoading, setIsLoading] = useState(false);

	useEffect(
		() => () => {
			void client.shutdown();
		},
		[client],
	);

	const handleSubmit = async (cookies: BrowserCookies) => {
		setIsLoading(true);
		setResult(undefined);
		const loginResult = await client.loginWithCookies(cookies, {
			initializeRealtime: false,
		});
		setResult(loginResult);
		setIsLoading(false);
	};

	if (isLoading) {
		return <Alert variant="info">Validating browser session...</Alert>;
	}

	if (result?.success) {
		return <Alert variant="success">Logged in as @{result.username}</Alert>;
	}

	return (
		<Box flexDirection="column">
			{result?.error && <Alert variant="error">{result.error}</Alert>}
			<CookieLoginForm
				onSubmit={cookies => {
					void handleSubmit(cookies);
				}}
			/>
		</Box>
	);
}
