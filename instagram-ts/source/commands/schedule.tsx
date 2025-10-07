import React from 'react';
import {Text, Box} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import {Alert} from '@inkjs/ui';
import {Scheduler} from '../scheduler.js';

export const args = zod.tuple([
	zod.enum(['ls', 'cancel', 'add']).describe(
		argument({
			name: 'command',
			description: 'Schedule command: ls, cancel, or add',
		}),
	),
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'arg',
				description: 'Additional argument (index for cancel, message for add)',
			}),
		),
]);

type Properties = {
	readonly args: zod.infer<typeof args>;
};

export default function Schedule({args}: Properties) {
	const [result, setResult] = React.useState<string | undefined>(undefined);
	const [error, setError] = React.useState<string | undefined>(undefined);

	React.useEffect(() => {
		(async () => {
			try {
				const scheduler = Scheduler.getInstance();
				await scheduler.initialize();

				const subcommand = args[0];
				const subarg = args[1];

				switch (subcommand) {
					case 'ls': {
						const tasks = await scheduler.listTasks();
						if (tasks.length === 0) {
							setResult('No scheduled tasks.');
							return;
						}

						setResult(
							'Scheduled tasks:\n' +
								tasks
									.map(
										(task, i) =>
											`${i}: ${task.displayName} - ${task.sendTime} - ${task.message}`,
									)
									.join('\n'),
						);

						break;
					}

					case 'cancel': {
						const index = Number.parseInt(subarg ?? '0', 10);
						if (Number.isNaN(index)) {
							setError('Invalid index.');
							return;
						}

						const success = await scheduler.cancelTask(index);
						setResult(success ? 'Task cancelled.' : 'Failed to cancel task.');

						break;
					}

					case 'add': {
						if (!subarg) {
							setError('Message required for add command.');
							return;
						}

						// For now, just show a placeholder - you can implement the add functionality
						setResult(`Would add message: ${subarg}`);

						break;
					}

					// eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
					default: {
						setError('Unknown schedule command. Available: ls, cancel, add');
					}
				}
			} catch (error_) {
				setError(
					`Schedule error: ${
						error_ instanceof Error ? error_.message : String(error_)
					}`,
				);
			}
		})();
	}, [args]);

	if (error) {
		return (
			<Box flexDirection="column">
				<Alert variant="error">{error}</Alert>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text>{result ?? 'Scheduling...'}</Text>
		</Box>
	);
}
