import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

type LogEntry = {
	readonly level: LogLevel;
	readonly timestamp: string;
	readonly message: string;
	readonly context?: string;
	readonly stack?: string;
};

class Logger {
	private readonly logFilePath: string;
	private readonly logsDir: string;
	private readonly sessionId: string;
	private readonly logBuffer: LogEntry[] = [];
	private isInitialized = false;

	constructor() {
		this.logsDir = path.join(os.homedir(), '.instagram-cli', 'logs');
		this.sessionId = this.generateSessionId();
		this.logFilePath = path.join(this.logsDir, `session-${this.sessionId}.log`);
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			await fs.promises.mkdir(this.logsDir, {recursive: true});
			this.isInitialized = true;
		} catch (error) {
			// Fallback: if we can't create logs dir, at least warn to console
			console.error(
				'Failed to initialize logger:',
				error instanceof Error ? error.message : 'Unknown error',
			);
		}
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

	private generateSessionId(): string {
		const now = new Date();
		const dateStr = now.toISOString().replaceAll(/[:.]/g, '-').split('T')[0];
		const timeStr = now
			.toISOString()
			.replaceAll(/[:.]/g, '-')
			.split('T')[1]
			?.split('-')[0];
		const randomStr = Math.random().toString(36).slice(2, 8);
		return `${dateStr}_${timeStr}_${randomStr}`;
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
