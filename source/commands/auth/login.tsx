import process from 'node:process';
import React, {useState, useEffect} from 'react';
import {Box, Text} from 'ink';
import {Alert, TextInput} from '@inkjs/ui';
import zod from 'zod';
import {option} from 'pastel';
import LoginForm from '../../ui/components/login-form.js';
import {InstagramClient} from '../../client.js';
import {ConfigManager} from '../../config.js';
import {createContextualLogger, getLogger} from '../../utils/logger.js';
import {generateTotp, isValidBase32Secret} from '../../utils/totp.js';

export const description = 'Login to Instagram';

const logger = createContextualLogger('LoginCommand');

export const options = zod.object({
	refresh: zod
		.boolean()
		.default(false)
		.describe(
			option({
				alias: 'r',
				description: 'Force re-login with username/password (interactive form)',
			}),
		),
	username: zod
		.string()
		.optional()
		.describe(
			option({
				alias: 'u',
				description: 'Username for non-interactive login (requires --password)',
			}),
		),
	password: zod
		.string()
		.optional()
		.describe(
			option({
				alias: 'p',
				description: 'Password for non-interactive login (requires --username)',
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
	totpSecret: zod
		.string()
		.optional()
		.describe(
			option({
				description:
					'Base32 2FA secret to automatically generate TOTP code (or set INSTAGRAM_CLI_TOTP_SECRET)',
			}),
		),
	sms: zod
		.boolean()
		.default(false)
		.describe(
			option({
				description:
					'Request 2FA code via SMS to your phone instead of authenticator app',
			}),
		),
	verbose: zod
		.boolean()
		.default(false)
		.describe(
			option({
				description: 'Display live verbose log output directly in the terminal',
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
	const [logLines, setLogLines] = useState<string[]>([]);

	const isVerbose =
		options.verbose ||
		Boolean(process.env['DEBUG']) ||
		Boolean(process.env['INSTAGRAM_CLI_VERBOSE']);

	useEffect(() => {
		if (isVerbose) {
			getLogger().enableVerbose();
		}

		const unsubscribe = getLogger().onLog(entry => {
			const time = entry.timestamp.split('T')[1]?.split('.')[0] ?? '';
			const context = entry.context ? `[${entry.context}] ` : '';
			const line = `${time} ${entry.level.toUpperCase()} ${context}${entry.message}`;
			setLogLines(previous => [...previous.slice(-25), line]);
		});

		return unsubscribe;
	}, [isVerbose]);

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
		// Leave the form so a repeated Enter cannot start a concurrent login
		setMode('session');
		try {
			const result = await client.login(username, password, {
				initializeRealtime: false,
				otpMethod: options.sms ? 'sms' : undefined,
			});
			if (result.success) {
				setMessage(`Logged in as @${result.username}`);
				setMode('success');
			} else if (result.verificationMessage) {
				const isTotpChallenge = result.verificationMethod === 'totp';
				const secret =
					options.totpSecret ?? process.env['INSTAGRAM_CLI_TOTP_SECRET'];
				if (isTotpChallenge && secret && isValidBase32Secret(secret)) {
					const generated = generateTotp(secret);
					logger.info(
						'Automatically submitting TOTP code generated from secret',
					);
					setMessage('Generated TOTP from secret. Verifying code...');
					await handle2FASubmit(generated);
					return;
				}

				logger.info('Verification code required for login');
				setMessage(result.verificationMessage);
				setMode('2fa');
			} else if (result.checkpointError) {
				logger.warn('Checkpoint challenge required');
				setMessage('Challenge required. Requesting code...');
				await client.startChallenge();
				setMessage('A code has been sent to you. Please enter it below.');
				setMode('challenge');
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
		setMode('session');
		try {
			const result = await client.submitLoginCode(code);
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
		setMode('session');
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
			// Non-interactive mode: --username and --password provided
			if (options.username && options.password) {
				const nonInteractiveClient = new InstagramClient();
				setClient(nonInteractiveClient);
				setMessage(`Logging in as @${options.username}...`);

				const result = await nonInteractiveClient.login(
					options.username,
					options.password,
					{
						initializeRealtime: false,
						otpMethod: options.sms ? 'sms' : undefined,
					},
				);

				if (result.success) {
					setMessage(`Logged in as @${result.username}`);
					setMode('success');
					return;
				}

				if (result.verificationMessage) {
					const isTotpChallenge = result.verificationMethod === 'totp';
					const code =
						options.totp ??
						(() => {
							if (!isTotpChallenge) {
								return undefined;
							}

							const secret =
								options.totpSecret ?? process.env['INSTAGRAM_CLI_TOTP_SECRET'];
							if (secret && isValidBase32Secret(secret)) {
								logger.info(
									'Automatically generating TOTP code from secret for non-interactive login',
								);
								return generateTotp(secret);
							}

							return undefined;
						})();

					if (code) {
						setMessage('Verifying 2FA code...');
						const tfaResult = await nonInteractiveClient.submitLoginCode(code);

						if (tfaResult.success) {
							setMessage(`Logged in as @${tfaResult.username}`);
							setMode('success');
							return;
						}

						setMessage(`2FA login failed: ${tfaResult.error}`);
						setMode('error');
						return;
					}

					setMessage(
						isTotpChallenge
							? '2FA required but no --totp code or valid --totp-secret provided. Pass --totp <code> or --totp-secret <secret> (or set INSTAGRAM_CLI_TOTP_SECRET).'
							: `Verification code required: ${result.verificationMessage}`,
					);
					setMode('error');
					return;
				}

				setMessage(`Login failed: ${result.error}`);
				setMode('error');
				return;
			}

			// If the user provided the --refresh flag, show interactive form
			if (options.refresh) {
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
	}, [
		options.refresh,
		options.username,
		options.password,
		options.totp,
		options.totpSecret,
		options.sms,
		options.verbose,
	]);

	const renderVerboseLogs = (isError = false) => {
		if (!isVerbose && !isError) return null;
		if (logLines.length === 0) return null;

		return (
			<Box
				flexDirection="column"
				marginTop={1}
				borderStyle="round"
				borderColor={isError ? 'red' : 'gray'}
				paddingX={1}
			>
				<Text bold color={isError ? 'red' : 'cyan'}>
					{isError ? 'Recent Diagnostics' : 'Verbose Logs'} (Log file:{' '}
					{getLogger().getLogFilePath()}):
				</Text>
				{logLines.slice(-10).map((line, index) => {
					let color = 'gray';
					if (line.includes('ERROR')) color = 'red';
					else if (line.includes('WARN')) color = 'yellow';
					else if (line.includes('INFO')) color = 'white';

					return (
						<Text key={index} color={color}>
							{line}
						</Text>
					);
				})}
			</Box>
		);
	};

	if (mode === 'error') {
		return (
			<Box flexDirection="column">
				<Alert variant="error">{message}</Alert>
				<Box marginTop={1}>
					<Text color="gray">
						Detailed session log saved to:{' '}
						<Text bold color="white">
							{getLogger().getLogFilePath()}
						</Text>
					</Text>
				</Box>
				{renderVerboseLogs(true)}
			</Box>
		);
	}

	if (mode === 'success') {
		return (
			<Box flexDirection="column">
				<Alert variant="success">{message}</Alert>
				{renderVerboseLogs()}
			</Box>
		);
	}

	if (mode === 'session') {
		return (
			<Box flexDirection="column">
				<Alert variant="info">{message}</Alert>
				{renderVerboseLogs()}
			</Box>
		);
	}

	if (mode === 'form') {
		return (
			<Box flexDirection="column">
				{message && <Text>{message}</Text>}
				<LoginForm
					onSubmit={(username, password) => {
						void handleLoginSubmit(username, password);
					}}
				/>
				{renderVerboseLogs()}
			</Box>
		);
	}

	if (mode === 'challenge' || mode === '2fa') {
		return (
			<Box flexDirection="column">
				{message && <Text>{message}</Text>}
				<Box>
					<Text>Enter verification code: </Text>
					<TextInput
						placeholder="Enter code and press Enter"
						onSubmit={mode === '2fa' ? handle2FASubmit : handleChallengeSubmit}
					/>
				</Box>
				{renderVerboseLogs()}
			</Box>
		);
	}

	return <Text>Initializing...</Text>;
}
