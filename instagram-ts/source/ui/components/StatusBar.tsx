import React from 'react';
import {Box, Text} from 'ink';
import type {Thread} from '../../types/instagram.js';
// import {Spinner} from '@inkjs/ui';

interface StatusBarProps {
	loading?: boolean;
	error?: string;
	currentView?: 'threads' | 'chat';
	currentThread?: Thread;
	username?: string;
}

export default function StatusBar({
	loading,
	error,
	currentView,
	currentThread,
}: StatusBarProps) {
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
				{loading && <Text color="yellow">Loading...</Text>}
				{error && <Text color="red">Error</Text>}
				{!loading && !error && (
					<Text color="green">
						{currentView === 'threads' ? 'Threads' : 'Chat'}
					</Text>
				)}
			</Box>
		</Box>
	);
}
