import React from 'react';
import {Text} from 'ink';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import {ConfigManager} from '../config.js';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'key',
			description: 'Configuration key',
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

type Props = {
	args: zod.infer<typeof args>;
};

export default function Config({args}: Props) {
	const [result, setResult] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async () => {
			try {
				const config = ConfigManager.getInstance();
				await config.initialize();

				const key = args[0];
				let value = args[1];

				if (value !== undefined) {
    try {
        value = JSON.parse(value);
    } catch {
        // If parsing fails, treat it as a plain string
    }
}

				if (value === undefined) {
					// Get config value
					const current = config.get(key);
					setResult(`${key}: ${current ?? 'null'}`);
				} else {
					// Set config value
					await config.set(key, value === 'null' ? null : value);
					setResult(`✅ Set ${key} to: ${value}`);
				}
			} catch (err) {
				setError(
					`Configuration error: ${
						err instanceof Error ? err.message : String(err)
					}`,
				);
			}
		})();
	}, [args]);

	if (error) {
		return <Alert variant="error">❌ {error}</Alert>;
	}

	return <Text>{result ? result : 'Configuring...'}</Text>;
}
