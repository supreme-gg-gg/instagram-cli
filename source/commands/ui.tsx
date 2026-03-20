import React from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import {startUiServer} from '../web-ui/server.js';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'username',
				description:
					'Instagram account username (uses current session if omitted)',
			}),
		),
]);

export const options = zod.object({
	port: zod.number().default(4318).describe('Port for the localhost UI server'),
});

type Properties = {
	readonly args: zod.infer<typeof args>;
	readonly options: zod.infer<typeof options>;
};

export default function UiCommand({
	args: commandArgs,
	options: commandOptions,
}: Properties) {
	const {exit} = useApp();
	const [url, setUrl] = React.useState<string | undefined>();
	const [error, setError] = React.useState<string | undefined>();

	React.useEffect(() => {
		let mounted = true;
		let stopServer: (() => Promise<void>) | undefined;

		const boot = async () => {
			try {
				const handle = await startUiServer({
					usernameArgument: commandArgs[0],
					port: commandOptions.port,
					openBrowser: true,
				});

				if (!mounted) {
					await handle.close();
					return;
				}

				stopServer = handle.close;
				setUrl(handle.url);
			} catch (error_) {
				if (!mounted) {
					return;
				}

				setError(error_ instanceof Error ? error_.message : String(error_));
			}
		};

		void boot();

		return () => {
			mounted = false;
			if (stopServer) {
				void stopServer();
			}
		};
	}, [commandArgs, commandOptions.port]);

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			exit();
			return;
		}

		if (input === 'q') {
			exit();
		}
	});

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	if (!url) {
		return <Alert variant="info">Starting localhost UI...</Alert>;
	}

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold color="green">
				Local UI running
			</Text>
			<Text>{url}</Text>
			<Text dimColor>
				A browser window should open automatically. Press q or Ctrl+C to stop
				the server.
			</Text>
		</Box>
	);
}
