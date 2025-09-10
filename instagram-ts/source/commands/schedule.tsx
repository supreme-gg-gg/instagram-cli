import React from 'react';
import {Text, Box} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';
import {Scheduler} from '../scheduler.js';
import {Alert} from '@inkjs/ui';

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

type Props = {
	args: zod.infer<typeof args>;
};

export default function Schedule({args}: Props) {
	const [result, setResult] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async () => {
			try {
				const scheduler = Scheduler.getInstance();
				await scheduler.initialize();

				const subcommand = args[0];
				const subarg = args[1];

				if (subcommand === 'ls') {
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
				} else if (subcommand === 'cancel') {
					const index = parseInt(subarg || '0', 10);
					if (isNaN(index)) {
						setError('Invalid index.');
						return;
					}
					const success = await scheduler.cancelTask(index);
					setResult(success ? 'Task cancelled.' : 'Failed to cancel task.');
				} else if (subcommand === 'add') {
					if (!subarg) {
						setError('Message required for add command.');
						return;
					}
					// For now, just show a placeholder - you can implement the add functionality
					setResult(`Would add message: ${subarg}`);
				} else {
					setError('Unknown schedule command. Available: ls, cancel, add');
				}
			} catch (err) {
				setError(
					`Schedule error: ${err instanceof Error ? err.message : String(err)}`,
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
			<Text>{result ? result : 'Scheduling...'}</Text>
		</Box>
	);
}
