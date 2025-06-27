import meow from 'meow';
import React from 'react';
import {render} from 'ink';
import {InstagramClient} from './auth.js';
import {ConfigManager} from './config.js';
import {SessionManager} from './session.js';
import ChatInterface from './components/ChatInterface.js';
import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';

const cli = meow(
	`
	Usage
	  $ instagram <command> [options]

	Commands
	  login                   Login to Instagram
	  logout [username]       Logout from Instagram
	  switch <username>       Switch between accounts
	  chat [username]         Open chat interface (TUI)
	  cleanup [--all]         Cleanup cache and sessions
	  config <key> [value]    Get or set configuration values

	Options
	  --username, -u          Login with username (will prompt for password)
	  --help                  Show help
	  --version               Show version

	Examples
	  $ instagram login
	  $ instagram login --username myusername
	  $ instagram logout
	  $ instagram switch otherusername
	  $ instagram chat
	  $ instagram chat myusername
	  $ instagram cleanup --all
	  $ instagram config login.currentUsername
`,
	{
		importMeta: import.meta,
		flags: {
			username: {
				type: 'boolean',
				shortFlag: 'u',
			},
			all: {
				type: 'boolean',
			},
		},
	},
);

function createReadlineInterface() {
	return readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
}

function promptAsync(question: string, hideInput = false): Promise<string> {
	return new Promise(resolve => {
		const rl = createReadlineInterface();

		if (hideInput) {
			// Hide input for password
			const stdin = process.stdin;
			stdin.setRawMode(true);

			process.stdout.write(question);
			let password = '';

			const onData = (char: Buffer) => {
				const c = char.toString();

				if (c === '\r' || c === '\n') {
					// Enter key pressed
					stdin.setRawMode(false);
					stdin.removeListener('data', onData);
					process.stdout.write('\n');
					rl.close();
					resolve(password);
				} else if (c === '\u0003') {
					// Ctrl+C
					stdin.setRawMode(false);
					stdin.removeListener('data', onData);
					rl.close();
					process.exit(0);
				} else if (c === '\u007f' || c === '\b') {
					// Backspace
					if (password.length > 0) {
						password = password.slice(0, -1);
						process.stdout.write('\b \b');
					}
				} else if (c.charCodeAt(0) >= 32) {
					// Printable character
					password += c;
					process.stdout.write('*');
				}
			};

			stdin.on('data', onData);
		} else {
			rl.question(question, answer => {
				rl.close();
				resolve(answer);
			});
		}
	});
}

async function confirmAsync(question: string): Promise<boolean> {
	const answer = await promptAsync(`${question} (y/N): `);
	return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

async function loginCommand(useUsername = false): Promise<void> {
	const configManager = ConfigManager.getInstance();
	await configManager.initialize();

	const currentUsername = configManager.get<string>('login.currentUsername');

	// Try session login first if we have a current username
	if (currentUsername && !useUsername) {
		try {
			const client = new InstagramClient(currentUsername);
			const result = await client.loginBySession();

			if (result.success) {
				console.log(`✅ Logged in as ${result.username}`);
				return;
			} else {
				console.log(
					'❌ Cannot log in via session, logging in with username and password.',
				);
			}
		} catch (error) {
			console.log(
				'❌ Session login failed, proceeding with username/password login.',
			);
		}
	}

	// Prompt for credentials
	const username = await promptAsync('Username: ');
	const password = await promptAsync('Password: ', true);

	let verificationCode = '';
	const use2FA = await confirmAsync(
		'Do you use 2FA (2 Factor Authentication)?',
	);
	if (use2FA) {
		verificationCode = await promptAsync(
			'Provide your verification code (From The Auth App, SMS not supported): ',
		);
	}

	console.log(`🔄 Logging in as ${username}...`);

	const client = new InstagramClient();
	const result = await client.login(username, password, verificationCode);

	if (result.success) {
		console.log(`✅ Logged in as ${result.username}`);
	} else {
		console.error(`❌ Login failed: ${result.error}`);
		process.exit(1);
	}
}

async function logoutCommand(username?: string): Promise<void> {
	const configManager = ConfigManager.getInstance();
	await configManager.initialize();

	if (!username) {
		username = configManager.get<string>('login.currentUsername');
	}

	if (!username) {
		console.log('❌ No active session found.');
		return;
	}

	try {
		const client = new InstagramClient(username);

		// Try to login by session first to verify the session exists
		const sessionResult = await client.loginBySession();
		if (sessionResult.success) {
			console.log(`🔄 Logging out ${username}...`);
			await client.logout();

			// Clear default username if it matches
			const defaultUsername = configManager.get<string>(
				'login.defaultUsername',
			);
			if (defaultUsername === username) {
				await configManager.set('login.defaultUsername', null);
			}

			console.log(`✅ Logged out @${username}.`);
		} else {
			console.log(`❌ @${username} not logged in.`);
		}
	} catch (error) {
		console.log(`❌ @${username} not logged in.`);
	}
}

async function switchAccountCommand(username: string): Promise<void> {
	const configManager = ConfigManager.getInstance();
	await configManager.initialize();

	const sessionManager = new SessionManager(username);
	const sessionExists = await sessionManager.sessionExists();

	if (!sessionExists) {
		console.log(`❌ Cannot switch to @${username}. No session found.`);
		console.log(`Try logging in with @${username} first.`);
		return;
	}

	await configManager.set('login.currentUsername', username);
	console.log(`✅ Switched to @${username}`);
}

async function cleanupCommand(deleteAll = false): Promise<void> {
	const configManager = ConfigManager.getInstance();
	await configManager.initialize();

	// Clear current username
	await configManager.set('login.currentUsername', null);
	console.log('✅ Config cleaned up');

	// Clean up session files
	const usersDir = configManager.get<string>('advanced.usersDir');
	try {
		const userDirs = await fs.readdir(usersDir);
		for (const userDir of userDirs) {
			const sessionFile = path.join(usersDir, userDir, 'session.json');
			try {
				await fs.unlink(sessionFile);
			} catch (error) {
				// File might not exist, which is fine
			}
		}
		console.log('✅ Session files cleaned up');
	} catch (error) {
		// Users directory might not exist
	}

	if (!deleteAll) {
		return;
	}

	// Clean up all cache directories
	const cacheDir = configManager.get<string>('advanced.cacheDir');
	const mediaDir = configManager.get<string>('advanced.mediaDir');
	const generatedDir = configManager.get<string>('advanced.generatedDir');

	console.log(
		`🔄 Cleaning up cache: ${cacheDir}, ${mediaDir}, ${generatedDir}`,
	);

	for (const dir of [cacheDir, mediaDir, generatedDir]) {
		try {
			const files = await fs.readdir(dir);
			for (const file of files) {
				await fs.unlink(path.join(dir, file));
			}
		} catch (error) {
			// Directory might not exist or be empty
		}
	}

	console.log('✅ Cleanup complete');
}

async function configCommand(key: string, value?: string): Promise<void> {
	const configManager = ConfigManager.getInstance();
	await configManager.initialize();

	if (value === undefined) {
		// Get config value
		const currentValue = configManager.get(key);
		console.log(`${key}: ${currentValue ?? 'null'}`);
	} else {
		// Set config value
		await configManager.set(key, value === 'null' ? null : value);
		console.log(`✅ Set ${key} to: ${value}`);
	}
}

async function chatCommand(username?: string): Promise<void> {
	const config = ConfigManager.getInstance();
	await config.initialize();

	// Determine which username to use
	let targetUsername = username;
	if (!targetUsername) {
		targetUsername =
			config.get<string>('login.currentUsername') ||
			config.get<string>('login.defaultUsername');
	}

	if (!targetUsername) {
		console.error(
			'❌ No username specified. Please login first or specify a username.',
		);
		console.log('💡 Use: instagram login');
		process.exit(1);
	}

	// Check if session exists
	const sessionManager = new SessionManager(targetUsername);
	const sessionExists = await sessionManager.sessionExists();

	if (!sessionExists) {
		console.error(
			`❌ No session found for ${targetUsername}. Please login first.`,
		);
		console.log(
			`💡 Use: instagram login ${
				targetUsername !== config.get<string>('login.currentUsername')
					? '--username ' + targetUsername
					: ''
			}`,
		);
		process.exit(1);
	}

	console.log('🚀 Starting Instagram Chat...');
	console.log(`👤 Logged in as: ${targetUsername}`);
	console.log("💡 Press Ctrl+C or 'q' to quit");
	console.log('');

	// Render the Ink-based chat interface
	const app = render(
		React.createElement(ChatInterface, {username: targetUsername}),
	);
	await app.waitUntilExit();
}

export async function runCli(): Promise<void> {
	const [command, ...args] = cli.input;

	try {
		switch (command) {
			case 'login':
				await loginCommand(cli.flags.username);
				break;
			case 'logout':
				await logoutCommand(args[0]);
				break;
			case 'switch':
				if (!args[0]) {
					console.error('❌ Username required for switch command');
					process.exit(1);
				}
				await switchAccountCommand(args[0]);
				break;
			case 'chat':
				await chatCommand(args[0]);
				break;
			case 'cleanup':
				await cleanupCommand(cli.flags.all);
				break;
			case 'config':
				if (!args[0]) {
					console.error('❌ Config key required');
					process.exit(1);
				}
				await configCommand(args[0], args[1]);
				break;
			case 'chat':
				await chatCommand(args[0]);
				break;
			default:
				// Show main CLI info (like the Python version)
				console.log('📱 InstagramCLI (TypeScript)');
				console.log('🚀 The end of brainrot and doomscrolling is here.');
				console.log('');
				console.log("💡 Type 'instagram --help' to see available commands.");
				console.log(
					"🎯 Pro Tip: Use vim-motion ('k', 'j') to navigate chats and messages.",
				);
				cli.showHelp();
				break;
		}
	} catch (error) {
		console.error('❌ Error:', error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
