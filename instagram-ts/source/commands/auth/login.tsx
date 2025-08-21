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
		'session' | 'form' | 'challenge' | '2fa' | 'success' | 'error'
	>('session');
	const [twoFactorInfo, setTwoFactorInfo] = useState<any>(null);

	const handleLoginSubmit = async (username: string, password: string) => {
		setMessage(`🔄 Logging in as @${username}...`);
		try {
			const result = await client.login(username, password);
			if (result.success) {
				setMessage(`✅ Logged in as @${result.username}`);
				setMode('success');
			} else if (result.twoFactorInfo) {
				setTwoFactorInfo(result.twoFactorInfo);
				const {totp_two_factor_on} = result.twoFactorInfo;
				const verificationMethod = totp_two_factor_on ? 'TOTP' : 'SMS';
				setMessage(`Enter code received via ${verificationMethod}`);
				setMode('2fa');
			} else if (result.checkpointError) {
				setMessage('Challenge required. Requesting code...');
				await client.startChallenge();
				setMessage('A code has been sent to you. Please enter it below.');
				// redirect to the challenge resolution page
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

	const handle2FASubmit = async (code: string) => {
		setMessage('🔄 Verifying 2FA code...');
		try {
			const result = await client.twoFactorLogin({
				verificationCode: code,
				twoFactorIdentifier: twoFactorInfo.two_factor_identifier,
				totp_two_factor_on: twoFactorInfo.totp_two_factor_on,
			});
			if (result.success) {
				setMessage(`✅ Logged in as @${result.username}`);
				setMode('success');
			} else {
				setMessage(`2FA login failed: ${result.error}`);
				setMode('error');
			}
		} catch (err) {
			setMessage(
				`2FA error: ${err instanceof Error ? err.message : String(err)}`,
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
			// if the user provided a username, we assume they want to log in with username/password
			if (options.username) {
				setMode('form');
				setMessage(null);
				return;
			}

			// otherwise we load the saved session and if failed redirect to pages
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
			const result = await sessionClient.loginBySession();

			if (result.success) {
				setMessage(`✅ Logged in as @${result.username}`);
				setMode('success');
			} else {
				if (result.checkpointError) {
					setMessage('Challenge required. Requesting code...');
					// console.log(client.getInstagramClient().state.checkpoint);
					// console.log(result.checkpointError.response.body);
					await client.startChallenge();
					// console.log(client.getInstagramClient().state.checkpoint);
					setMessage('A code has been sent to you. Please enter it below.');
					setMode('challenge');
				} else if (result.error) {
					// for all other errors, we redirect to the login form, if that also fails we show an error
					setMessage(
						'Could not log in with saved session. Please log in with your username and password.',
					);
					setMode('form');
				}
			}
		};
		run();
	}, [options.username]);

	if (mode === 'error') {
		return <Alert variant="error">{message}</Alert>;
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
	if (mode === 'challenge' || mode === '2fa') {
		return (
			<>
				{message && <Text>{message}</Text>}
				<Box>
					<Text>Enter verification code: </Text>
					<TextInput
						placeholder="Enter code and press Enter"
						onSubmit={mode === '2fa' ? handle2FASubmit : handleChallengeSubmit}
					/>
				</Box>
			</>
		);
	}

	return <Text>Initializing...</Text>;
}
