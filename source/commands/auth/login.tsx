import process from 'node:process';
import React, {useState, useEffect} from 'react';
import {Box, Text} from 'ink';
import {Alert, TextInput} from '@inkjs/ui';
import zod from 'zod';
import {option} from 'pastel';
import {type AccountRepositoryLoginErrorResponseTwoFactorInfo} from 'instagram-private-api';
import LoginForm from '../../ui/components/login-form.js';
import {InstagramClient} from '../../client.js';
import {ConfigManager} from '../../config.js';
import {createContextualLogger} from '../../utils/logger.js';

export const description = 'Login to Instagram';

const logger = createContextualLogger('LoginCommand');

export const options = zod.object({
	username: zod
		.boolean()
		.default(false)
		.describe(
			option({
				alias: 'u',
				description: 'Login using username/password (interactive form)',
			}),
		),
	user: zod
		.string()
		.optional()
		.describe(
			option({
				description: 'Username for non-interactive login (requires --pass)',
			}),
		),
	pass: zod
		.string()
		.optional()
		.describe(
			option({
				description: 'Password for non-interactive login (requires --user)',
			}),
		),
	totp: zod
		.string()
		.optional()
		.describe(
			option({
				description: 'TOTP code for non-interactive 2FA login',
			}),
		),
});

type Properties = {
	readonly options: zod.infer<typeof options>;
};

export default function Login({options}: Properties) {
	const [client, setClient] = useState<InstagramClient | undefined>(undefined);
	const [message, setMessage] = useState<string | undefined>('Initializing...');
	const [mode, setMode] = useState<
		'session' | 'form' | 'challenge' | '2fa' | 'success' | 'error'
	>('session');
	const [twoFactorInfo, setTwoFactorInfo] = useState<
		AccountRepositoryLoginErrorResponseTwoFactorInfo | undefined
	>(undefined);

	// Effect to handle client shutdown when the component unmounts
	useEffect(() => {
		return () => {
			if (client) {
				void client.shutdown();
			}
		};
	}, [client]);

	const handleLoginSubmit = async (username: string, password: string) => {
		if (!client) return;

		logger.info(`Login attempt for user: ${username}`);
		setMessage(`Logging in as @${username}...`);
		try {
			const result = await client.login(username, password, {
				initializeRealtime: false,
			});
			if (result.success) {
				setMessage(`Logged in as @${result.username}`);
				setMode('success');
			} else if (result.twoFactorInfo) {
				logger.info('2FA required for login');
				setTwoFactorInfo(result.twoFactorInfo);
				const {totp_two_factor_on} = result.twoFactorInfo;
				const verificationMethod = totp_two_factor_on ? 'TOTP' : 'SMS';
				const smsHint = totp_two_factor_on
					? ''
					: ' If you do not receive a code, go to Instagram Settings → Accounts Center → Password and security → Two-factor authentication → Additional methods, and turn off "Login requests". This can prevent the SMS code from being sent.';
				setMessage(`Enter code received via ${verificationMethod}.${smsHint}`);
				setMode('2fa');
			} else if (result.checkpointError) {
				logger.warn('Checkpoint challenge required');
				setMessage('Challenge required. Requesting code...');
				await client.startChallenge();
				setMessage('A code has been sent to you. Please enter it below.');
				setMode('challenge');
			} else if (result.badPassword) {
				setMessage(
					"You have entered an incorrect username or password. If you're sure your credentials are correct, this might be caused by Instagram's IP blocking system, try again in a few hours.",
				);
				setMode('error');
			} else {
				setMessage(`Login failed: ${result.error}`);
				setMode('error');
			}
		} catch (error) {
			setMessage(
				`Login error: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			setMode('error');
		}
	};

	const handle2FASubmit = async (code: string) => {
		if (!client) return;

		setMessage('Verifying 2FA code...');
		try {
			const result = await client.twoFactorLogin({
				verificationCode: code,
				twoFactorIdentifier: twoFactorInfo!.two_factor_identifier,
				totp_two_factor_on: twoFactorInfo!.totp_two_factor_on,
			});
			if (result.success) {
				setMessage(`Logged in as @${result.username}`);
				setMode('success');
			} else {
				setMessage(`2FA login failed: ${result.error}`);
				setMode('error');
			}
		} catch (error) {
			setMessage(
				`2FA error: ${error instanceof Error ? error.message : String(error)}`,
			);
			setMode('error');
		}
	};

	const handleChallengeSubmit = async (code: string) => {
		if (!client) return;

		setMessage('Verifying code...');
		try {
			const result = await client.sendChallengeCode(code);
			if (result.success) {
				setMessage(`Logged in as @${result.username}`);
				setMode('success');
			} else {
				setMessage(`Challenge failed: ${result.error}`);
				setMode('error');
			}
		} catch (error) {
			setMessage(
				`Challenge error: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			setMode('error');
		}
	};

	useEffect(() => {
		const run = async () => {
			// Non-interactive mode: --user and --pass provided
			if (options.user && options.pass) {
				const nonInteractiveClient = new InstagramClient();
				setClient(nonInteractiveClient);
				setMessage(`Logging in as @${options.user}...`);

				const result = await nonInteractiveClient.login(
					options.user,
					options.pass,
					{initializeRealtime: false},
				);

				if (result.success) {
					setMessage(`Logged in as @${result.username}`);
					setMode('success');
					process.exit(0);
					return;
				}

				if (result.twoFactorInfo) {
					if (options.totp) {
						setMessage('Verifying TOTP code...');
						const tfaResult = await nonInteractiveClient.twoFactorLogin({
							verificationCode: options.totp,
							twoFactorIdentifier: result.twoFactorInfo.two_factor_identifier,
							totp_two_factor_on: result.twoFactorInfo.totp_two_factor_on,
						});

						if (tfaResult.success) {
							setMessage(`Logged in as @${tfaResult.username}`);
							setMode('success');
							process.exit(0);
							return;
						}

						setMessage(`2FA login failed: ${tfaResult.error}`);
						setMode('error');
						process.exit(1);
						return;
					}

					setMessage(
						'2FA required but no --totp code provided. Pass --totp <code> for non-interactive 2FA.',
					);
					setMode('error');
					process.exit(1);
					return;
				}

				if (result.badPassword) {
					setMessage('Incorrect username or password.');
					setMode('error');
					process.exit(1);
					return;
				}

				setMessage(`Login failed: ${result.error}`);
				setMode('error');
				process.exit(1);
				return;
			}

			// If the user provided the -u flag, show interactive form
			if (options.username) {
				setClient(new InstagramClient());
				setMode('form');
				setMessage(undefined);
				return;
			}

			// Otherwise we load the saved session and if failed redirect to form
			setMessage('Trying to log in with saved session...');
			const config = ConfigManager.getInstance();
			await config.initialize();
			const currentUsername = config.get('login.currentUsername');

			if (!currentUsername) {
				setMessage(
					'No saved session found. Please log in with your username and password.',
				);
				setClient(new InstagramClient());
				setMode('form');
				return;
			}

			const sessionClient = new InstagramClient(currentUsername);
			setClient(sessionClient);
			const result = await sessionClient.loginBySession({
				initializeRealtime: false,
			});

			if (result.success) {
				setMessage(`Logged in as @${result.username}`);
				setMode('success');
			} else if (result.checkpointError) {
				setMessage('Challenge required. Requesting code...');
				await sessionClient.startChallenge();
				setMessage('A code has been sent to you. Please enter it below.');
				setMode('challenge');
			} else if (result.error) {
				setMessage(
					'Could not log in with saved session. Please log in with your username and password.',
				);
				setClient(new InstagramClient());
				setMode('form');
			}
		};

		void run();
	}, [options.username, options.user, options.pass, options.totp]);

	if (mode === 'error') {
		return (
			<Box>
				<Alert variant="error">{message}</Alert>
			</Box>
		);
	}

	if (mode === 'success') {
		return (
			<Box>
				<Alert variant="success">{message}</Alert>
			</Box>
		);
	}

	if (mode === 'session') {
		return (
			<Box>
				<Alert variant="info">{message}</Alert>
			</Box>
		);
	}

	if (mode === 'form') {
		return (
			<>
				{message && <Text>{message}</Text>}
				<LoginForm
					onSubmit={(username, password) => {
						void handleLoginSubmit(username, password);
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
