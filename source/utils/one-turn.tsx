import process from 'node:process';
import React, {useEffect} from 'react';
import {Text} from 'ink';
import {useInstagramClient} from '../ui/hooks/use-instagram-client.js';
import {type InstagramClient} from '../client.js';
import {createContextualLogger} from './logger.js';

const logger = createContextualLogger('OneTurn');

const flushStdout = async (): Promise<void> =>
	new Promise<void>(resolve => {
		if (process.stdout.write('', 'utf-8')) {
			resolve();
		} else {
			process.stdout.once('drain', resolve);
		}
	});

type JsonSuccess<T> = {ok: true; data: T};
type JsonError = {ok: false; error: string};
type JsonEnvelope<T> = JsonSuccess<T> | JsonError;

export function jsonSuccess<T>(data: T): JsonEnvelope<T> {
	return {ok: true, data};
}

export function jsonError(error: string): JsonEnvelope<never> {
	return {ok: false, error};
}

// Writes directly to stdout to bypass Ink's rendering pipeline
export function outputJson<T>(envelope: JsonEnvelope<T>): void {
	process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
}

export function outputText(text: string): void {
	process.stdout.write(text + '\n');
}

/**
 * Resolves a thread identifier to a thread ID (and optionally user PK).
 *
 * Resolution priority:
 *   1. Raw numeric thread ID (20+ digits) → passthrough (zero API calls)
 *   2. Exact username → searchThreadByUsername → handles PENDING_ virtual threads
 *   3. Fuzzy thread title → searchThreadsByTitle
 *
 * @returns An object with threadId and an optional userPk (set only for username matches)
 */
export async function resolveThread(
	client: InstagramClient,
	query: string,
): Promise<{threadId: string; userPk?: string}> {
	// 1. Raw thread ID passthrough
	if (/^\d{20,}$/.test(query)) {
		return {threadId: query};
	}

	// 2. Exact username lookup
	try {
		const results = await client.searchThreadByUsername(query, {
			forceExact: true,
		});
		if (results.length > 0 && results[0]) {
			const {thread} = results[0];
			let threadId = thread.id;
			const userPk = thread.users[0]?.pk ?? '';
			if (threadId.startsWith('PENDING_')) {
				const pk = threadId.replace('PENDING_', '');
				const realThread = await client.ensureThread(pk);
				threadId = realThread.id;
			}

			return {threadId, userPk};
		}
	} catch {
		// Fall through to title search
	}

	// 3. Fuzzy title search
	const titleResults = await client.searchThreadsByTitle(query);
	if (titleResults.length > 0 && titleResults[0]) {
		return {threadId: titleResults[0].thread.id};
	}

	throw new Error(`No thread found matching "${query}"`);
}

type OneTurnCommandProperties = {
	readonly username?: string;
	readonly output?: string;
	readonly run: (client: InstagramClient) => Promise<void>;
};

/**
 * Thin wrapper for non-interactive one-turn CLI commands.
 * Initializes the Instagram client (no realtime), runs the provided callback,
 * writes output to stdout, and exits the process.
 */
export function OneTurnCommand({
	username,
	output,
	run,
}: OneTurnCommandProperties): React.ReactElement {
	const {client, isLoading, error} = useInstagramClient(username, {
		realtime: false,
	});
	const isJson = output === 'json';

	useEffect(() => {
		if (isLoading) return;

		const execute = async () => {
			if (error) {
				if (isJson) {
					outputJson(jsonError(error));
				} else {
					outputText(`Error: ${error}`);
				}

				await flushStdout();
				// eslint-disable-next-line unicorn/no-process-exit -- CLI command must exit on auth error
				process.exit(1);
			}

			if (!client) return;

			try {
				await run(client);
				await flushStdout();
				// eslint-disable-next-line unicorn/no-process-exit -- CLI command must exit after one-turn execution
				process.exit(0);
			} catch (error_: unknown) {
				const message =
					error_ instanceof Error ? error_.message : String(error_);
				logger.error('Command failed', error_);
				if (isJson) {
					outputJson(jsonError(message));
				} else {
					outputText(`Error: ${message}`);
				}

				await flushStdout();
				// eslint-disable-next-line unicorn/no-process-exit -- CLI command must exit after one-turn execution
				process.exit(1);
			}
		};

		void execute();
	}, [client, isLoading, isJson, error, run]);

	return <Text> </Text>;
}
