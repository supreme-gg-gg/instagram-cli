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

type OneTurnCommandProperties = {
	readonly username?: string;
	readonly json?: boolean;
	readonly run: (client: InstagramClient) => Promise<void>;
};

/**
 * Wrapper component for non-interactive one-turn CLI commands.
 * Initializes the Instagram client (no realtime), runs the provided callback,
 * prints output to stdout, and exits the process.
 */
export function OneTurnCommand({
	username,
	json,
	run,
}: OneTurnCommandProperties): React.ReactElement {
	const {client, isLoading, error} = useInstagramClient(username, {
		realtime: false,
	});
	const [runError, setRunError] = useState<string | undefined>(undefined);
	const [done, setDone] = useState(false);

	useEffect(() => {
		if (isLoading || !client) return;

		const execute = async () => {
			try {
				await run(client);
			} catch (error_: unknown) {
				const message =
					error_ instanceof Error ? error_.message : String(error_);
				logger.error('Command failed', error_);
				if (json) {
					outputJson(jsonError(message));
				} else {
					setRunError(message);
				}
			} finally {
				setDone(true);
				setTimeout(() => {
					// eslint-disable-next-line unicorn/no-process-exit -- CLI command must exit after one-turn execution
					process.exit(0);
				}, 50);
			}
		};

		void execute();
	}, [client, isLoading, json, run]);

	if (error) {
		if (json) {
			outputJson(jsonError(error));
			setTimeout(() => {
				// eslint-disable-next-line unicorn/no-process-exit -- CLI command must exit on auth error
				process.exit(1);
			}, 50);
			return <Text> </Text>;
		}

		return <Text color="red">Error: {error}</Text>;
	}

	if (runError) {
		return <Text color="red">Error: {runError}</Text>;
	}

	if (isLoading) {
		if (json) {
			return <Text> </Text>;
		}

		return <Text dimColor>Loading...</Text>;
	}

	if (done) {
		return <Text> </Text>;
	}

	return <Text> </Text>;
}
