import process from 'node:process';
import React, {useEffect, useState} from 'react';
import {Text} from 'ink';
import {useInstagramClient} from '../ui/hooks/use-instagram-client.js';
import {type InstagramClient} from '../client.js';
import {createContextualLogger} from './logger.js';

const logger = createContextualLogger('OneTurn');

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
 * Resolves a recipient username to a thread ID and user PK.
 * Handles the PENDING_ virtual thread ID by calling ensureThread.
 */
export async function resolveRecipient(
	client: InstagramClient,
	recipient: string,
): Promise<{threadId: string; userPk: string}> {
	const results = await client.searchThreadByUsername(recipient, {
		forceExact: true,
	});
	if (results.length === 0 || !results[0]) {
		throw new Error(`User "${recipient}" not found`);
	}

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

/**
 * Resolves a thread identifier (username or thread title) to a thread ID.
 * First tries username lookup, then falls back to fuzzy title search.
 */
export async function resolveThread(
	client: InstagramClient,
	query: string,
): Promise<string> {
	try {
		const {threadId} = await resolveRecipient(client, query);
		return threadId;
	} catch {
		// Fall through to title search
	}

	const titleResults = await client.searchThreadsByTitle(query);
	if (titleResults.length > 0 && titleResults[0]) {
		return titleResults[0].thread.id;
	}

	throw new Error(`No thread found matching "${query}"`);
}

type OneTurnCommandProperties = {
	readonly username?: string;
	readonly output?: string;
	readonly run: (client: InstagramClient) => Promise<void>;
};

/**
 * Wrapper component for non-interactive one-turn CLI commands.
 * Initializes the Instagram client (no realtime), runs the provided callback,
 * prints output to stdout, and exits the process.
 */
export function OneTurnCommand({
	username,
	output,
	run,
}: OneTurnCommandProperties): React.ReactElement {
	const {client, isLoading, error} = useInstagramClient(username, {
		realtime: false,
	});
	const [done, setDone] = useState(false);
	const isJson = output === 'json';

	useEffect(() => {
		if (isLoading || !client) return;

		const execute = async () => {
			let hasError = false;
			try {
				await run(client);
			} catch (error_: unknown) {
				hasError = true;
				const message =
					error_ instanceof Error ? error_.message : String(error_);
				logger.error('Command failed', error_);
				if (isJson) {
					outputJson(jsonError(message));
				} else {
					outputText(`Error: ${message}`);
				}
			} finally {
				setDone(true);
				setTimeout(() => {
					// eslint-disable-next-line unicorn/no-process-exit -- CLI command must exit after one-turn execution
					process.exit(hasError ? 1 : 0);
				}, 50);
			}
		};

		void execute();
	}, [client, isLoading, isJson, run]);

	if (error) {
		if (isJson) {
			outputJson(jsonError(error));
			setTimeout(() => {
				// eslint-disable-next-line unicorn/no-process-exit -- CLI command must exit on auth error
				process.exit(1);
			}, 50);
			return <Text> </Text>;
		}

		outputText(`Error: ${error}`);
		setTimeout(() => {
			// eslint-disable-next-line unicorn/no-process-exit -- CLI command must exit on auth error
			process.exit(1);
		}, 50);
		return <Text> </Text>;
	}

	if (isLoading) {
		if (isJson) {
			return <Text> </Text>;
		}

		return <Text dimColor>Loading...</Text>;
	}

	if (done) {
		return <Text> </Text>;
	}

	return <Text> </Text>;
}
