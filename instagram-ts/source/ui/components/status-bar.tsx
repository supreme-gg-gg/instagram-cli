import React from 'react';
import {Box, Text} from 'ink';
import type {Thread} from '../../types/instagram.js';
// Import {Spinner} from '@inkjs/ui';

type StatusBarProperties = {
	readonly isLoading?: boolean;
	readonly error?: string;
	readonly currentView?: 'threads' | 'chat';
	readonly currentThread?: Thread;
};

export default function StatusBar({
	isLoading,
	error,
	currentView,
	currentThread,
}: StatusBarProperties) {
	return (
		<Box paddingX={1} justifyContent="space-between" width="100%">
			<Box>
				<Text bold color="magenta">
					📷 InstagramCLI
				</Text>
				{currentView === 'chat' && currentThread && (
					<Text> / Chat with {currentThread.title}</Text>
				)}
			</Box>

			<Box>
				{/* {loading && <Spinner label="Loading..." />} */}
				{isLoading && <Text color="yellow">Loading...</Text>}
				{error && <Text color="red">Error</Text>}
				{!isLoading && !error && (
					<Text color="green">
						{currentView === 'threads' ? 'Threads' : 'Chat'}
					</Text>
				)}
			</Box>
		</Box>
	);
}
