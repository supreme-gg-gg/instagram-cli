import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import nodeUtil from 'node:util';
import debugModule from 'debug';
import {ConfigManager} from '../config.js';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

type LogEntry = {
	readonly level: LogLevel;
	readonly timestamp: string;
	readonly message: string;
	readonly context?: string;
	readonly stack?: string;
};

class Logger {
	private logFilePath: string;
	private logsDir: string;
	private readonly sessionId: string;
	private readonly logBuffer: LogEntry[] = [];
	private isInitialized = false;
	private debugHookInstalled = false;

	constructor() {
		// Initialize with default path; will be updated in initialize()
		this.logsDir = path.join(os.homedir(), '.instagram-cli', 'logs');
		this.sessionId = this.generateSessionId();
		this.logFilePath = path.join(this.logsDir, `session-${this.sessionId}.log`);
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			// Get logs directory from config
			const configManager = ConfigManager.getInstance();
			await configManager.initialize();
			const configuredLogsDir = configManager.get('advanced.logsDir');
			if (configuredLogsDir) {
				this.logsDir = configuredLogsDir;
				// Update logFilePath with the configured logs directory
				this.logFilePath = path.join(
					this.logsDir,
					`session-${this.sessionId}.log`,
				);
			}

			await fs.promises.mkdir(this.logsDir, {recursive: true});
			this.isInitialized = true;

			// Install debug library hook to redirect output to log file
			this.installDebugHook();

			// Log initialization
			this.info('Logger initialized', 'Logger');
		} catch {}
	}

	error(message: string, context?: string, error?: Error | unknown): void {
		const stack =
			error instanceof Error
				? error.stack
				: error
					? JSON.stringify(error)
					: undefined;
		const entry = this.createLogEntry('error', message, context, stack);
		this.logBuffer.push(entry);
		void this.writeToFile(entry);
	}

	warn(message: string, context?: string): void {
		const entry = this.createLogEntry('warn', message, context);
		this.logBuffer.push(entry);
		void this.writeToFile(entry);
	}

	info(message: string, context?: string): void {
		const entry = this.createLogEntry('info', message, context);
		this.logBuffer.push(entry);
		void this.writeToFile(entry);
	}

	debug(message: string, context?: string): void {
		const entry = this.createLogEntry('debug', message, context);
		this.logBuffer.push(entry);
		void this.writeToFile(entry);
	}

	getLogFilePath(): string {
		return this.logFilePath;
	}

	getLogsDirectory(): string {
		return this.logsDir;
	}

	getSessionId(): string {
		return this.sessionId;
	}

	getBufferedLogs(): LogEntry[] {
		return [...this.logBuffer];
	}

	async flush(): Promise<void> {
		// All writes are already async, so this is mainly for cleanup
		// Can be used to ensure all pending writes are complete
	}

	/**
	 * Installs a hook to redirect debug library output to the log file.
	 * This ensures that API logs from instagram-private-api are captured.
	 */
	private installDebugHook(): void {
		if (this.debugHookInstalled) {
			return;
		}

		try {
			// Override the debug library's log function to write to our log file
			// instead of stderr. This captures all debug output including ig:* namespaces
			debugModule.log = (...args: any[]) => {
				this.debug(
					nodeUtil.formatWithOptions(
						// @ts-expect-error Monkey patching
						debugModule.inspectOpts,
						// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
						...args,
					) + '\n',
				);
			};

			// Enable debug output for instagram API if DEBUG env var is set
			// Or enable it by default for better logging coverage
			const debugEnv = process.env['DEBUG'];
			if (debugEnv) {
				debugModule.enable(debugEnv);
			} else {
				// Enable all ig:* namespaces by default for comprehensive API logging
				debugModule.enable('ig:*');
			}

			this.debugHookInstalled = true;
		} catch {
			// If debug module is not available, just continue without it
			// This is a graceful fallback
			this.warn('Failed to install debug hook, API logging disabled', 'Logger');
		}
	}

	private generateSessionId(): string {
		const now = new Date();
		const dateStr = now.toISOString().replaceAll(/[:.]/g, '-').split('T')[0];
		const timeStr = now
			.toISOString()
			.replaceAll(/[:.]/g, '-')
			.split('T')[1]
			?.split('-')[0];
		return `${dateStr}_${timeStr}`;
	}

	private formatLogEntry(entry: LogEntry): string {
		const timeStr = entry.timestamp;
		const contextStr = entry.context ? ` [${entry.context}]` : '';
		const levelStr = entry.level.toUpperCase();

		let output = `${timeStr} ${levelStr}${contextStr}: ${entry.message}`;

		if (entry.stack) {
			output += `\n${entry.stack}`;
		}

		return output;
	}

	private async writeToFile(entry: LogEntry): Promise<void> {
		if (!this.isInitialized) {
			return;
		}

		try {
			const formatted = this.formatLogEntry(entry);
			await fs.promises.appendFile(this.logFilePath, `${formatted}\n`, 'utf8');
		} catch {
			// Silently fail if we can't write to file
		}
	}

	private createLogEntry(
		level: LogLevel,
		message: string,
		context?: string,
		stack?: string,
	): LogEntry {
		return {
			level,
			timestamp: new Date().toISOString(),
			message,
			context,
			stack,
		};
	}
}

// Singleton instance
let loggerInstance: Logger | undefined;

export function getLogger(): Logger {
	loggerInstance ??= new Logger();
	return loggerInstance;
}

export async function initializeLogger(): Promise<void> {
	const logger = getLogger();
	await logger.initialize();
}

export function createContextualLogger(context: string) {
	const logger = getLogger();
	return {
		error(message: string, error?: Error | unknown) {
			logger.error(message, context, error);
		},
		warn(message: string) {
			logger.warn(message, context);
		},
		info(message: string) {
			logger.info(message, context);
		},
		debug(message: string) {
			logger.debug(message, context);
		},
	};
}
