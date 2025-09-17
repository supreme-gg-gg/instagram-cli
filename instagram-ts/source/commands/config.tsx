import React from 'react';
import {Text, Box} from 'ink';
import {Alert, UnorderedList} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import {ConfigManager} from '../config.js';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'key',
				description: 'Configuration key (optional for listing all)',
			}),
		),
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'value',
				description: 'Configuration value (optional for getting)',
			}),
		),
]);

type Properties = {
	readonly args: zod.infer<typeof args>;
};

export default function Config({args}: Properties) {
	const [result, setResult] = React.useState<string | undefined>(undefined);
	const [error, setError] = React.useState<string | undefined>(undefined);
	const [configData, setConfigData] = React.useState<
		Record<string, any> | undefined
	>(undefined);

	React.useEffect(() => {
		(async () => {
			try {
				const config = ConfigManager.getInstance();
				await config.initialize();

				const key = args[0];
				let value = args[1];

				if (value !== undefined) {
					try {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						value = JSON.parse(value);
					} catch {
						// If parsing fails, treat it as a plain string
					}
				}

				if (key === undefined) {
					// Get all config values
					const allConfig = config.getConfig();
					setConfigData(allConfig);
				} else if (value === undefined) {
					// Get config value
					const current = config.get(key);
					setResult(`${key}: ${current ?? 'null'}`);
				} else {
					// Set config value
					await config.set(key, value === 'null' ? null : value);
					setResult(`✅ Set ${key} to: ${value}`);
				}
			} catch (error_) {
				setError(
					`Configuration error: ${
						error_ instanceof Error ? error_.message : String(error_)
					}`,
				);
			}
		})();
	}, [args]);

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	if (configData) {
		return (
			<Box flexDirection="column">
				<Text>Current Configuration:</Text>
				<UnorderedList>
					{Object.entries(configData).map(([key, value]) => (
						<UnorderedList.Item key={key}>
							<Text>
								{key}: {JSON.stringify(value)}
							</Text>
						</UnorderedList.Item>
					))}
				</UnorderedList>
			</Box>
		);
	}

	return <Text>{result ?? 'Configuring...'}</Text>;
}
