import React, {useState, useMemo, useEffect} from 'react';
import {Box, Text} from 'ink';
import {Alert, TextInput} from '@inkjs/ui';
import zod from 'zod';
import {option} from 'pastel';
import LoginForm from '../../ui/components/LoginForm.js';
import {InstagramClient} from '../../client.js';
import {ConfigManager} from '../../config.js';

export const options = zod.object({
	username: zod
		.boolean()
		.default(false)
		.describe(
			option({
				alias: 'u',
				description: 'Login using username/password',
			}),
		),
});

type Props = {
	options: zod.infer<typeof options>;
};

export default function Login({options}: Props) {
	const client = useMemo(() => new InstagramClient(), []);
	const [message, setMessage] = useState<string | null>('Initializing...');
	const [mode, setMode] = useState<
		'session' | 'form' | 'challenge' | 'success' | 'error'
	>('session');

	const handleLoginSubmit = async (username: string, password: string) => {
		setMessage(`🔄 Logging in as @${username}...`);
		try {
			const result = await client.login(username, password);
			if (result.success) {
				setMessage(`✅ Logged in as @${result.username}`);
				setMode('success');
			} else if (result.checkpointError) {
				setMessage('Challenge required. Requesting code...');
				await client.startChallenge();
				setMessage('A code has been sent to you. Please enter it below.');
				setMode('challenge');
			} else {
				setMessage(`Login failed: ${result.error}`);
				setMode('error');
			}
		} catch (err) {
			setMessage(
				`Login error: ${err instanceof Error ? err.message : String(err)}`,
			);
			setMode('error');
		}
	};

	const handleChallengeSubmit = async (code: string) => {
		setMessage('🔄 Verifying code...');
		try {
			const result = await client.sendChallengeCode(code);
			if (result.success) {
				setMessage(`✅ Logged in as @${result.username}`);
				setMode('success');
			} else {
				setMessage(`Challenge failed: ${result.error}`);
				setMode('error');
			}
		} catch (err) {
			setMessage(
				`Challenge error: ${err instanceof Error ? err.message : String(err)}`,
			);
			setMode('error');
		}
	};

	useEffect(() => {
		const run = async () => {
			if (options.username) {
				setMode('form');
				setMessage(null);
			} else {
				setMessage('🔄 Trying to log in with saved session...');
				const config = ConfigManager.getInstance();
				await config.initialize();
				const currentUsername = config.get<string>('login.currentUsername');

				if (!currentUsername) {
					setMessage(
						'No saved session found. Please log in with your username and password.',
					);
					setMode('form');
					return;
				}

				const sessionClient = new InstagramClient(currentUsername);
				try {
					const result = await sessionClient.loginBySession();
					if (result.success) {
						setMessage(`✅ Logged in as @${result.username}`);
						setMode('success');
					} else {
						setMessage(
							`Could not log in with saved session: ${result.error}. Please log in with your username and password.`,
						);
						setMode('form');
					}
				} catch (e) {
					if (e instanceof Error) {
						setMessage(
							`Session login error: ${e.message}. Please log in with your username and password.`,
						);
					} else {
						setMessage(
							`Session login error: ${String(
								e,
							)}. Please log in with your username and password.`,
						);
					}
					setMode('form');
				}
			}
		};
		run();
	}, []);

	if (mode === 'error') {
		return <Alert variant="error">❌ {message}</Alert>;
	}
	if (mode === 'success' || mode === 'session') {
		return <Text>{message}</Text>;
	}
	if (mode === 'form') {
		return (
			<>
				{message && <Text>{message}</Text>}
				<LoginForm
					onSubmit={(username, password) => {
						handleLoginSubmit(username, password);
					}}
				/>
			</>
		);
	}
	if (mode === 'challenge') {
		return (
			<>
				{message && <Text>{message}</Text>}
				<Box>
					<Text>Enter verification code: </Text>
					<TextInput
						placeholder="Enter code and press Enter"
						onSubmit={handleChallengeSubmit}
					/>
				</Box>
			</>
		);
	}

	return <Text>Initializing...</Text>;
}
