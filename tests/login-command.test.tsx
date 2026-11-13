/* eslint-disable @typescript-eslint/no-unsafe-call */

import process from 'node:process';
import React from 'react';
import test from 'ava';
import {render} from 'ink-testing-library';
import Login, {options as loginOptions} from '../source/commands/auth/login.js';
import {InstagramClient} from '../source/client.js';
import {getLogger} from '../source/utils/logger.js';

const delay = async (ms: number): Promise<void> =>
	new Promise(resolve => {
		setTimeout(resolve, ms);
	});

const validSecret = 'JBSWY3DPEHPK3PXP'; // Base32 secret

test.serial(
	'non-interactive: does not auto-submit TOTP for security_code challenges',
	async t => {
		const originalLogin = InstagramClient.prototype.login;
		const originalSubmit = InstagramClient.prototype.submitLoginCode;

		let submitCalled = false;
		InstagramClient.prototype.login = async () => ({
			success: false,
			verificationMessage:
				'Instagram sent a security code to your email or phone. Enter it below.',
			verificationMethod: 'security_code',
		});
		InstagramClient.prototype.submitLoginCode = async () => {
			submitCalled = true;
			return {success: true, username: 'testuser'};
		};

		try {
			const {lastFrame, unmount} = render(
				<Login
					options={{
						refresh: false,
						username: 'testuser',
						password: 'password123',
						totpSecret: validSecret,
						sms: false,
						verbose: false,
					}}
				/>,
			);

			await delay(100);

			t.false(
				submitCalled,
				'submitLoginCode should not be called for security_code challenge',
			);
			const frame = lastFrame() ?? '';
			t.true(
				frame.includes('Verification code required'),
				`Expected verification message, got: ${frame}`,
			);
			t.false(
				frame.includes('Logged in as @testuser'),
				'Should not have logged in with wrong TOTP',
			);
			unmount();
		} finally {
			InstagramClient.prototype.login = originalLogin;
			InstagramClient.prototype.submitLoginCode = originalSubmit;
		}
	},
);

test.serial(
	'non-interactive: auto-submits generated TOTP for totp challenges',
	async t => {
		const originalLogin = InstagramClient.prototype.login;
		const originalSubmit = InstagramClient.prototype.submitLoginCode;

		let submittedCode = '';
		InstagramClient.prototype.login = async () => ({
			success: false,
			verificationMessage: 'Enter the 6-digit code from your Authenticator App',
			verificationMethod: 'totp',
		});
		InstagramClient.prototype.submitLoginCode = async code => {
			submittedCode = code;
			return {success: true, username: 'testuser'};
		};

		try {
			const {lastFrame, unmount} = render(
				<Login
					options={{
						refresh: false,
						username: 'testuser',
						password: 'password123',
						totpSecret: validSecret,
						sms: false,
						verbose: false,
					}}
				/>,
			);

			await delay(100);

			t.is(
				submittedCode.length,
				6,
				'Should have submitted a 6-digit TOTP code',
			);
			const frame = lastFrame() ?? '';
			t.true(
				frame.includes('Logged in as @testuser'),
				`Expected success message, got: ${frame}`,
			);
			unmount();
		} finally {
			InstagramClient.prototype.login = originalLogin;
			InstagramClient.prototype.submitLoginCode = originalSubmit;
		}
	},
);

test.serial(
	'interactive: does not auto-submit TOTP for security_code challenges',
	async t => {
		const originalLogin = InstagramClient.prototype.login;
		const originalSubmit = InstagramClient.prototype.submitLoginCode;

		let submitCalled = false;
		InstagramClient.prototype.login = async () => ({
			success: false,
			verificationMessage:
				'Instagram sent a security code to your email or phone. Enter it below.',
			verificationMethod: 'security_code',
		});
		InstagramClient.prototype.submitLoginCode = async () => {
			submitCalled = true;
			return {success: true, username: 'interactive_user'};
		};

		try {
			const {lastFrame, stdin, unmount} = render(
				<Login
					options={{
						refresh: true,
						totpSecret: validSecret,
						sms: false,
						verbose: false,
					}}
				/>,
			);

			await delay(50);
			// Submit username in LoginForm
			stdin.write('interactive_user');
			await delay(50);
			stdin.write('\r');
			await delay(50);
			// Submit password in LoginForm
			stdin.write('mypassword');
			await delay(50);
			stdin.write('\r');
			await delay(150);

			t.false(
				submitCalled,
				'submitLoginCode should not be called automatically for security_code in interactive mode',
			);
			const frame = lastFrame() ?? '';
			t.true(
				frame.includes('Instagram sent a security code to your email or phone'),
				`Expected prompt for security code, got: ${frame}`,
			);
			unmount();
		} finally {
			InstagramClient.prototype.login = originalLogin;
			InstagramClient.prototype.submitLoginCode = originalSubmit;
		}
	},
);

test.serial(
	'interactive: auto-submits generated TOTP for totp challenges',
	async t => {
		const originalLogin = InstagramClient.prototype.login;
		const originalSubmit = InstagramClient.prototype.submitLoginCode;

		let submittedCode = '';
		InstagramClient.prototype.login = async () => ({
			success: false,
			verificationMessage: 'Enter 6-digit Authenticator code',
			verificationMethod: 'totp',
		});
		InstagramClient.prototype.submitLoginCode = async code => {
			submittedCode = code;
			return {success: true, username: 'interactive_user'};
		};

		try {
			const {lastFrame, stdin, unmount} = render(
				<Login
					options={{
						refresh: true,
						totpSecret: validSecret,
						sms: false,
						verbose: false,
					}}
				/>,
			);

			await delay(50);
			stdin.write('interactive_user');
			await delay(50);
			stdin.write('\r');
			await delay(50);
			stdin.write('mypassword');
			await delay(50);
			stdin.write('\r');
			await delay(150);

			t.is(submittedCode.length, 6, 'Should have submitted 6-digit TOTP code');
			const frame = lastFrame() ?? '';
			t.true(
				frame.includes('Logged in as @interactive_user'),
				`Expected success message, got: ${frame}`,
			);
			unmount();
		} finally {
			InstagramClient.prototype.login = originalLogin;
			InstagramClient.prototype.submitLoginCode = originalSubmit;
		}
	},
);

test('options: verbose flag defines -v alias', t => {
	const optionDescription = String(
		loginOptions.shape.verbose.description ?? '',
	);
	const json = optionDescription.replace('__pastel_option_config__', '');
	const parsed = JSON.parse(json) as {alias?: string};
	t.is(parsed.alias, 'v');
});

test.serial(
	'regression: does not stream verbose logs when --verbose is not passed and INSTAGRAM_CLI_VERBOSE is unset',
	async t => {
		const originalLogin = InstagramClient.prototype.login;
		const originalDebug = process.env['DEBUG'];
		const originalVerbose = process.env['INSTAGRAM_CLI_VERBOSE'];

		// Emulate logger setting DEBUG env var internally
		process.env['DEBUG'] = 'ig:*';
		delete process.env['INSTAGRAM_CLI_VERBOSE'];

		InstagramClient.prototype.login = async () => {
			getLogger().info('regression test event: internal debug log');
			return {success: true, username: 'testuser'};
		};

		try {
			const {lastFrame, unmount} = render(
				<Login
					options={{
						refresh: false,
						username: 'testuser',
						password: 'password123',
						sms: false,
						verbose: false,
					}}
				/>,
			);

			await delay(100);

			const frame = lastFrame() ?? '';
			t.false(
				frame.includes('Verbose Logs'),
				`Expected "Verbose Logs" section not to be rendered, got: ${frame}`,
			);
			t.false(
				frame.includes('regression test event: internal debug log'),
				`Expected internal log message not to be displayed, got: ${frame}`,
			);
			unmount();
		} finally {
			InstagramClient.prototype.login = originalLogin;
			if (originalDebug === undefined) {
				delete process.env['DEBUG'];
			} else {
				process.env['DEBUG'] = originalDebug;
			}

			if (originalVerbose === undefined) {
				delete process.env['INSTAGRAM_CLI_VERBOSE'];
			} else {
				process.env['INSTAGRAM_CLI_VERBOSE'] = originalVerbose;
			}
		}
	},
);

test.serial('streams verbose logs when --verbose is true', async t => {
	const originalLogin = InstagramClient.prototype.login;

	InstagramClient.prototype.login = async () => {
		getLogger().info('verbose test event: live streaming line');
		return {success: true, username: 'testuser'};
	};

	try {
		const {lastFrame, unmount} = render(
			<Login
				options={{
					refresh: false,
					username: 'testuser',
					password: 'password123',
					sms: false,
					verbose: true,
				}}
			/>,
		);

		await delay(100);

		const frame = lastFrame() ?? '';
		t.true(
			frame.includes('Verbose Logs'),
			`Expected "Verbose Logs" section to be rendered, got: ${frame}`,
		);
		t.true(
			frame.includes('verbose test event: live streaming line'),
			`Expected live log message to be displayed, got: ${frame}`,
		);
		unmount();
	} finally {
		InstagramClient.prototype.login = originalLogin;
	}
});
